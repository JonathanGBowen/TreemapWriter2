// On-demand export artifacts (e.g. .docx).
//
// The bytes are generated in the webview (markdown → HTML → docx) and the target
// path comes from the system save dialog. Unlike project files, an export is a
// derived artifact written outside the source-of-truth tree, so there's no
// project handle — just an atomic write to the chosen absolute path. This keeps
// filesystem writes behind a purpose-built command (architectural law) rather
// than exposing tauri-plugin-fs write access to the webview.

use crate::error::AppResult;
use std::path::PathBuf;

#[tauri::command]
pub async fn export_write_file(path: String, bytes: Vec<u8>) -> AppResult<()> {
    crate::fs_io::atomic_write_bytes(&PathBuf::from(path), &bytes)
}
