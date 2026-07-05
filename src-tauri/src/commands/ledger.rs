// The Ledger (Arpeggio Phase 3) — read/write the `.twriter/ledger/` sidecar.
//
// One YAML file per entry (`<id>.yaml`), mirroring the sessions sidecar but with
// the entry kept OPAQUE (`serde_json::Value`): the TS layer owns the LedgerEntry
// shape, so a sparse/evolving schema can never reject a write (the 2026-06-24
// serde lesson), and an unrecognised field survives a round-trip. Per-entry files
// are merge-friendly across machines. `id` doubles as the filename stem, so the
// list sorts by stem (an opaque Value has no typed `.id` to sort on).

use crate::error::AppResult;
use crate::project::{AppState, Layout};
use tauri::State;

/// List every ledger entry, newest first (by filename stem). Tolerant: a corrupt
/// file is skipped rather than failing the whole list.
pub fn ledger_list_from(layout: &Layout) -> AppResult<Vec<serde_json::Value>> {
    let dir = layout.ledger_dir();
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut rows: Vec<(String, serde_json::Value)> = Vec::new();
    for entry in std::fs::read_dir(&dir)? {
        let entry = entry?;
        let path = entry.path();
        if !path.is_file() || path.extension().and_then(|s| s.to_str()) != Some("yaml") {
            continue;
        }
        let stem = match path.file_stem().and_then(|s| s.to_str()) {
            Some(s) => s.to_string(),
            None => continue,
        };
        match crate::fs_io::yaml::read_yaml::<serde_json::Value>(&path) {
            Ok(Some(v)) => rows.push((stem, v)),
            _ => continue,
        }
    }
    // Newest first; ids are sortable hyphenated ISO timestamps.
    rows.sort_by(|a, b| b.0.cmp(&a.0));
    Ok(rows.into_iter().map(|(_, v)| v).collect())
}

pub fn ledger_save_to(layout: &Layout, id: &str, entry: &serde_json::Value) -> AppResult<()> {
    std::fs::create_dir_all(layout.ledger_dir())?;
    crate::fs_io::yaml::write_yaml(&layout.ledger_yaml(id), entry)
}

pub fn ledger_delete_from(layout: &Layout, id: &str) -> AppResult<()> {
    let path = layout.ledger_yaml(id);
    if path.exists() {
        std::fs::remove_file(path)?;
    }
    Ok(())
}

#[tauri::command]
pub async fn ledger_list(state: State<'_, AppState>) -> AppResult<Vec<serde_json::Value>> {
    state.with_current(|h| ledger_list_from(&h.layout))
}

#[tauri::command]
pub async fn ledger_save(
    state: State<'_, AppState>,
    id: String,
    entry: serde_json::Value,
) -> AppResult<()> {
    state.with_current(|h| ledger_save_to(&h.layout, &id, &entry))
}

#[tauri::command]
pub async fn ledger_delete(state: State<'_, AppState>, id: String) -> AppResult<()> {
    state.with_current(|h| ledger_delete_from(&h.layout, &id))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn ledger_round_trips_and_sorts_newest_first() {
        let dir = tempdir().unwrap();
        let layout = Layout::new(dir.path());

        assert!(ledger_list_from(&layout).unwrap().is_empty()); // no dir yet → []

        let older = serde_json::json!({
            "id": "2026-07-01T09-00-00", "kind": "iou", "openedAtSectionId": "intro-0",
            "owes": "define constitutive luck", "status": "open", "createdBy": "system",
            "createdAt": "2026-07-01T09-00-00", "modifiedAt": "2026-07-01T09-00-00"
        });
        let newer = serde_json::json!({
            "id": "2026-07-03T10-00-00", "kind": "declared-heap", "openedAtSectionId": "appendix-9",
            "owes": "case studies are an honest heap", "status": "open", "createdBy": "user",
            "createdAt": "2026-07-03T10-00-00", "modifiedAt": "2026-07-03T10-00-00"
        });
        ledger_save_to(&layout, "2026-07-01T09-00-00", &older).unwrap();
        ledger_save_to(&layout, "2026-07-03T10-00-00", &newer).unwrap();

        let list = ledger_list_from(&layout).unwrap();
        assert_eq!(list.len(), 2);
        assert_eq!(list[0], newer); // newest first
        assert_eq!(list[1], older);

        ledger_delete_from(&layout, "2026-07-01T09-00-00").unwrap();
        let after = ledger_list_from(&layout).unwrap();
        assert_eq!(after.len(), 1);
        assert_eq!(after[0], newer);
    }
}
