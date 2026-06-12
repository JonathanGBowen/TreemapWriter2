// Phase 4c — sync Tauri commands.
//
// Thin facades over the git::remote module (auth + state) and the keyring
// (PAT lookup). Pattern matches commands/snapshot.rs: take AppState, dispatch
// via state.with_current, return wire-format types.

use crate::error::{err, AppResult};
use crate::project::AppState;
use crate::types::{PullOutcome, PushOutcome, Resolution, ResolveOutcome, SyncState};
use tauri::State;

const GIT_TOKEN_SERVICE: &str = "git";

#[tauri::command]
pub async fn sync_state(state: State<'_, AppState>) -> AppResult<SyncState> {
    state.with_current(|h| crate::git::remote::sync_state(&h.git))
}

#[tauri::command]
pub async fn sync_pull(state: State<'_, AppState>) -> AppResult<PullOutcome> {
    let token = read_git_token()?;
    state.with_current(|h| crate::git::remote::pull(&h.git, &token))
}

#[tauri::command]
pub async fn sync_push(state: State<'_, AppState>) -> AppResult<PushOutcome> {
    let token = read_git_token()?;
    state.with_current(|h| crate::git::remote::push(&h.git, &token))
}

/// Apply the user's per-file conflict choices and create the merge commit.
/// `their_commit`/`base_head` are echoed back from the `MergeRequired` outcome.
#[tauri::command]
pub async fn sync_resolve_merge(
    state: State<'_, AppState>,
    their_commit: String,
    base_head: String,
    resolutions: Vec<Resolution>,
) -> AppResult<ResolveOutcome> {
    state.with_current(|h| {
        crate::git::merge::resolve(&h.git, &their_commit, &base_head, &resolutions)
    })
}

#[tauri::command]
pub async fn sync_configure_remote(
    state: State<'_, AppState>,
    url: String,
) -> AppResult<()> {
    state.with_current(|h| {
        // Update the git config's `origin` remote.
        crate::git::remote::configure_remote(&h.git, &url)?;

        // Mirror to .twriter/settings.json so the URL travels with the
        // project folder (someone cloning on a second machine will see
        // their remote already configured by git itself, but the settings
        // file is the human-readable record of intent).
        let path = h.layout.settings_json();
        let mut settings = match crate::fs_io::read_json::<serde_json::Value>(&path)? {
            Some(serde_json::Value::Object(map)) => map,
            _ => serde_json::Map::new(),
        };
        settings.insert(
            "gitRemoteUrl".to_string(),
            serde_json::Value::String(url.clone()),
        );
        let merged = serde_json::Value::Object(settings);
        crate::fs_io::write_json(&path, &merged)?;
        Ok(())
    })
}

fn read_git_token() -> AppResult<String> {
    let entry = keyring::Entry::new("treemap-writer", GIT_TOKEN_SERVICE)?;
    match entry.get_password() {
        Ok(token) => Ok(token),
        Err(keyring::Error::NoEntry) => {
            err("No GitHub PAT configured. Open the Configure Sync modal to set one.")
        }
        Err(e) => Err(e.into()),
    }
}
