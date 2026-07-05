// The capture inbox (Arpeggio Phase 3) — read/write the `.twriter/inbox/` sidecar.
//
// One Markdown file per parked thought (`<id>.md`), the whole file IS the body
// (agent-output's per-file mechanics, but committed, not scratch). `id` is a
// sortable hyphenated ISO timestamp (doubles as the filename stem and the created
// time). `inbox_list` returns `{ id, text }` rows as opaque values; the TS layer
// reconstructs `createdAt` from the id.

use crate::error::AppResult;
use crate::project::{AppState, Layout};
use tauri::State;

pub fn inbox_list_from(layout: &Layout) -> AppResult<Vec<serde_json::Value>> {
    let dir = layout.inbox_dir();
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut rows: Vec<(String, serde_json::Value)> = Vec::new();
    for entry in std::fs::read_dir(&dir)? {
        let entry = entry?;
        let path = entry.path();
        if !path.is_file() || path.extension().and_then(|s| s.to_str()) != Some("md") {
            continue;
        }
        let stem = match path.file_stem().and_then(|s| s.to_str()) {
            Some(s) => s.to_string(),
            None => continue,
        };
        match crate::fs_io::read_to_string_optional(&path) {
            Ok(Some(text)) => rows.push((stem.clone(), serde_json::json!({ "id": stem, "text": text }))),
            _ => continue,
        }
    }
    // Newest first (a fresh capture floats to the top of the tray).
    rows.sort_by(|a, b| b.0.cmp(&a.0));
    Ok(rows.into_iter().map(|(_, v)| v).collect())
}

pub fn inbox_save_to(layout: &Layout, id: &str, text: &str) -> AppResult<()> {
    std::fs::create_dir_all(layout.inbox_dir())?;
    crate::fs_io::atomic_write_str(&layout.inbox_md(id), text)
}

pub fn inbox_delete_from(layout: &Layout, id: &str) -> AppResult<()> {
    let path = layout.inbox_md(id);
    if path.exists() {
        std::fs::remove_file(path)?;
    }
    Ok(())
}

#[tauri::command]
pub async fn inbox_list(state: State<'_, AppState>) -> AppResult<Vec<serde_json::Value>> {
    state.with_current(|h| inbox_list_from(&h.layout))
}

#[tauri::command]
pub async fn inbox_save(state: State<'_, AppState>, id: String, text: String) -> AppResult<()> {
    state.with_current(|h| inbox_save_to(&h.layout, &id, &text))
}

#[tauri::command]
pub async fn inbox_delete(state: State<'_, AppState>, id: String) -> AppResult<()> {
    state.with_current(|h| inbox_delete_from(&h.layout, &id))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn inbox_round_trips_and_sorts_newest_first() {
        let dir = tempdir().unwrap();
        let layout = Layout::new(dir.path());

        assert!(inbox_list_from(&layout).unwrap().is_empty());

        inbox_save_to(&layout, "2026-07-01T09-00-00", "an older thought").unwrap();
        inbox_save_to(&layout, "2026-07-03T10-00-00", "a newer thought").unwrap();

        let list = inbox_list_from(&layout).unwrap();
        assert_eq!(list.len(), 2);
        assert_eq!(list[0]["id"], "2026-07-03T10-00-00");
        assert_eq!(list[0]["text"], "a newer thought");
        assert_eq!(list[1]["text"], "an older thought");

        inbox_delete_from(&layout, "2026-07-03T10-00-00").unwrap();
        let after = inbox_list_from(&layout).unwrap();
        assert_eq!(after.len(), 1);
        assert_eq!(after[0]["id"], "2026-07-01T09-00-00");
    }
}
