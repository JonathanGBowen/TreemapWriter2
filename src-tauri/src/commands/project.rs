// Phase 3a — project lifecycle commands (stubs).
//
// Real implementations land in Phase 3b. For now these compile but return
// "unimplemented" errors when called, except `project_list_recent` which
// returns an empty Vec so the JS-side recent-list can render an empty state.

use crate::error::AppResult;
use crate::project::AppState;
use crate::types::ProjectMeta;
use std::path::PathBuf;
use tauri::State;

#[tauri::command]
pub async fn project_create(
    _state: State<'_, AppState>,
    _path: PathBuf,
    _name: String,
) -> AppResult<ProjectMeta> {
    crate::error::err("project_create — Phase 3b")
}

#[tauri::command]
pub async fn project_open(
    _state: State<'_, AppState>,
    _path: PathBuf,
) -> AppResult<ProjectMeta> {
    crate::error::err("project_open — Phase 3b")
}

#[tauri::command]
pub async fn project_close(_state: State<'_, AppState>) -> AppResult<()> {
    crate::error::err("project_close — Phase 3b")
}

#[tauri::command]
pub async fn project_list_recent(
    _state: State<'_, AppState>,
) -> AppResult<Vec<ProjectMeta>> {
    Ok(Vec::new())
}

#[tauri::command]
pub async fn project_delete_recent(
    _state: State<'_, AppState>,
    _id: String,
) -> AppResult<()> {
    crate::error::err("project_delete_recent — Phase 3b")
}
