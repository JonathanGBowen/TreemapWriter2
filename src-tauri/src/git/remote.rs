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
use std::path::Path;

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

/// Clone a remote project into `into` over HTTPS, authenticating with a GitHub
/// PAT via the same credential callback as pull/push. The caller has already
/// verified `into` is empty/non-existent.
///
/// After checkout we pin the deterministic line-ending policy and re-normalize
/// the working tree: a fresh clone on Windows (global `core.autocrlf=true`)
/// would otherwise land a CRLF tree that reads as permanently "dirty" and
/// wedges every future pull (same failure class as `ensure_line_ending_policy`).
/// An empty remote leaves HEAD unborn, so the re-checkout is guarded — the
/// caller rejects that case via `looks_like_project` immediately after.
pub fn clone(url: &str, into: &Path, token: &str) -> AppResult<()> {
    let mut callbacks = RemoteCallbacks::new();
    let token_owned = token.to_string();
    callbacks.credentials(move |_url, _username, _allowed| {
        Cred::userpass_plaintext("x-access-token", &token_owned)
    });
    let mut fetch_opts = FetchOptions::new();
    fetch_opts.remote_callbacks(callbacks);

    let repo = git2::build::RepoBuilder::new()
        .fetch_options(fetch_opts)
        .clone(url, into)?;

    super::ensure_line_ending_policy(&repo, into)?;
    if repo.head().is_ok() {
        let mut checkout = git2::build::CheckoutBuilder::default();
        checkout.force();
        repo.checkout_head(Some(&mut checkout))?;
    }
    Ok(())
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
        // Force checkout: a plain safe checkout, run *after* the branch ref has
        // already been moved to the fetched commit, leaves the working tree on
        // the old content (the diff it would apply reads as a no-op), so the
        // pulled changes never reach project.md on disk. We verified the tree is
        // clean at the top of pull(), so force is safe here — same reasoning as
        // merge::finalize.
        let mut checkout = git2::build::CheckoutBuilder::default();
        checkout.force();
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

#[cfg(test)]
mod tests {
    use super::*;
    use git2::{build::CheckoutBuilder, Direction};
    use std::path::Path;

    /// libgit2 is happiest with forward slashes in paths, even on Windows.
    fn url_for(p: &Path) -> String {
        p.to_string_lossy().replace('\\', "/")
    }

    /// Init a working repo with the production line-ending policy, pinned to a
    /// known branch. Pinning matters: bare remote, clones, and `init` here must
    /// agree on the branch name regardless of the host's `init.defaultBranch`
    /// (which may be `master` or `main`).
    fn init_work_repo(path: &Path) -> Repository {
        std::fs::create_dir_all(path).unwrap();
        let repo = Repository::init(path).unwrap();
        super::super::ensure_line_ending_policy(&repo, path).unwrap();
        repo.set_head("refs/heads/main").unwrap();
        repo
    }

    fn write_md(repo: &Repository, content: &str) {
        std::fs::write(repo.workdir().unwrap().join("project.md"), content).unwrap();
    }

    fn read_md(repo: &Repository) -> String {
        std::fs::read_to_string(repo.workdir().unwrap().join("project.md")).unwrap()
    }

    fn commit(repo: &Repository, content: &str) {
        write_md(repo, content);
        crate::git::commit_all(repo, "test").unwrap();
    }

    // The regression this whole change exists for: git2 must be built with the
    // `https` feature, or every github.com fetch/push dies at transport lookup
    // before the credential callback in pull()/push() ever runs. We probe an
    // https URL on a guaranteed-unresolvable `.invalid` host (RFC 6761, so no
    // packet leaves the machine):
    //   - feature MISSING  -> connect fails instantly with "unsupported URL
    //     protocol" and this test FAILS, catching the Cargo.toml regression;
    //   - feature PRESENT  -> connect reaches DNS, can't resolve `.invalid`,
    //     and this test PASSES.
    // The local-transport tests below CANNOT catch this — file-path remotes
    // never exercise the https transport — so this is the only guard for it.
    #[test]
    fn https_transport_is_compiled_in() {
        let mut remote = git2::Remote::create_detached("https://treemapwriter.invalid/x.git")
            .expect("create_detached");
        let err = remote
            .connect(Direction::Fetch)
            .expect_err("connecting to a .invalid host must fail");
        let msg = err.message().to_lowercase();
        assert!(
            !msg.contains("unsupported") && !msg.contains("not supported"),
            "libgit2 has no HTTPS transport — git2 was built without the `https` \
             feature (see src-tauri/Cargo.toml). Error was: {msg}"
        );
    }

    #[test]
    fn outcomes_report_no_remote_before_configure() {
        let tmp = tempfile::tempdir().unwrap();
        let a = init_work_repo(&tmp.path().join("a"));
        // No origin configured yet: both must short-circuit (no network).
        assert!(matches!(push(&a, "tok").unwrap(), PushOutcome::NoRemote));
        assert!(matches!(pull(&a, "tok").unwrap(), PullOutcome::NoRemote));
    }

    #[test]
    fn configure_push_pull_roundtrip() {
        let tmp = tempfile::tempdir().unwrap();
        let bare_path = tmp.path().join("origin.git");
        let bare = Repository::init_bare(&bare_path).unwrap();
        bare.set_head("refs/heads/main").unwrap();
        let url = url_for(&bare_path);

        let a = init_work_repo(&tmp.path().join("a"));
        configure_remote(&a, &url).unwrap();
        assert_eq!(remote_url(&a).unwrap().as_deref(), Some(url.as_str()));

        // First push to a brand-new remote (no upstream tracking ref yet).
        commit(&a, "line one\n");
        match push(&a, "tok").unwrap() {
            PushOutcome::Pushed { .. } => {}
            other => panic!("expected Pushed, got {other:?}"),
        }
        // Re-pushing with no new commits → UpToDate (the tracking ref that
        // push() advances manually is what makes this true without a fetch).
        assert!(matches!(push(&a, "tok").unwrap(), PushOutcome::UpToDate));

        // A second working copy clones, commits, and pushes — putting origin
        // one commit ahead of A.
        let b_dir = tmp.path().join("b");
        let b = Repository::clone(&url, &b_dir).unwrap();
        super::super::ensure_line_ending_policy(&b, &b_dir).unwrap();
        b.checkout_head(Some(CheckoutBuilder::new().force())).unwrap();
        commit(&b, "line one\nline two\n");
        assert!(matches!(push(&b, "tok").unwrap(), PushOutcome::Pushed { .. }));

        // A pulls and fast-forwards by exactly the one commit B added.
        match pull(&a, "tok").unwrap() {
            PullOutcome::FastForwarded { commits } => assert_eq!(commits, 1),
            other => panic!("expected FastForwarded, got {other:?}"),
        }
        assert_eq!(read_md(&a), "line one\nline two\n");
        // Nothing new upstream now → UpToDate.
        assert!(matches!(pull(&a, "tok").unwrap(), PullOutcome::UpToDate));
    }

    #[test]
    fn pull_refuses_dirty_working_tree() {
        let tmp = tempfile::tempdir().unwrap();
        let bare_path = tmp.path().join("origin.git");
        let bare = Repository::init_bare(&bare_path).unwrap();
        bare.set_head("refs/heads/main").unwrap();

        let a = init_work_repo(&tmp.path().join("a"));
        configure_remote(&a, &url_for(&bare_path)).unwrap();
        commit(&a, "clean\n");
        push(&a, "tok").unwrap();

        // An uncommitted edit to a tracked file must block the pull before any
        // network/merge happens — guards against clobbering local work.
        write_md(&a, "clean\nuncommitted edit\n");
        assert!(matches!(
            pull(&a, "tok").unwrap(),
            PullOutcome::WorkingTreeDirty
        ));
    }

    #[test]
    fn clone_seeded_project_opens_and_validates() {
        use crate::project::Layout;
        let tmp = tempfile::tempdir().unwrap();
        let bare_path = tmp.path().join("origin.git");
        let bare = Repository::init_bare(&bare_path).unwrap();
        bare.set_head("refs/heads/main").unwrap();
        let url = url_for(&bare_path);

        // Author repo with a TreemapWriter-shaped layout (project.md + a tracked
        // .twriter/ file so the dir survives clone), pushed to origin.
        let a_dir = tmp.path().join("a");
        let a = init_work_repo(&a_dir);
        std::fs::create_dir_all(a_dir.join(".twriter")).unwrap();
        std::fs::write(a_dir.join(".twriter/settings.json"), "{\"name\":\"Seeded\"}").unwrap();
        commit(&a, "seeded prose\n");
        configure_remote(&a, &url).unwrap();
        assert!(matches!(push(&a, "tok").unwrap(), PushOutcome::Pushed { .. }));

        // Clone into a fresh dir → content lands and it validates as a project.
        let dest = tmp.path().join("clone");
        super::clone(&url, &dest, "tok").unwrap();
        assert!(Layout::looks_like_project(&dest));
        assert_eq!(
            std::fs::read_to_string(dest.join("project.md")).unwrap(),
            "seeded prose\n"
        );
    }

    #[test]
    fn clone_empty_remote_is_not_a_project() {
        use crate::project::Layout;
        let tmp = tempfile::tempdir().unwrap();
        let bare_path = tmp.path().join("empty.git");
        Repository::init_bare(&bare_path).unwrap();

        // Cloning an empty remote succeeds but brings no project.md (unborn
        // HEAD) → the caller rejects it via looks_like_project.
        let dest = tmp.path().join("clone");
        super::clone(&url_for(&bare_path), &dest, "tok").unwrap();
        assert!(!Layout::looks_like_project(&dest));
    }
}
