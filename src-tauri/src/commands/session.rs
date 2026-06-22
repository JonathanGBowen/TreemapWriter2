// Session ceremony — read/write the `.twriter/sessions/` sidecar.
//
// One YAML file per writing session (`<id>.yaml`, where `id` is the hyphenated
// ISO start timestamp). Dedicated commands keep session writes off the document
// autosave cycle: `session_save` writes a single record, `session_list` walks
// the directory newest-first. The records ride git history like the spec
// sidecars; the file lifecycle (start partial → end complete) is orchestrated
// from the TS session-state slice.

use crate::error::AppResult;
use crate::project::AppState;
use crate::types::SessionRecord;
use tauri::State;

#[tauri::command]
pub async fn session_list(state: State<'_, AppState>) -> AppResult<Vec<SessionRecord>> {
    state.with_current(|h| {
        let dir = h.layout.sessions_dir();
        if !dir.exists() {
            return Ok(Vec::new());
        }
        let mut out = Vec::new();
        for entry in std::fs::read_dir(&dir)? {
            let entry = entry?;
            let path = entry.path();
            if !path.is_file()
                || path.extension().and_then(|s| s.to_str()) != Some("yaml")
            {
                continue;
            }
            // Tolerate a corrupt record (skip it) rather than failing the list.
            match crate::fs_io::yaml::read_yaml::<SessionRecord>(&path) {
                Ok(Some(rec)) => out.push(rec),
                _ => continue,
            }
        }
        // Newest first; ids are sortable hyphenated ISO timestamps.
        out.sort_by(|a, b| b.id.cmp(&a.id));
        Ok(out)
    })
}

#[tauri::command]
pub async fn session_save(
    state: State<'_, AppState>,
    record: SessionRecord,
) -> AppResult<()> {
    state.with_current(|h| {
        std::fs::create_dir_all(h.layout.sessions_dir())?;
        crate::fs_io::yaml::write_yaml(&h.layout.session_yaml(&record.id), &record)
    })
}
