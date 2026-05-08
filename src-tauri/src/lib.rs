// Phase 2 — minimal Tauri shell. The app runs as a desktop window wrapping
// the existing React UI. No persistence is delegated here yet (the JS side
// continues to use IndexedDB via browserRepository); Phase 3 will add
// SQLite + git + filesystem commands.
//
// `app_info` is exposed only as a sanity check that JS↔Rust IPC works end
// to end. Once Phase 3 lands a real Repository in Rust, this command stays
// useful as a "Tauri vs browser" environment probe — see
// `src/services/tauri-environment.ts`.

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
        .invoke_handler(tauri::generate_handler![app_info])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
