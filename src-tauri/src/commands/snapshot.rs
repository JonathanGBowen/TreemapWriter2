// Phase 3a — snapshot (= git commit) commands (stubs).
// Real implementations land in Phase 3d.

use crate::error::AppResult;
use crate::project::AppState;
use crate::types::{Snapshot, SnapshotMeta};
use serde::Deserialize;
use tauri::State;

#[derive(Deserialize)]
pub struct CommitArgs {
    pub message: String,
    pub trigger: String,
    /// "all" | comma-separated section IDs.
    pub affected_scope: serde_json::Value,
}

#[tauri::command]
pub async fn snapshot_commit(
    _state: State<'_, AppState>,
    _args: CommitArgs,
) -> AppResult<String> {
    crate::error::err("snapshot_commit — Phase 3d")
}

#[tauri::command]
pub async fn snapshot_list(
    _state: State<'_, AppState>,
    _limit: u32,
) -> AppResult<Vec<SnapshotMeta>> {
    crate::error::err("snapshot_list — Phase 3d")
}

#[tauri::command]
pub async fn snapshot_read(
    _state: State<'_, AppState>,
    _commit_id: String,
) -> AppResult<Snapshot> {
    crate::error::err("snapshot_read — Phase 3d")
}
