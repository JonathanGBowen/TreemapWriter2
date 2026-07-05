// Phase 3 — IPC command facades, organized by concern.
//
// Each submodule exposes #[tauri::command] functions that are registered
// in `lib.rs::run`'s `tauri::generate_handler![...]`. Keep these thin:
// the command should validate inputs, dispatch to the right module
// (project / db / git / fs_io), and translate the result into the IPC
// wire format. Business logic lives below the command layer.

pub mod agent_fs;
pub mod credentials;
pub mod document;
pub mod inbox;
pub mod ledger;
pub mod project;
pub mod search;
pub mod session;
pub mod snapshot;
pub mod sync;
