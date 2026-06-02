// Phase 3a — migration commands (stubs).
//
// The actual importer logic for "Phase 0 backup JSON → on-disk projects"
// lives on the JS side (src/features/migration/importer.ts), which orchestrates
// `project_create` + `snapshot_commit` calls in sequence. This Rust-side
// command is reserved for any single-shot migration helper that benefits
// from running atomically inside Rust (e.g., bulk import without round-
// tripping through the JS event loop). Phase 3g decides whether this
// command is worth implementing.

use crate::error::AppResult;
use crate::project::AppState;
use tauri::State;

#[tauri::command]
pub async fn migration_import_legacy(
    _state: State<'_, AppState>,
    _backup_json: String,
    _target_dir: String,
) -> AppResult<u32> {
    crate::error::err("migration_import_legacy — Phase 3g (may stay JS-side)")
}
