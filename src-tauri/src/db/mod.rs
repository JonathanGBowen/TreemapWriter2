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

pub mod index;

const SCHEMA: &str = include_str!("schema.sql");

/// Open or create a SQLite DB at `path`, apply pragmas, and apply the full
/// schema. Used for the global recent-projects DB. For the per-project cache
/// use [`index::open_cache`], which adds schema-version checking and
/// rebuild-on-mismatch on top of this.
pub fn open(path: &Path) -> AppResult<Connection> {
    let conn = raw_open(path)?;
    apply_schema(&conn)?;
    Ok(conn)
}

/// Open or create the DB and apply pragmas, WITHOUT applying the schema. Lets
/// the cache layer inspect an existing DB (its stored schema version, its FTS
/// integrity) before deciding whether to keep or rebuild it.
pub fn raw_open(path: &Path) -> AppResult<Connection> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let conn = Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_CREATE,
    )?;
    // Sensible defaults for a single-user DB. `busy_timeout` lets a momentary
    // write-lock conflict (a concurrent index write, or an AV/indexer touching
    // the file) wait-and-retry instead of failing immediately with SQLITE_BUSY.
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;
         PRAGMA foreign_keys = ON;
         PRAGMA busy_timeout = 5000;",
    )?;
    Ok(conn)
}

/// Apply the full schema. Idempotent (every statement is `… IF NOT EXISTS`).
pub fn apply_schema(conn: &Connection) -> AppResult<()> {
    conn.execute_batch(SCHEMA)?;
    Ok(())
}

/// Path to the global recent-projects DB. ~/.config/twriter/recent.sqlite
/// on Linux, equivalent on macOS / Windows via `dirs::config_dir`.
pub fn global_db_path() -> AppResult<std::path::PathBuf> {
    let base = dirs::config_dir().ok_or_else(|| {
        AppError::Other(anyhow::anyhow!("could not resolve OS config directory"))
    })?;
    Ok(base.join("twriter").join("recent.sqlite"))
}
