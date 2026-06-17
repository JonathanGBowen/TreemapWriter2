// Phase 3b — project lifecycle commands.
//
// Each command is the entry point for one user-facing intent. Bodies stay
// small: validate inputs, dispatch to project / db / git modules, return.
// Business logic lives below the command layer.

use crate::error::{err, AppResult};
use crate::project::{AppState, Layout, ProjectHandle};
use crate::types::ProjectMeta;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

/// Create a new project at `path`. The path must not exist OR must be an
/// empty directory; the command refuses to clobber non-empty folders. On
/// success: opens the project as the current handle, inserts a row in the
/// global recent-projects DB, returns the project's metadata.
#[tauri::command]
pub async fn project_create(
    state: State<'_, AppState>,
    path: PathBuf,
    name: String,
) -> AppResult<ProjectMeta> {
    validate_create_target(&path)?;

    std::fs::create_dir_all(&path)?;
    let layout = Layout::new(&path);

    // .gitignore — keep the SQLite cache + diagnostics out of git history.
    crate::fs_io::atomic_write_str(
        &layout.gitignore(),
        ".twriter/index.sqlite\n.twriter/index.sqlite-journal\n.twriter/index.sqlite-wal\n.twriter/diagnostics.json\n",
    )?;

    // Empty markdown file. The user (or the importer) writes real prose later.
    crate::fs_io::atomic_write_str(&layout.project_md(), "")?;

    // Bootstrap settings.json with the chosen name and a schema marker.
    std::fs::create_dir_all(layout.twriter_dir())?;
    std::fs::create_dir_all(layout.specs_dir())?;
    let settings = serde_json::json!({
        "name": name,
        "schemaVersion": 1,
        "activePersonaId": "default",
    });
    crate::fs_io::write_json(&layout.settings_json(), &settings)?;

    // Init git, commit the initial state.
    let git = crate::git::init(&path)?;
    crate::git::ensure_initial_commit(&git, "Initial commit")?;

    // Open the cache and become the current project.
    let cache = crate::db::open(&layout.cache_sqlite())?;
    let id = generate_project_id();
    let now = epoch_ms_now();
    let path_str = path.to_string_lossy().to_string();

    {
        let global = state.global.lock().expect("global DB lock");
        global.execute(
            "INSERT INTO projects (id, name, path, last_opened, word_count) VALUES (?1, ?2, ?3, ?4, 0)",
            (&id, &name, &path_str, now),
        )?;
    }

    state.set_current(Some(ProjectHandle { layout, git, cache }));

    Ok(ProjectMeta {
        id,
        name,
        last_modified: now,
        word_count: 0,
        path: Some(path_str),
    })
}

/// Open an existing project at `path`. Validates that the folder looks
/// like a TreemapWriter project (has `project.md` + `.twriter/`).
#[tauri::command]
pub async fn project_open(
    state: State<'_, AppState>,
    path: PathBuf,
) -> AppResult<ProjectMeta> {
    if !Layout::looks_like_project(&path) {
        return err(format!(
            "{} doesn't look like a TreemapWriter project (missing project.md or .twriter/)",
            path.display()
        ));
    }

    open_and_register(&state, path)
}

/// Clone an existing TreemapWriter project from a remote URL into `path`, then
/// open it as the current project. `path` must be empty or non-existent. Auth
/// uses the GitHub PAT in the OS keyring (global — no project need be open).
///
/// If the cloned repo isn't a TreemapWriter project (an empty remote, or one
/// without `project.md` / `.twriter/`), the clone is removed and the error
/// routes the user to "Create + publish" instead.
#[tauri::command]
pub async fn project_clone(
    state: State<'_, AppState>,
    url: String,
    path: PathBuf,
) -> AppResult<ProjectMeta> {
    validate_create_target(&path)?;

    let token = crate::commands::sync::read_git_token()?;
    if let Err(e) = crate::git::remote::clone(&url, &path, &token) {
        // Don't leave a half-cloned folder behind (the target was empty).
        let _ = std::fs::remove_dir_all(&path);
        return Err(e);
    }

    if !Layout::looks_like_project(&path) {
        let _ = std::fs::remove_dir_all(&path);
        return err(format!(
            "{} isn't a TreemapWriter project (an empty repo, or missing project.md / .twriter/). \
             To start a new project on this remote, use Create + publish instead.",
            url
        ));
    }

    open_and_register(&state, path)
}

/// Drop the active project handle.
#[tauri::command]
pub async fn project_close(state: State<'_, AppState>) -> AppResult<()> {
    state.set_current(None);
    Ok(())
}

/// List the most-recently-opened projects, newest first.
#[tauri::command]
pub async fn project_list_recent(
    state: State<'_, AppState>,
) -> AppResult<Vec<ProjectMeta>> {
    let global = state.global.lock().expect("global DB lock");
    let mut stmt = global.prepare(
        "SELECT id, name, path, last_opened, word_count
         FROM projects
         ORDER BY last_opened DESC
         LIMIT 50",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(ProjectMeta {
            id: row.get(0)?,
            name: row.get(1)?,
            path: Some(row.get::<_, String>(2)?),
            last_modified: row.get(3)?,
            word_count: row.get(4)?,
        })
    })?;
    let mut out = Vec::new();
    for r in rows {
        // Skip rows whose folder no longer exists; don't auto-delete (user
        // may have a removable drive unmounted) — just hide them this load.
        let meta = r?;
        if let Some(p) = &meta.path {
            if Layout::looks_like_project(std::path::Path::new(p)) {
                out.push(meta);
            }
        }
    }
    Ok(out)
}

/// Remove a recent-projects row by id. Does NOT delete the folder on disk.
#[tauri::command]
pub async fn project_delete_recent(
    state: State<'_, AppState>,
    id: String,
) -> AppResult<()> {
    let global = state.global.lock().expect("global DB lock");
    global.execute("DELETE FROM projects WHERE id = ?1", (&id,))?;
    Ok(())
}

// --- internals -----------------------------------------------------------

/// Open a validated project folder as the current handle and upsert it into the
/// recent-projects DB. Shared tail of `project_open` and `project_clone`.
fn open_and_register(state: &AppState, path: PathBuf) -> AppResult<ProjectMeta> {
    state.open_at(path.clone())?;

    let path_str = path.to_string_lossy().to_string();
    let now = epoch_ms_now();
    let (id, name, word_count) = {
        let global = state.global.lock().expect("global DB lock");
        upsert_recent_project(&global, &path_str, now)?
    };

    Ok(ProjectMeta {
        id,
        name,
        last_modified: now,
        word_count,
        path: Some(path_str),
    })
}

fn validate_create_target(path: &std::path::Path) -> AppResult<()> {
    if path.exists() {
        // Allow only if it's a directory and empty.
        if !path.is_dir() {
            return err(format!("{} exists and is not a directory", path.display()));
        }
        let mut entries = std::fs::read_dir(path)?;
        if entries.next().is_some() {
            return err(format!(
                "{} already exists and is not empty",
                path.display()
            ));
        }
    }
    Ok(())
}

fn upsert_recent_project(
    db: &rusqlite::Connection,
    path: &str,
    now_ms: i64,
) -> AppResult<(String, String, i32)> {
    // Try to update an existing row; if none, insert and re-fetch.
    let updated = db.execute(
        "UPDATE projects SET last_opened = ?1 WHERE path = ?2",
        (now_ms, path),
    )?;
    if updated == 0 {
        let id = generate_project_id();
        // Pull the project name from .twriter/settings.json if present.
        let layout = Layout::new(path);
        let name = match crate::fs_io::read_json::<serde_json::Value>(&layout.settings_json())? {
            Some(v) => v
                .get("name")
                .and_then(|n| n.as_str())
                .unwrap_or("Untitled Project")
                .to_string(),
            None => "Untitled Project".to_string(),
        };
        db.execute(
            "INSERT INTO projects (id, name, path, last_opened, word_count) VALUES (?1, ?2, ?3, ?4, 0)",
            (&id, &name, path, now_ms),
        )?;
        return Ok((id, name, 0));
    }
    let row = db.query_row(
        "SELECT id, name, word_count FROM projects WHERE path = ?1",
        (path,),
        |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?, r.get::<_, i32>(2)?)),
    )?;
    Ok(row)
}

fn epoch_ms_now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn generate_project_id() -> String {
    format!("proj_{}", epoch_ms_now())
}
