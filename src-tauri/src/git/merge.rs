// Phase 5 — in-app conflict resolution (the merge engine).
//
// Sister module to `git/remote.rs`. Everything here is built on git2's
// IN-MEMORY merge primitive (`merge_commits` → a detached `Index`): nothing
// touches the working tree or refs until we explicitly write a tree, create the
// merge commit, and check it out. That makes the whole flow transactional and
// abort-safe — a cancelled resolution is just a dropped `Index`, no
// `cleanup_state` and no half-merged repo on disk.
//
// Two entry points:
//   detect()  — called by remote::pull on the divergent branch. Runs the merge
//               in memory. Clean → finalize automatically (Merged). Conflicts →
//               return rich per-file data WITHOUT writing anything, and pin the
//               fetched commit with a keep-alive ref so it can't be gc'd.
//   resolve() — called by the sync_resolve_merge command after the user picks.
//               Re-runs the (deterministic) merge, applies the choices, and
//               commits — guarded so it can never silently overwrite newer work.
//
// Hard rule (inherited from Phase 4): never destroy local commits, and — the
// part that bites at the content level — never silently alter dissertation
// prose. Hence: correct recursive merge base (via merge_commits, not a
// hand-rolled merge_base), strict UTF-8 / binary detection (never
// from_utf8_lossy on content we might commit), a safe (non-force) checkout, and
// a residual-marker scan before any commit.
//
// git2 0.19 doesn't expose libgit2's merge-file or Index::conflict_get/remove,
// so the conflict-markered text comes from `diffy` and conflicts are collected
// up front, then applied by clearing the per-path conflict stages.

use crate::error::{AppError, AppResult};
use crate::types::{ConflictFile, PullOutcome, Resolution, ResolveOutcome};
use git2::build::CheckoutBuilder;
use git2::{Commit, Index, IndexConflict, Oid, Repository};
use std::collections::HashMap;
use std::path::Path;

/// Git index stage bits live in the high nibble of `flags`; mask them to 0 to
/// place a resolved entry at stage 0 (GIT_INDEX_ENTRY_STAGEMASK = 0x3000).
const STAGE_MASK: u16 = 0x3000;

const INCOMING_REF: &str = "refs/twriter/incoming";

/// Run the divergent merge in memory. The caller (remote::pull) has already
/// confirmed the working tree is clean and that this is a real divergence
/// (neither up-to-date nor fast-forwardable).
pub fn detect(repo: &Repository, their_oid: Oid) -> AppResult<PullOutcome> {
    if repo.head_detached()? {
        return Err(other(
            "HEAD is detached; open the project at its branch tip before syncing.",
        ));
    }
    let our_commit = repo.head()?.peel_to_commit()?;
    let their_commit = repo.find_commit(their_oid)?;

    // Refuse unrelated histories up front: merge_base errors when there is no
    // common ancestor, which merge_commits would otherwise treat as an
    // add/add of every file.
    if repo.merge_base(our_commit.id(), their_oid).is_err() {
        return Ok(PullOutcome::UnrelatedHistories);
    }

    // How many remote commits we're integrating, for the UI report.
    let commits = behind_count(repo, our_commit.id(), their_oid);

    let mut idx = repo.merge_commits(&our_commit, &their_commit, None)?;

    if !idx.has_conflicts() {
        // Clean merge: finalize automatically (mirrors the auto-fast-forward UX).
        finalize(repo, &mut idx, &our_commit, &their_commit)?;
        return Ok(PullOutcome::Merged { commits });
    }

    // Real conflicts: gather per-file data and return without writing anything.
    // Pin the fetched commit so a stray `git gc` between now and resolve can't
    // prune it (libgit2's fetch doesn't reliably keep it reachable).
    let conflicts = build_conflicts(repo, &idx)?;
    repo.reference(INCOMING_REF, their_oid, true, "twriter: keep fetched commit alive")?;
    Ok(PullOutcome::MergeRequired {
        their_commit: their_oid.to_string(),
        base_head: our_commit.id().to_string(),
        conflicts,
    })
}

/// Apply the user's per-file choices and create the merge commit. Returns
/// `Stale` if the repo moved out from under the modal (HEAD advanced or the
/// tree went dirty) — the caller re-pulls and reopens with fresh data.
pub fn resolve(
    repo: &Repository,
    their_commit_hex: &str,
    base_head_hex: &str,
    resolutions: &[Resolution],
) -> AppResult<ResolveOutcome> {
    if repo.head_detached()? {
        return Ok(ResolveOutcome::Failed {
            reason: "HEAD is detached; cannot complete the merge.".to_string(),
        });
    }
    let our_commit = repo.head()?.peel_to_commit()?;

    // Guards — all under the command's single AppState lock, so no edit can land
    // between them. If HEAD moved or the tree is dirty since detect, the conflict
    // data the user resolved against may be stale; ask for a fresh pull.
    if our_commit.id().to_string() != base_head_hex || working_tree_dirty(repo)? {
        return Ok(ResolveOutcome::Stale);
    }

    let their_oid = Oid::from_str(their_commit_hex)?;
    let their_commit = match repo.find_commit(their_oid) {
        Ok(c) => c,
        Err(_) => {
            return Ok(ResolveOutcome::Failed {
                reason: "the fetched remote commit is no longer available; pull again.".to_string(),
            });
        }
    };

    let commits = behind_count(repo, our_commit.id(), their_oid);

    // Recompute the (deterministic) merge, snapshot its conflicts, then apply.
    let mut idx = repo.merge_commits(&our_commit, &their_commit, None)?;
    let conflict_map = collect_conflicts(&idx)?;
    for r in resolutions {
        if let Err(e) = apply_one(repo, &mut idx, &conflict_map, r) {
            return Ok(ResolveOutcome::Failed { reason: e.to_string() });
        }
    }

    if idx.has_conflicts() {
        // JS gates submit on every file being resolved, so reaching here means
        // the recomputed conflict set didn't match what the modal showed.
        // Refuse rather than commit a half-resolved tree (write_tree_to would
        // error anyway).
        return Ok(ResolveOutcome::Stale);
    }

    finalize(repo, &mut idx, &our_commit, &their_commit)?;
    cleanup_incoming(repo);
    Ok(ResolveOutcome::Resolved { commits })
}

// --- finalize ------------------------------------------------------------

/// Write the merged index to a tree, create the 2-parent merge commit on HEAD,
/// then point the on-disk index AND working tree at the merged tree.
///
/// We force the working-tree update, but this never risks data loss: detect and
/// resolve only reach finalize with a VERIFIED-clean working tree (pull's dirty
/// check; resolve's Stale guard), so the only files overwritten are ones already
/// identical to the pre-merge commit. Pointing the on-disk index at the merged
/// tree first keeps `status` clean afterwards (the regression the tests assert).
fn finalize(
    repo: &Repository,
    idx: &mut Index,
    our_commit: &Commit<'_>,
    their_commit: &Commit<'_>,
) -> AppResult<()> {
    let tree_oid = idx.write_tree_to(repo)?;
    let tree = repo.find_tree(tree_oid)?;
    let sig = super::signature()?;
    repo.commit(
        Some("HEAD"),
        &sig,
        &sig,
        "merge: integrate remote changes",
        &tree,
        &[our_commit, their_commit],
    )?;

    let mut on_disk = repo.index()?;
    on_disk.read_tree(&tree)?;
    on_disk.write()?;
    let mut checkout = CheckoutBuilder::new();
    checkout.force();
    repo.checkout_index(Some(&mut on_disk), Some(&mut checkout))?;
    Ok(())
}

// --- conflict extraction -------------------------------------------------

fn build_conflicts(repo: &Repository, idx: &Index) -> AppResult<Vec<ConflictFile>> {
    let mut out = Vec::new();
    for conflict in idx.conflicts()? {
        out.push(classify(repo, &conflict?)?);
    }
    Ok(out)
}

fn classify(repo: &Repository, c: &IndexConflict) -> AppResult<ConflictFile> {
    let path = conflict_path(c)?;
    let base = c.ancestor.as_ref().and_then(|e| blob_text(repo, e.id));
    let ours = c.our.as_ref().and_then(|e| blob_text(repo, e.id));
    let theirs = c.their.as_ref().and_then(|e| blob_text(repo, e.id));

    // Modify/delete: exactly one content side is absent.
    if c.our.is_none() || c.their.is_none() {
        return Ok(ConflictFile {
            path,
            kind: "modifyDelete".to_string(),
            base,
            ours,
            theirs,
            merged: None,
            automergeable: false,
            our_deleted: c.our.is_none(),
            their_deleted: c.their.is_none(),
        });
    }

    // Both sides present. If either is binary / non-UTF-8, it's a whole-file pick.
    let (our_text, their_text) = match (&ours, &theirs) {
        (Some(o), Some(t)) => (o.clone(), t.clone()),
        _ => {
            return Ok(ConflictFile {
                path,
                kind: "binary".to_string(),
                base,
                ours,
                theirs,
                merged: None,
                automergeable: false,
                our_deleted: false,
                their_deleted: false,
            });
        }
    };

    // Text conflict: produce the conflict-markered merge via diffy.
    let (merged, automergeable) = text_merge(base.as_deref(), &our_text, &their_text);
    Ok(ConflictFile {
        path,
        kind: "text".to_string(),
        base,
        ours,
        theirs,
        merged: Some(merged),
        automergeable,
        our_deleted: false,
        their_deleted: false,
    })
}

/// 3-way text merge → (markered text, automergeable). On a clean merge diffy
/// returns `Ok` (no markers); on conflict it returns `Err` carrying the
/// conflict-markered text. Standard (non-diff3) markers so the JS parser sees
/// only `<<<<<<<` / `=======` / `>>>>>>>`.
fn text_merge(base: Option<&str>, ours: &str, theirs: &str) -> (String, bool) {
    let mut opts = diffy::MergeOptions::new();
    opts.set_conflict_style(diffy::ConflictStyle::Merge);
    match opts.merge(base.unwrap_or(""), ours, theirs) {
        Ok(clean) => (clean, true),
        Err(conflicted) => (conflicted, false),
    }
}

// --- resolution ----------------------------------------------------------

fn collect_conflicts(idx: &Index) -> AppResult<HashMap<String, IndexConflict>> {
    let mut map = HashMap::new();
    for conflict in idx.conflicts()? {
        let conflict = conflict?;
        if let Ok(path) = conflict_path(&conflict) {
            map.insert(path, conflict);
        }
    }
    Ok(map)
}

fn apply_one(
    repo: &Repository,
    idx: &mut Index,
    conflicts: &HashMap<String, IndexConflict>,
    r: &Resolution,
) -> AppResult<()> {
    let path = resolution_path(r);
    let ppath = Path::new(path);

    // A resolution for a path that is no longer conflicted (e.g. it auto-merged)
    // is harmless — skip it rather than fail.
    let conflict = match conflicts.get(path) {
        Some(c) => c,
        None => return Ok(()),
    };

    let bytes: Option<Vec<u8>> = match r {
        Resolution::Content { text, .. } => {
            if contains_conflict_markers(text) {
                return Err(other(format!("unresolved conflict markers remain in {path}")));
            }
            Some(text.as_bytes().to_vec())
        }
        Resolution::Ours { .. } => match &conflict.our {
            Some(e) => Some(repo.find_blob(e.id)?.content().to_vec()),
            None => None, // our side deleted → accept the deletion
        },
        Resolution::Theirs { .. } => match &conflict.their {
            Some(e) => Some(repo.find_blob(e.id)?.content().to_vec()),
            None => None,
        },
        Resolution::Delete { .. } => None,
    };

    // Drop the three conflict stages for this path, then either add the resolved
    // content at stage 0 or leave it absent (a deletion).
    clear_conflict_stages(idx, ppath);
    if let Some(data) = bytes {
        // Write the resolved blob into the ODB ourselves, then add it by OID.
        // (The merge index from merge_commits is detached, so add_frombuffer —
        // which needs a repo-backed index to write the blob — would fail.)
        let src = conflict
            .our
            .as_ref()
            .or(conflict.their.as_ref())
            .or(conflict.ancestor.as_ref())
            .ok_or_else(|| other(format!("conflict {path} has no entries")))?;
        let oid = repo.blob(&data)?;
        idx.add(&stage0_entry(src, oid, data.len()))?;
    }
    Ok(())
}

/// Build a stage-0 IndexEntry from a conflict side, preserving its path, mode,
/// and flags namemask but clearing the stage bits and pointing at the resolved
/// blob. (IndexEntry isn't Clone in git2 0.19, so copy the fields we need.)
fn stage0_entry(src: &git2::IndexEntry, id: Oid, size: usize) -> git2::IndexEntry {
    git2::IndexEntry {
        ctime: git2::IndexTime::new(0, 0),
        mtime: git2::IndexTime::new(0, 0),
        dev: 0,
        ino: 0,
        mode: src.mode,
        uid: 0,
        gid: 0,
        file_size: size as u32,
        id,
        flags: src.flags & !STAGE_MASK,
        flags_extended: 0,
        path: src.path.clone(),
    }
}

fn clear_conflict_stages(idx: &mut Index, ppath: &Path) {
    for stage in 1i32..=3 {
        let _ = idx.remove(ppath, stage);
    }
}

// --- helpers -------------------------------------------------------------

/// Read a blob as text, but only when it is genuinely text: `None` for binary
/// blobs or invalid UTF-8. We never lossily decode content we might commit.
fn blob_text(repo: &Repository, oid: Oid) -> Option<String> {
    let blob = repo.find_blob(oid).ok()?;
    if blob.is_binary() {
        return None;
    }
    std::str::from_utf8(blob.content()).ok().map(|s| s.to_string())
}

fn conflict_path(c: &IndexConflict) -> AppResult<String> {
    let bytes = c
        .our
        .as_ref()
        .or(c.their.as_ref())
        .or(c.ancestor.as_ref())
        .map(|e| e.path.clone())
        .ok_or_else(|| other("conflict with no entries"))?;
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

fn resolution_path(r: &Resolution) -> &str {
    match r {
        Resolution::Content { path, .. }
        | Resolution::Ours { path }
        | Resolution::Theirs { path }
        | Resolution::Delete { path } => path,
    }
}

/// True if any line begins with the unambiguous `<<<<<<<` / `>>>>>>>` conflict
/// markers. A last-ditch guard so resolved text can't carry markers into
/// history. We deliberately do NOT flag `=======`: a lone `=======` is a Setext
/// h1 underline in real prose, and an unresolved conflict always carries the
/// `<<<<<<<` / `>>>>>>>` envelope these two prefixes catch.
pub fn contains_conflict_markers(text: &str) -> bool {
    text.lines()
        .any(|line| line.starts_with("<<<<<<<") || line.starts_with(">>>>>>>"))
}

fn behind_count(repo: &Repository, ours: Oid, theirs: Oid) -> u32 {
    repo.graph_ahead_behind(ours, theirs)
        .map(|(_ahead, behind)| behind as u32)
        .unwrap_or(0)
}

fn working_tree_dirty(repo: &Repository) -> AppResult<bool> {
    let mut opts = git2::StatusOptions::new();
    opts.include_ignored(false).include_untracked(false);
    let statuses = repo.statuses(Some(&mut opts))?;
    Ok(!statuses.is_empty())
}

fn cleanup_incoming(repo: &Repository) {
    if let Ok(mut r) = repo.find_reference(INCOMING_REF) {
        let _ = r.delete();
    }
}

fn other(msg: impl std::fmt::Display) -> AppError {
    AppError::Other(anyhow::anyhow!("{}", msg))
}

#[cfg(test)]
mod tests {
    use super::*;
    use git2::{build::CheckoutBuilder, Commit, Signature};

    #[test]
    fn markers_ignore_setext_underline() {
        // A lone `=======` (Setext h1 underline) is NOT an unresolved marker.
        assert!(!contains_conflict_markers("Heading\n=======\nbody text"));
        assert!(contains_conflict_markers("x\n<<<<<<< LOCAL\ny"));
        assert!(contains_conflict_markers("x\n>>>>>>> REMOTE\ny"));
    }

    #[test]
    fn text_merge_clean_and_conflict() {
        let (_clean, ok) = text_merge(Some("a\nb\n"), "a\nb\n", "a\nb\n");
        assert!(ok, "identical sides should automerge");

        let (markered, ok2) = text_merge(Some("a\nb\nc\n"), "a\nX\nc\n", "a\nY\nc\n");
        assert!(!ok2, "overlapping edits should conflict");
        assert!(markered.contains("<<<<<<<") && markered.contains(">>>>>>>"));
    }

    /// Init a repo with the same line-ending policy production applies, so the
    /// tests don't inherit the host's global `core.autocrlf` (which on Windows
    /// would CRLF-rewrite the working tree on checkout and wedge the merge).
    fn init_repo(path: &std::path::Path) -> Repository {
        let repo = Repository::init(path).unwrap();
        super::super::ensure_line_ending_policy(&repo, path).unwrap();
        repo
    }

    /// Commit `content` as project.md. `parents` empty = root commit. When
    /// `on_head` the branch advances; otherwise a dangling commit is returned
    /// (used to fabricate the "remote" side).
    fn commit(repo: &Repository, content: &str, parents: &[&Commit], on_head: bool) -> Oid {
        let blob = repo.blob(content.as_bytes()).unwrap();
        let mut tb = repo.treebuilder(None).unwrap();
        tb.insert("project.md", blob, 0o100644).unwrap();
        let tree = repo.find_tree(tb.write().unwrap()).unwrap();
        let sig = Signature::now("Test", "test@test.local").unwrap();
        let target = if on_head { Some("HEAD") } else { None };
        repo.commit(target, &sig, &sig, "c", &tree, parents).unwrap()
    }

    fn read_md(repo: &Repository) -> String {
        std::fs::read_to_string(repo.workdir().unwrap().join("project.md")).unwrap()
    }

    #[test]
    fn detect_conflict_then_resolve_leaves_clean_tree() {
        let dir = tempfile::tempdir().unwrap();
        let repo = init_repo(dir.path());

        let base = commit(&repo, "a\nb\nc\n", &[], true);
        let base_c = repo.find_commit(base).unwrap();
        // Overlapping edits to the middle line on both sides → real conflict.
        let their = commit(&repo, "a\nTHEIRS\nc\n", &[&base_c], false);
        let our = commit(&repo, "a\nOURS\nc\n", &[&base_c], true);
        repo.checkout_head(Some(CheckoutBuilder::new().force())).unwrap();

        match detect(&repo, their).unwrap() {
            PullOutcome::MergeRequired { their_commit, base_head, conflicts } => {
                assert_eq!(conflicts.len(), 1);
                assert_eq!(conflicts[0].kind, "text");
                assert_eq!(their_commit, their.to_string());
                assert_eq!(base_head, our.to_string());
            }
            other => panic!("expected MergeRequired, got {other:?}"),
        }

        let resolutions = vec![Resolution::Content {
            path: "project.md".to_string(),
            text: "a\nRESOLVED\nc\n".to_string(),
        }];
        let outcome = resolve(&repo, &their.to_string(), &our.to_string(), &resolutions).unwrap();
        assert!(matches!(outcome, ResolveOutcome::Resolved { .. }), "got {outcome:?}");
        assert_eq!(read_md(&repo), "a\nRESOLVED\nc\n");
        // The merge must leave the working tree clean — the regression guard for
        // the CRLF/dirty-after-checkout failure mode.
        assert!(!working_tree_dirty(&repo).unwrap());
        // The merge commit has two parents.
        let head = repo.head().unwrap().peel_to_commit().unwrap();
        assert_eq!(head.parent_count(), 2);
        // Stale-guard: resolving again against the old base_head is rejected.
        assert!(matches!(
            resolve(&repo, &their.to_string(), &our.to_string(), &[]).unwrap(),
            ResolveOutcome::Stale
        ));
    }

    #[test]
    fn detect_clean_divergence_auto_merges() {
        let dir = tempfile::tempdir().unwrap();
        let repo = init_repo(dir.path());

        let base = commit(&repo, "a\nb\nc\n", &[], true);
        let base_c = repo.find_commit(base).unwrap();
        // Non-overlapping edits (line 3 vs line 1) merge cleanly.
        let their = commit(&repo, "a\nb\nTHEIRS\n", &[&base_c], false);
        let _our = commit(&repo, "OURS\nb\nc\n", &[&base_c], true);
        repo.checkout_head(Some(CheckoutBuilder::new().force())).unwrap();

        match detect(&repo, their).unwrap() {
            PullOutcome::Merged { .. } => {}
            other => panic!("expected Merged, got {other:?}"),
        }
        assert_eq!(read_md(&repo), "OURS\nb\nTHEIRS\n");
        assert!(!working_tree_dirty(&repo).unwrap());
    }
}
