// Local-agent filesystem tools.
//
// Three commands back the bounded tool set the in-browser agent loop
// (`src/services/ai/agent/`) is allowed to call:
//   * `agent_list_files`  — enumerate readable project files (root-relative).
//   * `agent_read_file`   — read one text file anywhere under the project root.
//   * `agent_write_output`— write ONE file, and only under
//     `.twriter/agent-output/` (a gitignored scratch area). The agent can
//     touch nothing else: not `project.md`, not the specs/sessions sidecars.
//
// These accept MODEL-SUPPLIED paths, so every path goes through
// `fs_io::resolve_within` (rejects `..`, absolute paths, NUL, and symlink
// escapes). Reads are rooted at the project root; the write root is hardcoded
// to `Layout::agent_output_dir()` and is not configurable.
//
// Like `commands/search.rs`, each command grabs the paths it needs under the
// AppState lock and then does all disk I/O OFF the lock — so a slow read can
// never delay a save, and an I/O error can't poison the mutex `project_write`
// depends on.

use crate::error::{err, AppResult};
use crate::project::AppState;
use crate::types::AgentFileEntry;
use std::path::Path;
use tauri::State;

/// Cap on entries returned by a single `agent_list_files` call — keeps the IPC
/// payload bounded on a large repo.
const MAX_ENTRIES: usize = 2000;
/// Cap on a single readable file — keeps a giant file from being pulled whole
/// into a model context window.
const MAX_READ_BYTES: u64 = 2 * 1024 * 1024;
/// Recursion-depth guard for the directory walk.
const MAX_DEPTH: usize = 12;

/// List readable files under the project root (or a `subdir` within it),
/// relative to the root, with byte sizes. Skips VCS/build noise and the
/// rebuildable SQLite cache.
#[tauri::command]
pub async fn agent_list_files(
    state: State<'_, AppState>,
    subdir: Option<String>,
) -> AppResult<Vec<AgentFileEntry>> {
    let root = state.with_current(|h| Ok(h.layout.root.clone()))?;
    list_files_impl(&root, subdir.as_deref())
}

/// Read a single text file anywhere under the project root. Errors on missing
/// files, directories, non-UTF-8 (binary) content, and oversized files.
#[tauri::command]
pub async fn agent_read_file(state: State<'_, AppState>, path: String) -> AppResult<String> {
    let root = state.with_current(|h| Ok(h.layout.root.clone()))?;
    read_file_impl(&root, &path)
}

/// Write `contents` to `name` under `.twriter/agent-output/`. Returns the
/// project-relative path written. Refuses any path that escapes that directory.
#[tauri::command]
pub async fn agent_write_output(
    state: State<'_, AppState>,
    name: String,
    contents: String,
) -> AppResult<String> {
    let (output_dir, root) =
        state.with_current(|h| Ok((h.layout.agent_output_dir(), h.layout.root.clone())))?;
    write_output_impl(&output_dir, &root, &name, &contents)
}

// --- impl (testable without AppState) -------------------------------------

fn list_files_impl(root: &Path, subdir: Option<&str>) -> AppResult<Vec<AgentFileEntry>> {
    // Canonicalize once so `strip_prefix` below always matches, and so the
    // optional subdir is guarded with the same containment check as reads.
    let canon_root = root.canonicalize()?;
    let start = match subdir {
        Some(s) if !s.is_empty() => crate::fs_io::resolve_within(&canon_root, s)?,
        _ => canon_root.clone(),
    };
    let mut out = Vec::new();
    if start.is_dir() {
        walk(&canon_root, &start, 0, &mut out)?;
    }
    Ok(out)
}

fn read_file_impl(root: &Path, path: &str) -> AppResult<String> {
    let canon_root = root.canonicalize()?;
    let resolved = crate::fs_io::resolve_within(&canon_root, path)?;
    let meta = std::fs::metadata(&resolved)?;
    if meta.is_dir() {
        return err(format!("{path} is a directory, not a file"));
    }
    if meta.len() > MAX_READ_BYTES {
        return err(format!(
            "{path} is too large to read ({} bytes; limit {} bytes)",
            meta.len(),
            MAX_READ_BYTES
        ));
    }
    std::fs::read_to_string(&resolved).map_err(|e| {
        // Non-UTF-8 content reads as InvalidData; report that precisely and let
        // any other I/O error (permission, race with a delete/replace) surface
        // as itself rather than masquerading as "binary".
        if e.kind() == std::io::ErrorKind::InvalidData {
            crate::error::AppError::from(anyhow::anyhow!("{path} is not a UTF-8 text file"))
        } else {
            crate::error::AppError::from(e)
        }
    })
}

fn write_output_impl(
    output_dir: &Path,
    root: &Path,
    name: &str,
    contents: &str,
) -> AppResult<String> {
    if name.trim().is_empty() {
        return err("output filename must not be empty");
    }
    // Create the write root first so `resolve_within` can canonicalize it.
    std::fs::create_dir_all(output_dir)?;
    let resolved = crate::fs_io::resolve_within(output_dir, name)?;
    if resolved.is_dir() {
        return err(format!("{name} names a directory, not a file"));
    }
    crate::fs_io::atomic_write_str(&resolved, contents)?;

    // Friendly, project-relative confirmation path (forward slashes).
    let canon_root = root.canonicalize().unwrap_or_else(|_| root.to_path_buf());
    let rel = resolved.strip_prefix(&canon_root).unwrap_or(&resolved);
    Ok(rel.to_string_lossy().replace('\\', "/"))
}

fn is_ignored_dir(name: &str) -> bool {
    matches!(name, ".git" | "node_modules" | "target" | "dist" | "build")
}

fn is_ignored_file(name: &str) -> bool {
    // The rebuildable SQLite cache + its WAL/SHM sidecars; OS cruft.
    name.starts_with("index.sqlite") || name == ".DS_Store"
}

fn walk(root: &Path, dir: &Path, depth: usize, out: &mut Vec<AgentFileEntry>) -> AppResult<()> {
    if depth > MAX_DEPTH || out.len() >= MAX_ENTRIES {
        return Ok(());
    }
    let mut entries: Vec<_> = std::fs::read_dir(dir)?.collect::<Result<Vec<_>, _>>()?;
    entries.sort_by_key(|e| e.file_name());
    for entry in entries {
        if out.len() >= MAX_ENTRIES {
            break;
        }
        let name = entry.file_name();
        let name_str = name.to_string_lossy();
        // `file_type()` does not follow symlinks, so symlinked files/dirs are
        // neither is_dir nor is_file here and are skipped — a safe default.
        let file_type = entry.file_type()?;
        if file_type.is_dir() {
            if is_ignored_dir(&name_str) {
                continue;
            }
            walk(root, &entry.path(), depth + 1, out)?;
        } else if file_type.is_file() {
            if is_ignored_file(&name_str) {
                continue;
            }
            let path = entry.path();
            let rel = path.strip_prefix(root).unwrap_or(&path);
            out.push(AgentFileEntry {
                path: rel.to_string_lossy().replace('\\', "/"),
                size: entry.metadata()?.len(),
            });
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    fn touch(path: &Path, contents: &str) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, contents).unwrap();
    }

    #[test]
    fn lists_files_relative_to_root_and_skips_noise() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        touch(&root.join("project.md"), "# doc");
        touch(&root.join(".twriter/agent-output/draft.md"), "draft");
        touch(&root.join(".twriter/index.sqlite"), "binary-cache");
        touch(&root.join(".git/HEAD"), "ref: refs/heads/main");
        touch(&root.join("node_modules/pkg/index.js"), "x");

        let listed = list_files_impl(root, None).unwrap();
        let paths: Vec<&str> = listed.iter().map(|e| e.path.as_str()).collect();

        assert!(paths.contains(&"project.md"));
        assert!(paths.contains(&".twriter/agent-output/draft.md"));
        // Noise is excluded.
        assert!(!paths.iter().any(|p| p.starts_with(".git/")));
        assert!(!paths.iter().any(|p| p.starts_with("node_modules/")));
        assert!(!paths.iter().any(|p| p.contains("index.sqlite")));
    }

    #[test]
    fn reads_text_and_rejects_escape_dir_and_missing() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        touch(&root.join("notes/a.md"), "hello");
        fs::create_dir_all(root.join("sub")).unwrap();

        assert_eq!(read_file_impl(root, "notes/a.md").unwrap(), "hello");
        assert!(read_file_impl(root, "../escape").is_err());
        assert!(read_file_impl(root, "sub").is_err(), "directory is not readable as a file");
        assert!(read_file_impl(root, "nope.md").is_err(), "missing file errors");
    }

    #[test]
    fn reads_reject_non_utf8_with_a_clear_message() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        // Invalid UTF-8 bytes — read_to_string yields ErrorKind::InvalidData.
        fs::write(root.join("blob.bin"), [0xff, 0xfe, 0x00, 0x9c]).unwrap();
        let err = read_file_impl(root, "blob.bin").unwrap_err();
        assert!(
            err.to_string().contains("not a UTF-8 text file"),
            "got: {err}"
        );
    }

    #[test]
    fn writes_only_under_agent_output_and_rejects_escape() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        // Mirror the real layout: the write root is .twriter/agent-output.
        let output_dir = root.join(".twriter/agent-output");

        let rel = write_output_impl(&output_dir, root, "draft.md", "body").unwrap();
        assert_eq!(rel, ".twriter/agent-output/draft.md");
        assert_eq!(
            fs::read_to_string(output_dir.join("draft.md")).unwrap(),
            "body"
        );

        // Nested subpath inside the output dir is fine.
        write_output_impl(&output_dir, root, "notes/todo.md", "x").unwrap();
        assert!(output_dir.join("notes/todo.md").is_file());

        // Escapes are refused — and crucially, project.md is never reachable.
        assert!(write_output_impl(&output_dir, root, "../../project.md", "PWNED").is_err());
        assert!(write_output_impl(&output_dir, root, "", "x").is_err());
    }
}
