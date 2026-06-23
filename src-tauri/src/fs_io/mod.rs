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
use std::path::Path;

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
}
