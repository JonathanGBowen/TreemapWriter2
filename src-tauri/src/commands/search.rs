// Full-text search commands (FTS5 over the per-project cache).
//
// Two commands, deliberately split from the document save path:
//   * `index_sections` — rebuild the search index from the section tree the
//     frontend already parsed. Triggered on project-open / after edits settle,
//     NEVER from inside `project_write` (commands/document.rs). It reads only
//     the cache PATH under the AppState lock, then rebuilds on a SEPARATE
//     connection — so it never holds the lock a save takes, and can neither
//     block a save nor poison its mutex. WAL mode makes the concurrent
//     connection safe (saves never touch the cache anyway).
//   * `search_sections` — sanitized FTS5 MATCH, ranked hits. Reads the cache
//     under the AppState lock; wrapped in catch_unwind so a search bug can
//     never poison that lock and brick saves (the lock uses `.expect()`).
//
// Both wrap their work in catch_unwind: a panic in derived-cache code must
// never reach the document save path. The cache is rebuildable, so degrading
// to "no index / no results" is always preferable to endangering a save.

use crate::error::AppResult;
use crate::project::AppState;
use crate::types::{SearchHit, SectionInput};
use tauri::State;

/// Rebuild the per-project search index from `sections` (the frontend's
/// already-parsed, live section tree). Best-effort and panic-safe; runs off the
/// AppState lock so a save is never delayed by indexing.
#[tauri::command]
pub async fn index_sections(
    state: State<'_, AppState>,
    sections: Vec<SectionInput>,
) -> AppResult<()> {
    // Hold the AppState lock only long enough to read the cache path, then
    // release it. The heavy rebuild happens afterwards on its own connection.
    let cache_path = state.with_current(|h| Ok(h.layout.cache_sqlite()))?;

    // A parse/SQL panic is caught and logged, never propagated. Because the
    // rebuild is off the AppState lock, a panic here also can't poison the
    // mutex that project_write depends on.
    let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let conn = crate::db::raw_open(&cache_path)?;
        crate::db::index::rebuild_index(&conn, &sections)
    }));
    match outcome {
        Ok(result) => result,
        Err(_) => {
            log::error!(
                "section indexing panicked; cache left as-is (rebuildable, saves unaffected)"
            );
            Ok(())
        }
    }
}

/// Full-text search over indexed sections. Returns ranked hits (best first).
/// `limit` defaults to 50 and is capped at 200. Empty / operator-only queries
/// return `[]` without touching the DB.
#[tauri::command]
pub async fn search_sections(
    state: State<'_, AppState>,
    query: String,
    limit: Option<u32>,
) -> AppResult<Vec<SearchHit>> {
    let limit = limit.unwrap_or(50).min(200);
    state.with_current(|h| {
        // Catch any panic inside the guard so it drops normally — a search bug
        // must never poison the lock that every save acquires.
        let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            crate::db::index::search(&h.cache, &query, limit)
        }));
        match outcome {
            Ok(result) => result,
            Err(_) => {
                log::error!("section search panicked; returning no results (saves unaffected)");
                Ok(Vec::new())
            }
        }
    })
}
