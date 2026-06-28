// Phase 3a — filesystem I/O helpers.
//
// All on-disk writes happen through `atomic_write_str`: write to a sibling
// .tmp file, fsync, rename. This is the standard "never leave a half-
// written file" pattern, and it matters because the source of truth is
// the markdown file on disk — a torn write can corrupt the dissertation.
//
// JSON and YAML helpers wrap atomic_write_str with serde glue.

pub mod yaml;

use crate::error::AppResult;
use serde::{de::DeserializeOwned, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Component, Path, PathBuf};

/// Atomic write: temp file + fsync + rename. Creates parent dirs.
pub fn atomic_write_str(path: &Path, contents: &str) -> AppResult<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let tmp = path.with_extension(format!(
        "{}.tmp",
        path.extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
    ));
    {
        let mut f = fs::File::create(&tmp)?;
        f.write_all(contents.as_bytes())?;
        f.sync_all()?;
    }
    fs::rename(&tmp, path)?;
    Ok(())
}

/// Resolve a caller-supplied relative path `rel` against `root` and verify the
/// result stays inside `root`. This is the guard that lets *model-supplied*
/// paths (the local agent's read/write tools, `commands/agent_fs.rs`) reach the
/// filesystem safely.
///
/// Defense in depth:
///   1. Pre-disk lexical rejection of NUL bytes, absolute paths, and any `..` /
///      root / Windows-prefix component — so an escape never even hits disk.
///   2. Canonicalize `root` and the deepest *existing* ancestor of the target,
///      then verify containment — so a symlinked subdirectory can't redirect
///      the path out of `root` after the lexical check passes.
///
/// `root` must already exist (canonicalization requires it; callers create the
/// write root first). The target itself need NOT exist, so this works for
/// writes: only the existing portion of the path is canonicalized.
pub fn resolve_within(root: &Path, rel: &str) -> AppResult<PathBuf> {
    if rel.contains('\0') {
        return crate::error::err("path contains a NUL byte");
    }
    let rel_path = Path::new(rel);
    for comp in rel_path.components() {
        match comp {
            Component::Normal(_) | Component::CurDir => {}
            Component::ParentDir => {
                return crate::error::err(format!("path may not contain '..': {rel}"));
            }
            Component::RootDir | Component::Prefix(_) => {
                return crate::error::err(format!("path must be relative: {rel}"));
            }
        }
    }

    let canon_root = root.canonicalize()?;
    let candidate = canon_root.join(rel_path);

    // Canonicalize the deepest existing ancestor (the target may not exist yet)
    // and re-check containment against the canonical root.
    let existing = deepest_existing_ancestor(&candidate);
    let canon_existing = existing.canonicalize()?;
    if !canon_existing.starts_with(&canon_root) {
        return crate::error::err(format!("path escapes the permitted directory: {rel}"));
    }

    Ok(candidate)
}

/// Walk up from `path` until an existing component is found (or the root).
fn deepest_existing_ancestor(path: &Path) -> PathBuf {
    let mut current = path;
    loop {
        if current.exists() {
            return current.to_path_buf();
        }
        match current.parent() {
            Some(parent) => current = parent,
            None => return current.to_path_buf(),
        }
    }
}

pub fn read_to_string_optional(path: &Path) -> AppResult<Option<String>> {
    if !path.exists() {
        return Ok(None);
    }
    Ok(Some(fs::read_to_string(path)?))
}

/// Cheap stat of a file: `(mtime_ms, size)`, or `None` if it doesn't exist.
/// Counterpart to `read_to_string_optional`, used as a change pre-filter so the
/// whole file isn't read just to discover "no change".
pub fn signature_optional(path: &Path) -> AppResult<Option<(i64, u64)>> {
    if !path.exists() {
        return Ok(None);
    }
    let meta = fs::metadata(path)?;
    let mtime_ms = meta
        .modified()?
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);
    Ok(Some((mtime_ms, meta.len())))
}

pub fn write_json<T: Serialize>(path: &Path, value: &T) -> AppResult<()> {
    let s = serde_json::to_string_pretty(value)?;
    atomic_write_str(path, &s)
}

pub fn read_json<T: DeserializeOwned>(path: &Path) -> AppResult<Option<T>> {
    match read_to_string_optional(path)? {
        Some(s) => Ok(Some(serde_json::from_str(&s)?)),
        None => Ok(None),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn atomic_write_creates_parents_round_trips_and_leaves_no_tmp() {
        let dir = tempdir().unwrap();
        // A nested path whose parent does not exist yet.
        let path = dir.path().join("a/b/c/project.md");
        atomic_write_str(&path, "hello\nworld\n").unwrap();

        assert_eq!(
            read_to_string_optional(&path).unwrap().as_deref(),
            Some("hello\nworld\n")
        );
        // The sibling .tmp must have been renamed away, not left behind.
        let tmp = path.with_extension("md.tmp");
        assert!(!tmp.exists(), "temp file should not survive a successful write");
    }

    #[test]
    fn atomic_write_overwrites_existing() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("doc.md");
        atomic_write_str(&path, "first").unwrap();
        atomic_write_str(&path, "second").unwrap();
        assert_eq!(read_to_string_optional(&path).unwrap().as_deref(), Some("second"));
    }

    #[test]
    fn read_and_signature_are_none_for_missing_files() {
        let dir = tempdir().unwrap();
        let missing = dir.path().join("nope.md");
        assert_eq!(read_to_string_optional(&missing).unwrap(), None);
        assert_eq!(signature_optional(&missing).unwrap(), None);
    }

    #[test]
    fn signature_reflects_size_and_changes_on_rewrite() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("doc.md");
        atomic_write_str(&path, "abcde").unwrap();
        let (_mtime, size) = signature_optional(&path).unwrap().unwrap();
        assert_eq!(size, 5);

        atomic_write_str(&path, "abcdefghij").unwrap();
        let (_mtime2, size2) = signature_optional(&path).unwrap().unwrap();
        assert_eq!(size2, 10);
    }

    #[test]
    fn json_round_trips() {
        let dir = tempdir().unwrap();
        let path = dir.path().join(".twriter/hidden.json");
        let value = vec!["s1".to_string(), "s2".to_string()];
        write_json(&path, &value).unwrap();
        let read: Vec<String> = read_json(&path).unwrap().unwrap();
        assert_eq!(read, value);
    }

    #[test]
    fn resolve_within_accepts_an_in_tree_relative_path() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        // A target that does NOT exist yet (the write case) still resolves.
        let resolved = resolve_within(root, "drafts/note.md").unwrap();
        assert!(resolved.ends_with("drafts/note.md"));
        // It lives under the canonical root.
        assert!(resolved.starts_with(root.canonicalize().unwrap()));
    }

    #[test]
    fn resolve_within_accepts_a_bare_filename() {
        let dir = tempdir().unwrap();
        let resolved = resolve_within(dir.path(), "note.md").unwrap();
        assert!(resolved.ends_with("note.md"));
    }

    #[test]
    fn resolve_within_rejects_parent_dir_escape() {
        let dir = tempdir().unwrap();
        assert!(resolve_within(dir.path(), "../escape.md").is_err());
        assert!(resolve_within(dir.path(), "a/../../escape.md").is_err());
        assert!(resolve_within(dir.path(), "..").is_err());
    }

    #[test]
    fn resolve_within_rejects_absolute_paths() {
        let dir = tempdir().unwrap();
        #[cfg(windows)]
        {
            assert!(resolve_within(dir.path(), "C:\\Windows\\system.ini").is_err());
            assert!(resolve_within(dir.path(), "\\\\server\\share\\f").is_err());
        }
        #[cfg(unix)]
        {
            assert!(resolve_within(dir.path(), "/etc/passwd").is_err());
        }
    }

    #[test]
    fn resolve_within_rejects_nul_bytes() {
        let dir = tempdir().unwrap();
        assert!(resolve_within(dir.path(), "a\0b.md").is_err());
    }

    #[cfg(unix)]
    #[test]
    fn resolve_within_rejects_symlink_escape() {
        use std::os::unix::fs::symlink;
        let outer = tempdir().unwrap();
        let root = outer.path().join("root");
        let outside = outer.path().join("outside");
        fs::create_dir_all(&root).unwrap();
        fs::create_dir_all(&outside).unwrap();
        // A symlink INSIDE root that points OUT of root: the lexical check
        // passes (no `..`), the canonicalize re-check must catch it.
        symlink(&outside, root.join("link")).unwrap();
        assert!(resolve_within(&root, "link/passwd").is_err());
    }
}
