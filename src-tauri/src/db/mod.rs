// Phase 3a — SQLite glue.
//
// Two databases are managed here:
//   1. The per-project cache at <project>/.twriter/index.sqlite.
//      Holds derived data (sections, specs, diagnostics, FTS index).
//      Rebuildable; gitignored.
//   2. The global recent-projects index at
//      <config_dir>/twriter/recent.sqlite.
//      Holds the `projects` table only.
//
// Both share `db/schema.sql`. The bootstrap function applies the entire
// schema; CREATE TABLE IF NOT EXISTS is idempotent.

use crate::error::{AppError, AppResult};
use rusqlite::{Connection, OpenFlags};
use std::path::Path;

const SCHEMA: &str = include_str!("schema.sql");

/// Open or create a SQLite DB at `path`. Applies the schema if needed.
/// Returns the connection. Caller owns lifecycle.
pub fn open(path: &Path) -> AppResult<Connection> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let conn = Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_CREATE,
    )?;
    // Sensible defaults for a single-user DB.
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;
         PRAGMA foreign_keys = ON;",
    )?;
    conn.execute_batch(SCHEMA)?;
    Ok(conn)
}

/// Path to the global recent-projects DB. ~/.config/twriter/recent.sqlite
/// on Linux, equivalent on macOS / Windows via `dirs::config_dir`.
pub fn global_db_path() -> AppResult<std::path::PathBuf> {
    let base = dirs::config_dir().ok_or_else(|| {
        AppError::Other(anyhow::anyhow!("could not resolve OS config directory"))
    })?;
    Ok(base.join("twriter").join("recent.sqlite"))
}
