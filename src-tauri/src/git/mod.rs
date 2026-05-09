// Phase 3b — git2 wrappers.
//
// All git operations against a project repository go through this module.
// The architectural rule is: anywhere else in Rust that wants to commit,
// log, or read past versions calls a function here — never `git2::*`
// directly. This keeps the surface auditable and makes Phase 4 (sync)
// a matter of adding pull/push without touching readers.

use crate::error::{AppError, AppResult};
use chrono::{DateTime, Utc};
use git2::{Repository, Signature};
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
    Ok(repo)
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
