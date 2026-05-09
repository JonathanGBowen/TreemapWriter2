// Phase 3a — git2 wrappers (stubs).
//
// Phase 3b will implement init + initial commit. Phase 3d implements the
// snapshot/log/read commands. For now, this module exists to compile
// against and host the eventual implementations.

use crate::error::AppResult;
use std::path::Path;

/// Initialize a new git repository at `path`. No-op if one already exists.
/// Implemented in Phase 3b.
pub fn init(path: &Path) -> AppResult<git2::Repository> {
    let repo = if path.join(".git").exists() {
        git2::Repository::open(path)?
    } else {
        git2::Repository::init(path)?
    };
    Ok(repo)
}

/// Create an initial commit if the repository has no commits yet.
/// Implemented in Phase 3b.
#[allow(dead_code)]
pub fn ensure_initial_commit(_repo: &git2::Repository, _message: &str) -> AppResult<()> {
    todo!("Phase 3b — initial commit");
}
