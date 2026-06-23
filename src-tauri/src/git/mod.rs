// Phase 3b — git2 wrappers.
//
// All git operations against a project repository go through this module.
// The architectural rule is: anywhere else in Rust that wants to commit,
// log, or read past versions calls a function here — never `git2::*`
// directly. This keeps the surface auditable and makes Phase 4 (sync)
// a matter of adding pull/push without touching readers.

pub mod merge;
pub mod remote;

use crate::error::{AppError, AppResult};
use chrono::{DateTime, Utc};
use git2::{Oid, Repository, Signature};
use std::path::Path;

/// The author identity used for app-generated commits. Single-user app, so
/// "TreemapWriter" is fine. The user can override later via a settings file
/// (see Phase 5+); for now we hardcode.
pub const AUTHOR_NAME: &str = "TreemapWriter";
pub const AUTHOR_EMAIL: &str = "noreply@treemapwriter.local";

/// Initialize a git repo at `path`, or open it if one already exists.
pub fn init(path: &Path) -> AppResult<Repository> {
    let repo = if path.join(".git").exists() {
        Repository::open(path)?
    } else {
        Repository::init(path)?
    };
    ensure_line_ending_policy(&repo, path)?;
    Ok(repo)
}

/// Pin a deterministic line-ending policy on the per-project repo so it does
/// not inherit the user's global `core.autocrlf` (commonly `true` on Windows).
///
/// Why this is load-bearing for sync: the app writes `project.md` to disk as
/// pure LF (see `fs_io::atomic_write_str`). If git is left to autocrlf, a
/// checkout rewrites the working tree to CRLF, which then reads as permanently
/// "dirty" (wedging every future pull) and makes the in-memory 3-way merge see
/// LF-vs-CRLF — turning an ordinary divergence into a whole-file conflict. With
/// autocrlf off and `* text=auto eol=lf`, the working tree and blobs match
/// byte-for-byte and the entire CRLF failure class disappears.
///
/// Idempotent: safe to call on every open. Targets the project's own repo only.
fn ensure_line_ending_policy(repo: &Repository, path: &Path) -> AppResult<()> {
    let mut config = repo.config()?;
    config.set_bool("core.autocrlf", false)?;
    config.set_str("core.eol", "lf")?;

    let attrs = path.join(".gitattributes");
    if !attrs.exists() {
        // Untracked until the next autosave commits it; harmless meanwhile
        // (is_working_tree_dirty ignores untracked files).
        std::fs::write(&attrs, "* text=auto eol=lf\n")?;
    }
    Ok(())
}

/// If the repository has no commits, create an initial commit from the
/// current working tree. No-op if HEAD already points at a commit.
pub fn ensure_initial_commit(repo: &Repository, message: &str) -> AppResult<()> {
    if repo.head().is_ok() {
        return Ok(());
    }
    let sig = signature()?;
    let mut index = repo.index()?;
    index.add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)?;
    index.write()?;
    let tree_oid = index.write_tree()?;
    let tree = repo.find_tree(tree_oid)?;
    repo.commit(Some("HEAD"), &sig, &sig, message, &tree, &[])?;
    Ok(())
}

/// Stage all working-tree changes and create a commit. Returns the new
/// commit's OID as a hex string. Does nothing (returns the current HEAD)
/// if there are no changes — this avoids creating empty autosave commits
/// when the user clicks "save" without typing anything.
pub fn commit_all(repo: &Repository, message: &str) -> AppResult<String> {
    let sig = signature()?;

    let mut index = repo.index()?;
    index.add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)?;
    // Honor .gitignore (the cache SQLite + diagnostics).
    index.write()?;
    let tree_oid = index.write_tree()?;
    let tree = repo.find_tree(tree_oid)?;

    // If there's a parent and the tree matches it, nothing changed.
    let parent_commit = match repo.head() {
        Ok(head) => Some(head.peel_to_commit()?),
        Err(_) => None,
    };
    if let Some(parent) = &parent_commit {
        if parent.tree_id() == tree_oid {
            return Ok(parent.id().to_string());
        }
    }

    let parents: Vec<&git2::Commit> = parent_commit.iter().collect();
    let oid = repo.commit(Some("HEAD"), &sig, &sig, message, &tree, &parents)?;
    Ok(oid.to_string())
}

fn signature<'a>() -> AppResult<Signature<'a>> {
    Signature::now(AUTHOR_NAME, AUTHOR_EMAIL).map_err(AppError::from)
}

// --- Tags & refs (session boundaries) -----------------------------------
//
// Sessions are commit ranges on `main`, bracketed by a pair of lightweight
// tags: `session/<ts>/start` and `session/<ts>/end`. Tag names may contain
// slashes — that is valid in git ref names. These primitives let the TS
// session lifecycle bracket a writing session without ever exposing git to
// the writer.

/// Create a lightweight tag `name` pointing at `oid`. With `force`, an
/// existing tag of the same name is moved instead of erroring — so
/// re-bracketing a session is idempotent.
pub fn create_tag(repo: &Repository, name: &str, oid: Oid, force: bool) -> AppResult<()> {
    let object = repo.find_object(oid, None)?;
    repo.tag_lightweight(name, &object, force)?;
    Ok(())
}

/// List tag names, optionally filtered by a glob `pattern` (e.g. `session/*`).
pub fn list_tags(repo: &Repository, pattern: Option<&str>) -> AppResult<Vec<String>> {
    let names = repo.tag_names(pattern)?;
    Ok(names.iter().flatten().map(|s| s.to_string()).collect())
}

/// Resolve a ref (tag name, branch, OID, or `HEAD`) to a commit OID hex
/// string. Returns `None` when it cannot be resolved (e.g. a tag from another
/// machine that hasn't synced). Used by Version Compare to turn a session tag
/// into a selectable snapshot id.
pub fn resolve_ref(repo: &Repository, refname: &str) -> AppResult<Option<String>> {
    Ok(commit_oid_of(repo, refname).map(|oid| oid.to_string()))
}

/// Word-count delta of `project.md` between two refs (tag/branch/OID/HEAD),
/// computed as `to_words - from_words`. A side whose ref can't be resolved, or
/// that has no `project.md`, counts as 0 words. This is the brief's 2D
/// function; per-section deltas are computed in TS from section word counts.
pub fn word_count_delta(repo: &Repository, from_ref: &str, to_ref: &str) -> AppResult<i32> {
    let from = ref_md_word_count(repo, from_ref)?;
    let to = ref_md_word_count(repo, to_ref)?;
    Ok(to - from)
}

/// Peel a ref to the commit it ultimately points at (lightweight or annotated
/// tags both resolve correctly). `None` if the ref doesn't resolve.
fn commit_oid_of(repo: &Repository, refname: &str) -> Option<Oid> {
    repo.revparse_single(refname)
        .ok()
        .and_then(|obj| obj.peel(git2::ObjectType::Commit).ok())
        .map(|commit| commit.id())
}

fn ref_md_word_count(repo: &Repository, refname: &str) -> AppResult<i32> {
    let oid = match commit_oid_of(repo, refname) {
        Some(o) => o,
        None => return Ok(0),
    };
    let commit = repo.find_commit(oid)?;
    let tree = commit.tree()?;
    let entry = match tree.get_path(Path::new("project.md")) {
        Ok(e) => e,
        Err(_) => return Ok(0),
    };
    let blob = repo.find_blob(entry.id())?;
    Ok(String::from_utf8_lossy(blob.content())
        .split_whitespace()
        .count() as i32)
}

/// Helper to render a commit-time epoch-millis from a chrono UTC DateTime.
/// Used by the snapshot list view.
#[allow(dead_code)]
pub fn time_to_epoch_ms(t: git2::Time) -> i64 {
    let secs = t.seconds();
    secs * 1000
}

#[allow(dead_code)]
pub fn now_iso() -> String {
    let now: DateTime<Utc> = Utc::now();
    now.to_rfc3339()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    /// Init a repo in a temp dir, write `project.md`, and commit it. Returns
    /// the repo, the temp dir guard (kept alive by the caller), and the OID.
    fn commit_md(dir: &Path, text: &str) -> (Repository, String) {
        let repo = init(dir).unwrap();
        std::fs::write(dir.join("project.md"), text).unwrap();
        let oid = commit_all(&repo, "manual: test\n\nScope: all").unwrap();
        (repo, oid)
    }

    #[test]
    fn word_count_delta_counts_added_words() {
        let dir = std::env::temp_dir().join(format!("tw-git-wc-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();

        let (repo, start) = commit_md(&dir, "one two three");
        create_tag(&repo, "session/t/start", Oid::from_str(&start).unwrap(), true).unwrap();

        std::fs::write(dir.join("project.md"), "one two three four five").unwrap();
        let end = commit_all(&repo, "manual: more\n\nScope: all").unwrap();

        // +2 words between start tag and the new commit.
        assert_eq!(
            word_count_delta(&repo, "session/t/start", &end).unwrap(),
            2
        );
        // Symmetric: removing words is negative.
        assert_eq!(word_count_delta(&repo, &end, "session/t/start").unwrap(), -2);

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn tags_resolve_to_their_commit() {
        let dir = std::env::temp_dir().join(format!("tw-git-tag-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();

        let (repo, oid) = commit_md(&dir, "alpha beta");
        create_tag(&repo, "session/x/start", Oid::from_str(&oid).unwrap(), true).unwrap();

        assert_eq!(resolve_ref(&repo, "session/x/start").unwrap().as_deref(), Some(oid.as_str()));
        assert!(resolve_ref(&repo, "session/nope/start").unwrap().is_none());

        let tags = list_tags(&repo, Some("session/*")).unwrap();
        assert!(tags.iter().any(|t| t == "session/x/start"));

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn init_pins_the_lf_line_ending_policy() {
        let dir = tempdir().unwrap();
        let repo = init(dir.path()).unwrap();

        // The deterministic LF policy must be set on the project's own repo.
        let config = repo.config().unwrap();
        assert!(!config.get_bool("core.autocrlf").unwrap());
        assert_eq!(config.get_string("core.eol").unwrap(), "lf");
        assert!(dir.path().join(".gitattributes").exists());
    }

    #[test]
    fn init_is_idempotent_and_reopens_an_existing_repo() {
        let dir = tempdir().unwrap();
        init(dir.path()).unwrap();
        // A second init must open (not re-create) the repo without error.
        let reopened = init(dir.path()).unwrap();
        assert!(reopened.head().is_err(), "still no commits after reopen");
    }

    #[test]
    fn commit_all_commits_changes_and_no_ops_when_clean() {
        let dir = tempdir().unwrap();
        let repo = init(dir.path()).unwrap();
        fs::write(dir.path().join("project.md"), "# first\n").unwrap();

        let first = commit_all(&repo, "autosave").unwrap();
        assert!(repo.head().is_ok(), "HEAD points at a commit after the first commit");

        // Nothing changed → commit_all returns the same HEAD, not a new commit.
        let again = commit_all(&repo, "autosave").unwrap();
        assert_eq!(first, again, "an unchanged tree must not create an empty commit");

        // A real edit → a new, distinct commit.
        fs::write(dir.path().join("project.md"), "# first\n\nmore\n").unwrap();
        let third = commit_all(&repo, "autosave").unwrap();
        assert_ne!(first, third, "a changed tree must create a new commit");
    }

    #[test]
    fn ensure_initial_commit_seeds_then_is_a_no_op() {
        let dir = tempdir().unwrap();
        let repo = init(dir.path()).unwrap();
        fs::write(dir.path().join("project.md"), "# seed\n").unwrap();

        ensure_initial_commit(&repo, "initial").unwrap();
        let head = repo.head().unwrap().peel_to_commit().unwrap().id();

        // Calling again must not move HEAD (no-op once a commit exists).
        ensure_initial_commit(&repo, "initial again").unwrap();
        assert_eq!(head, repo.head().unwrap().peel_to_commit().unwrap().id());
    }
}
