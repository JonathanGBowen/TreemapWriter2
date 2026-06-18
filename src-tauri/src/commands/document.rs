// Phase 3c — read and write the on-disk project.
//
// project_read assembles a StoredProjectData by walking the project folder:
//   project.md            → markdown
//   .twriter/settings.json → projectName, activePersonaId
//   .twriter/personas.json → customPersonas
//   .twriter/prompts.json  → promptsConfig
//   .twriter/models.json   → modelsConfig (per-call model choices; no secrets)
//   .twriter/hidden.json   → hiddenSectionIds
//   .twriter/uistate.json  → uiState
//   .twriter/specs/*.yaml  → testSuite (one entry per section id)
//
// project_write does the inverse, writing each piece atomically. The orphan
// policy is "leave on disk": YAML files whose section IDs disappeared from
// the current testSuite are NOT deleted — they survive section renames and
// undo cycles. A future "Compact orphaned specs" admin command may garbage-
// collect them.

use crate::error::AppResult;
use crate::project::{AppState, Layout};
use crate::types::{
    DiskSignature, MarkdownDelta, PersistedTestEntry, Persona, PromptsConfig, StoredProjectData,
    TestSuite, UiState,
};
use std::path::PathBuf;
use tauri::State;

#[tauri::command]
pub async fn project_read(state: State<'_, AppState>) -> AppResult<StoredProjectData> {
    state.with_current(|h| read_from(&h.layout))
}

#[tauri::command]
pub async fn project_write(
    state: State<'_, AppState>,
    data: StoredProjectData,
) -> AppResult<()> {
    state.with_current(|h| write_to(&h.layout, &data))
}

/// Read the open project's `project.md` only if it changed on disk since the
/// caller's last-known signature. Stats the file (cheap); `content` comes back
/// `Some` only when the signature differs from `known` (or `known` is `None`),
/// so an unchanged file costs a stat and a ~16-byte response instead of
/// transferring the whole document. Used to detect edits made to the file
/// outside the app on window focus.
#[tauri::command]
pub async fn project_read_markdown_if_changed(
    state: State<'_, AppState>,
    known: Option<DiskSignature>,
) -> AppResult<MarkdownDelta> {
    state.with_current(|h| {
        let path = h.layout.project_md();
        let signature = crate::fs_io::signature_optional(&path)?
            .map(|(mtime_ms, size)| DiskSignature { mtime_ms, size });
        let content = match signature {
            Some(sig) if known != Some(sig) => crate::fs_io::read_to_string_optional(&path)?,
            _ => None,
        };
        Ok(MarkdownDelta { signature, content })
    })
}

fn read_from(layout: &Layout) -> AppResult<StoredProjectData> {
    let markdown = crate::fs_io::read_to_string_optional(&layout.project_md())?;

    // settings.json — { name, schemaVersion, activePersonaId }
    let settings_json: Option<serde_json::Value> =
        crate::fs_io::read_json(&layout.settings_json())?;
    let project_name = settings_json
        .as_ref()
        .and_then(|v| v.get("name"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let active_persona_id = settings_json
        .as_ref()
        .and_then(|v| v.get("activePersonaId"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let custom_personas: Option<Vec<Persona>> =
        crate::fs_io::read_json(&layout.personas_json())?;
    let prompts_config: Option<PromptsConfig> =
        crate::fs_io::read_json(&layout.prompts_json())?;
    let models_config: Option<serde_json::Value> =
        crate::fs_io::read_json(&layout.models_json())?;
    let hidden_section_ids: Option<Vec<String>> =
        crate::fs_io::read_json(&layout.hidden_json())?;
    let ui_state: Option<UiState> = crate::fs_io::read_json(&layout.uistate_json())?;

    let test_suite = read_specs(&layout)?;

    Ok(StoredProjectData {
        project_name,
        markdown,
        local_draft: None, // The draft/committed split is browser-only post-Phase-3.
        test_suite: if test_suite.is_empty() {
            None
        } else {
            Some(test_suite)
        },
        hidden_section_ids,
        active_persona_id,
        custom_personas,
        prompts_config,
        interpolation_config: None, // legacy alias; importer normalizes
        models_config,
        cached_coach_advice: None,  // ephemeral
        revisions: None,            // populated by snapshot_list in Phase 3d
        last_modified: Some(epoch_ms_now()),
        ui_state,
    })
}

fn write_to(layout: &Layout, data: &StoredProjectData) -> AppResult<()> {
    // markdown
    if let Some(md) = &data.markdown {
        crate::fs_io::atomic_write_str(&layout.project_md(), md)?;
    }

    // settings.json
    let mut settings = serde_json::json!({ "schemaVersion": 1 });
    if let Some(n) = &data.project_name {
        settings["name"] = serde_json::Value::String(n.clone());
    }
    if let Some(p) = &data.active_persona_id {
        settings["activePersonaId"] = serde_json::Value::String(p.clone());
    }
    crate::fs_io::write_json(&layout.settings_json(), &settings)?;

    // Sidecar JSON files; only written when the corresponding field is set.
    if let Some(personas) = &data.custom_personas {
        crate::fs_io::write_json(&layout.personas_json(), personas)?;
    }
    if let Some(pc) = &data.prompts_config {
        crate::fs_io::write_json(&layout.prompts_json(), pc)?;
    }
    if let Some(mc) = &data.models_config {
        crate::fs_io::write_json(&layout.models_json(), mc)?;
    }
    if let Some(ids) = &data.hidden_section_ids {
        crate::fs_io::write_json(&layout.hidden_json(), ids)?;
    }
    if let Some(ui) = &data.ui_state {
        crate::fs_io::write_json(&layout.uistate_json(), ui)?;
    }

    // Per-section YAML specs. Orphans (yaml files with no entry in the
    // current testSuite) are LEFT ON DISK — they survive section renames
    // and undo cycles. A future admin command can compact them.
    if let Some(suite) = &data.test_suite {
        std::fs::create_dir_all(layout.specs_dir())?;
        for (section_id, entry) in suite {
            let persisted = PersistedTestEntry::from_entry(entry);
            crate::fs_io::yaml::write_yaml(&layout.spec_yaml(section_id), &persisted)?;
        }
    }

    Ok(())
}

fn read_specs(layout: &Layout) -> AppResult<TestSuite> {
    let specs_dir = layout.specs_dir();
    if !specs_dir.exists() {
        return Ok(TestSuite::new());
    }
    let mut suite = TestSuite::new();
    for entry in std::fs::read_dir(specs_dir)? {
        let entry = entry?;
        let path = entry.path();
        if !is_spec_yaml(&path) {
            continue;
        }
        let section_id = match section_id_from_filename(&path) {
            Some(id) => id,
            None => continue,
        };
        let persisted: Option<PersistedTestEntry> = crate::fs_io::yaml::read_yaml(&path)?;
        if let Some(p) = persisted {
            suite.insert(section_id, p.into_entry());
        }
    }
    Ok(suite)
}

fn is_spec_yaml(p: &PathBuf) -> bool {
    p.is_file()
        && p.file_name()
            .and_then(|s| s.to_str())
            .map(|n| n.ends_with(".spec.yaml"))
            .unwrap_or(false)
}

fn section_id_from_filename(p: &PathBuf) -> Option<String> {
    let name = p.file_name()?.to_str()?;
    name.strip_suffix(".spec.yaml").map(|s| s.to_string())
}

fn epoch_ms_now() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}
