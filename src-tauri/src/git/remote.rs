// Phase 4 — git remote operations.
//
// Sister module to `git/mod.rs` (which handles local commits). Everything
// remote-facing lives here: remote URL config, fetch, fast-forward pull,
// push, and a purely-local SyncState query for the UI indicator.
//
// Auth: GitHub HTTPS + Personal Access Token via
// `Cred::userpass_plaintext("x-access-token", &token)` — the token does the
// authenticating; the username is conventional for PATs.
//
// Hard rules (load-bearing — see Phase 4 plan guardrails):
// 1. Never run anything that throws away local commits. MergeRequired and
//    NonFastForward are reported back as outcome variants; the user resolves
//    out-of-band.
// 2. Refuse to pull if the working tree has uncommitted tracked changes —
//    returns WorkingTreeDirty. Phase 3 autosave commits ~60s after edits,
//    so this is rare in practice.
// 3. Branch is whatever HEAD points to (commonly "main"); not hardcoded.

use crate::error::AppResult;
use crate::types::{PullOutcome, PushOutcome, SyncState};
use git2::{
    Cred, FetchOptions, PushOptions, RemoteCallbacks, Repository, StatusOptions,
};

const REMOTE_NAME: &str = "origin";

/// Create or update the `origin` remote URL.
pub fn configure_remote(repo: &Repository, url: &str) -> AppResult<()> {
    match repo.find_remote(REMOTE_NAME) {
        Ok(_) => {
            repo.remote_set_url(REMOTE_NAME, url)?;
        }
        Err(_) => {
            repo.remote(REMOTE_NAME, url)?;
        }
    }
    Ok(())
}

/// Read the configured origin URL. None if no remote is set.
pub fn remote_url(repo: &Repository) -> AppResult<Option<String>> {
    match repo.find_remote(REMOTE_NAME) {
        Ok(remote) => Ok(remote.url().map(|s| s.to_string())),
        Err(_) => Ok(None),
    }
}

/// Fetch + fast-forward. Refuses to act if the working tree is dirty or
/// if remote diverged in a way that would require a real merge.
pub fn pull(repo: &Repository, token: &str) -> AppResult<PullOutcome> {
    if remote_url(repo)?.is_none() {
        return Ok(PullOutcome::NoRemote);
    }
    if is_working_tree_dirty(repo)? {
        return Ok(PullOutcome::WorkingTreeDirty);
    }
    let branch = match current_branch(repo)? {
        Some(b) => b,
        None => return Ok(PullOutcome::WorkingTreeDirty),
    };

    // Fetch the branch from origin.
    let mut remote = repo.find_remote(REMOTE_NAME)?;
    let mut callbacks = RemoteCallbacks::new();
    let token_owned = token.to_string();
    callbacks.credentials(move |_url, _username, _allowed| {
        Cred::userpass_plaintext("x-access-token", &token_owned)
    });
    let mut fetch_opts = FetchOptions::new();
    fetch_opts.remote_callbacks(callbacks);
    remote.fetch(&[&branch], Some(&mut fetch_opts), None)?;

    // Analyze: up-to-date, fast-forward, or would require merge.
    let fetch_head = repo.find_reference("FETCH_HEAD")?;
    let fetch_commit = repo.reference_to_annotated_commit(&fetch_head)?;
    let analysis = repo.merge_analysis(&[&fetch_commit])?;

    if analysis.0.is_up_to_date() {
        return Ok(PullOutcome::UpToDate);
    }
    if analysis.0.is_fast_forward() {
        // Count how many commits we're advancing by, for the SyncReport.
        let local_oid = repo.head()?.target();
        let upstream_oid = fetch_commit.id();
        let commits = match local_oid {
            Some(local) => repo.graph_ahead_behind(upstream_oid, local)
                .map(|(ahead, _)| ahead as u32)
                .unwrap_or(0),
            None => 0,
        };

        // Move the local branch ref forward, then check out the new tree.
        let ref_name = format!("refs/heads/{}", branch);
        let mut reference = repo.find_reference(&ref_name)?;
        reference.set_target(upstream_oid, "Phase-4 fast-forward")?;
        repo.set_head(&ref_name)?;
        // Safe checkout (the default): we already confirmed the working tree
        // is clean, so applying the new commits' tree is purely additive.
        let mut checkout = git2::build::CheckoutBuilder::default();
        checkout.safe();
        repo.checkout_head(Some(&mut checkout))?;
        return Ok(PullOutcome::FastForwarded { commits });
    }

    // Otherwise: divergent. Run an in-memory 3-way merge (git/merge.rs). A clean
    // merge is finalized automatically; real conflicts come back as per-file
    // data driving the in-app resolution modal — nothing is written to the
    // working tree until the user resolves and we commit (Phase 5).
    super::merge::detect(repo, fetch_commit.id())
}

/// Push the current branch to origin. Reports NonFastForward if the remote
/// has commits we don't. On first push (no upstream tracking ref yet),
/// always attempts the push.
pub fn push(repo: &Repository, token: &str) -> AppResult<PushOutcome> {
    if remote_url(repo)?.is_none() {
        return Ok(PushOutcome::NoRemote);
    }
    let branch = match current_branch(repo)? {
        Some(b) => b,
        None => return Ok(PushOutcome::NoRemote),
    };

    // Try to compute ahead-count for the UI. If there's no upstream tracking
    // ref (first push to a brand-new remote), we don't know the count yet —
    // proceed anyway and report 0.
    let ahead_known = ahead_behind_upstream(repo, &branch).ok();
    if let Some((ahead, _)) = ahead_known {
        if ahead == 0 {
            return Ok(PushOutcome::UpToDate);
        }
    }

    let mut remote = repo.find_remote(REMOTE_NAME)?;
    let mut callbacks = RemoteCallbacks::new();
    let token_owned = token.to_string();
    callbacks.credentials(move |_url, _username, _allowed| {
        Cred::userpass_plaintext("x-access-token", &token_owned)
    });
    let mut push_opts = PushOptions::new();
    push_opts.remote_callbacks(callbacks);

    let refspec = format!("refs/heads/{name}:refs/heads/{name}", name = branch);
    match remote.push(&[&refspec], Some(&mut push_opts)) {
        Ok(()) => {
            // Advance the local remote-tracking ref to the just-pushed commit.
            // libgit2's push does not reliably do this, which would leave
            // `sync_state` reporting phantom "ahead" commits (and a stuck
            // "unpushed" indicator) until the next fetch.
            if let Some(local_oid) = repo.head()?.target() {
                let tracking = format!("refs/remotes/{}/{}", REMOTE_NAME, branch);
                let _ = repo.reference(&tracking, local_oid, true, "sync push: advance tracking ref");
            }
            let commits = ahead_known.map(|(a, _)| a).unwrap_or(0);
            Ok(PushOutcome::Pushed { commits })
        }
        Err(e) => {
            // git2 surfaces non-fast-forward as a specific class+code.
            if e.class() == git2::ErrorClass::Reference
                || e.message().to_lowercase().contains("non-fast-forward")
                || e.message().to_lowercase().contains("rejected")
            {
                Ok(PushOutcome::NonFastForward)
            } else {
                Err(e.into())
            }
        }
    }
}

/// Purely-local snapshot of the project's git state. No network. Used by
/// the UI indicator on launch and after every commit.
pub fn sync_state(repo: &Repository) -> AppResult<SyncState> {
    let url = remote_url(repo)?;
    let has_remote = url.is_some();
    let branch = current_branch(repo)?;
    let working_tree_dirty = is_working_tree_dirty(repo)?;

    let (ahead, behind) = match (&branch, has_remote) {
        (Some(b), true) => match ahead_behind_upstream(repo, b) {
            Ok((a, bh)) => (a, bh),
            // No upstream tracking ref yet (e.g. before first push).
            Err(_) => (0, 0),
        },
        _ => (0, 0),
    };

    Ok(SyncState {
        has_remote,
        remote_url: url,
        ahead,
        behind,
        working_tree_dirty,
        branch,
    })
}

fn current_branch(repo: &Repository) -> AppResult<Option<String>> {
    match repo.head() {
        Ok(head) => Ok(head.shorthand().map(|s| s.to_string())),
        Err(_) => Ok(None),
    }
}

fn is_working_tree_dirty(repo: &Repository) -> AppResult<bool> {
    let mut opts = StatusOptions::new();
    opts.include_ignored(false).include_untracked(false);
    let statuses = repo.statuses(Some(&mut opts))?;
    Ok(!statuses.is_empty())
}

fn ahead_behind_upstream(repo: &Repository, branch: &str) -> AppResult<(u32, u32)> {
    let local = repo.head()?.target().ok_or_else(|| {
        crate::error::AppError::Other(anyhow::anyhow!("HEAD has no target"))
    })?;
    let upstream_ref = format!("refs/remotes/{}/{}", REMOTE_NAME, branch);
    let upstream = repo
        .find_reference(&upstream_ref)?
        .target()
        .ok_or_else(|| {
            crate::error::AppError::Other(anyhow::anyhow!("upstream ref has no target"))
        })?;
    let (ahead, behind) = repo.graph_ahead_behind(local, upstream)?;
    Ok((ahead as u32, behind as u32))
}
