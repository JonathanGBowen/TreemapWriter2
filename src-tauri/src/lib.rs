// Phase 2 — Tauri shell. Phase 3 — repository commands wire the dissertation
// to disk: SQLite cache + markdown + YAML sidecars + git history.
//
// AppState holds the global recent-projects DB and (when one is open) the
// current project's git repo + per-project SQLite cache. All persistence
// flows through `commands/`, never through plugins exposed to JS — the
// architectural rule "components never call invoke() directly" is enforced
// by giving the JS side typed wrappers in `src/services/tauri-repository.ts`.

mod commands;
mod db;
mod error;
mod fs_io;
mod git;
mod project;
mod types;

use serde::Serialize;

#[derive(Serialize)]
struct AppInfo {
    name: String,
    version: String,
    tauri_version: String,
}

#[tauri::command]
fn app_info() -> AppInfo {
    AppInfo {
        name: env!("CARGO_PKG_NAME").to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        tauri_version: tauri::VERSION.to_string(),
    }
}

/// Load `src-tauri/.env.local` into the process environment at startup so the
/// keyring env-fallback (see commands/credentials.rs) can serve API keys from
/// it. This is a dev/first-run convenience — a packaged binary has no
/// `.env.local` next to it, so production relies on the OS keyring. A real env
/// var already set in the environment is never overridden.
fn load_env_local() {
    let candidates = [
        std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(".env.local"),
        std::path::PathBuf::from(".env.local"),
        std::path::PathBuf::from("src-tauri/.env.local"),
    ];
    for path in candidates {
        if let Ok(contents) = std::fs::read_to_string(&path) {
            for line in contents.lines() {
                let line = line.trim();
                if line.is_empty() || line.starts_with('#') {
                    continue;
                }
                if let Some((k, v)) = line.split_once('=') {
                    let key = k.trim().trim_matches('"').trim_matches('\'');
                    let val = v.trim().trim_matches('"').trim_matches('\'');
                    if key.is_empty() || val.is_empty() {
                        continue;
                    }
                    if std::env::var_os(key).is_none() {
                        std::env::set_var(key, val);
                    }
                }
            }
            return;
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    load_env_local();

    let app_state = project::AppState::new()
        .expect("failed to initialize TreemapWriter AppState (recent-projects DB)");

    tauri::Builder::default()
        .manage(app_state)
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_info,
            // commands/project.rs
            commands::project::project_create,
            commands::project::project_open,
            commands::project::project_clone,
            commands::project::project_close,
            commands::project::project_list_recent,
            commands::project::project_delete_recent,
            // commands/document.rs
            commands::document::project_read,
            commands::document::project_write,
            commands::document::project_read_markdown,
            // commands/snapshot.rs
            commands::snapshot::snapshot_commit,
            commands::snapshot::snapshot_list,
            commands::snapshot::snapshot_read,
            // commands/migration.rs
            commands::migration::migration_import_legacy,
            // commands/credentials.rs (Phase 4a)
            commands::credentials::credentials_set,
            commands::credentials::credentials_get,
            commands::credentials::credentials_delete,
            // commands/sync.rs (Phase 4c)
            commands::sync::sync_state,
            commands::sync::sync_pull,
            commands::sync::sync_push,
            commands::sync::sync_resolve_merge,
            commands::sync::sync_configure_remote,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
