// Phase 4a — OS keyring credential commands.
//
// Secrets (git PAT, Gemini API key) live in the OS secret store: Windows
// Credential Manager, macOS Keychain, Linux Secret Service. The `service`
// argument is a short identifier ("git", "gemini") that becomes the entry
// name; the constant prefix below namespaces it under "treemap-writer".
//
// The JS side calls these via `src/services/credentials.ts`. Components
// never invoke() directly.

use crate::error::AppResult;

const KEYRING_USER: &str = "treemap-writer";

fn entry(service: &str) -> AppResult<keyring::Entry> {
    Ok(keyring::Entry::new(KEYRING_USER, service)?)
}

#[tauri::command]
pub async fn credentials_set(service: String, value: String) -> AppResult<()> {
    entry(&service)?.set_password(&value)?;
    Ok(())
}

#[tauri::command]
pub async fn credentials_get(service: String) -> AppResult<Option<String>> {
    match entry(&service)?.get_password() {
        Ok(v) => Ok(Some(v)),
        // Fall back to a process env var (loaded from src-tauri/.env.local at
        // startup). This is the desktop fallback that makes `.env.local` work
        // without re-entering the key each session, and keeps the secret out of
        // the JS bundle. Only AI keys have a fallback; git PATs do not.
        Err(keyring::Error::NoEntry) => Ok(env_fallback(&service)),
        Err(e) => Err(e.into()),
    }
}

fn env_fallback(service: &str) -> Option<String> {
    let var = match service {
        "gemini" => "GEMINI_API_KEY",
        "anthropic" => "ANTHROPIC_API_KEY",
        _ => return None,
    };
    std::env::var(var).ok().filter(|v| !v.is_empty())
}

#[tauri::command]
pub async fn credentials_delete(service: String) -> AppResult<()> {
    match entry(&service)?.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.into()),
    }
}
