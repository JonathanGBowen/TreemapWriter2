// Phase 3a — document read/write commands (stubs).
// Real implementations land in Phase 3c.

use crate::error::AppResult;
use crate::project::AppState;
use crate::types::StoredProjectData;
use tauri::State;

#[tauri::command]
pub async fn project_read(
    _state: State<'_, AppState>,
) -> AppResult<StoredProjectData> {
    crate::error::err("project_read — Phase 3c")
}

#[tauri::command]
pub async fn project_write(
    _state: State<'_, AppState>,
    _data: StoredProjectData,
) -> AppResult<()> {
    crate::error::err("project_write — Phase 3c")
}
