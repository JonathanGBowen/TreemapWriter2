// FTS5 full-text search over the per-project SQLite cache.
//
// This module owns ALL access to the cache's section/search surface — the
// architectural mirror of the existing "no git2 outside git::*" rule.
// Commands call into here; they never run cache SQL inline.
//
// Durability invariants (the SQLite cache is one of VISION.md's three named
// recovery paths, so a wrong/corrupt index degrades a safety net, not just a
// convenience):
//   * `open_cache` drops and rebuilds the cache on a schema-version mismatch
//     or a failed integrity probe, deleting ONLY the cache files — never the
//     authoritative YAML/JSON sidecars under `.twriter/`.
//   * `rebuild_index` is a whole-index rebuild inside a single transaction,
//     never an incremental delta, so the contentless FTS5 table can't drift
//     out of sync with `sections`.
//   * Indexing is invoked from its own command, never inside the document
//     save path (see commands/search.rs and commands/document.rs).

use crate::error::AppResult;
use crate::project::Layout;
use crate::types::{SearchHit, SectionInput};
use rusqlite::{params, Connection};
use std::collections::HashSet;

/// Bump when `schema.sql`'s `sections` / `sections_fts` definition changes
/// incompatibly. `open_cache` compares this against the stored
/// `schema_meta.version`; a mismatch drops and rebuilds the cache from disk.
pub const CACHE_SCHEMA_VERSION: i64 = 2;

/// Open the per-project cache, rebuilding it from scratch if the stored schema
/// version doesn't match [`CACHE_SCHEMA_VERSION`] or an integrity probe fails.
/// The rebuild deletes ONLY `index.sqlite` and its WAL/SHM sidecars (via
/// [`Layout::cache_files`]) — never the authoritative `.twriter/` sidecars.
pub fn open_cache(layout: &Layout) -> AppResult<Connection> {
    let path = layout.cache_sqlite();
    let conn = crate::db::raw_open(&path)?;
    if cache_is_current(&conn) {
        crate::db::apply_schema(&conn)?;
        write_version(&conn)?;
        return Ok(conn);
    }

    // Stale, corrupt, or brand-new: drop and rebuild. Closing the handle first
    // releases the file locks so the files can be removed (matters on Windows).
    drop(conn);
    for f in layout.cache_files() {
        // Best-effort: the cache is non-authoritative and rebuildable, so a
        // transient lock (Windows AV / Search indexer holding the file) must
        // NEVER block opening the project. Degrade the cache, never access to
        // the user's work — `apply_schema` below still yields a usable handle.
        if f.exists() {
            if let Err(e) = std::fs::remove_file(&f) {
                log::warn!("could not remove stale cache file {f:?}: {e}");
            }
        }
    }
    let conn = crate::db::raw_open(&path)?;
    crate::db::apply_schema(&conn)?;
    write_version(&conn)?;
    Ok(conn)
}

/// True if the open cache matches the current schema version AND passes a cheap
/// FTS integrity probe. Any error (missing tables on a fresh DB, version drift,
/// a corrupt index) returns false → the caller rebuilds.
fn cache_is_current(conn: &Connection) -> bool {
    let stored: Option<i64> = conn
        .query_row(
            "SELECT value FROM schema_meta WHERE key = 'version'",
            [],
            |r| r.get::<_, String>(0),
        )
        .ok()
        .and_then(|s| s.parse::<i64>().ok());
    if stored != Some(CACHE_SCHEMA_VERSION) {
        return false;
    }
    // Probe the derived tables: a SELECT over `sections` and an FTS5
    // integrity-check command. Either failing means the cache is unusable.
    conn.query_row("SELECT count(*) FROM sections", [], |r| r.get::<_, i64>(0))
        .is_ok()
        && conn
            .execute(
                "INSERT INTO sections_fts(sections_fts) VALUES('integrity-check')",
                [],
            )
            .is_ok()
}

fn write_version(conn: &Connection) -> AppResult<()> {
    conn.execute(
        "INSERT INTO schema_meta(key, value) VALUES('version', ?1)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![CACHE_SCHEMA_VERSION.to_string()],
    )?;
    Ok(())
}

/// Rebuild the entire section index in one transaction: clear `sections` and
/// the contentless `sections_fts`, then re-insert every section. Whole-index
/// (not incremental) by design — it makes FTS desync structurally impossible
/// and pairs with rebuild-on-open. Takes `&Connection` (not `&mut`) so it can
/// run through the shared handle held behind the AppState mutex.
pub fn rebuild_index(conn: &Connection, sections: &[SectionInput]) -> AppResult<()> {
    let ids: HashSet<&str> = sections.iter().map(|s| s.id.as_str()).collect();
    let tx = conn.unchecked_transaction()?;
    // Defer FK checks so parent rows may arrive in any order; validated at
    // commit. Combined with the parent-id filter below, commit always holds.
    tx.execute_batch("PRAGMA defer_foreign_keys = ON;")?;
    // ON DELETE CASCADE clears specs/diagnostics/dependencies with sections.
    tx.execute("DELETE FROM sections", [])?;
    // Plain DELETE clears a content-storing FTS5 table (the contentless-only
    // 'delete-all' command does not apply now that the table stores content).
    tx.execute("DELETE FROM sections_fts", [])?;
    {
        let mut ins_sec = tx.prepare(
            "INSERT INTO sections
               (id, parent_id, title, level, ordinal, source_file,
                start_line, end_line, word_count, content_hash)
             VALUES (?1, ?2, ?3, ?4, ?5, 'project.md', 0, 0, ?6, ?7)",
        )?;
        let mut ins_fts = tx.prepare(
            "INSERT INTO sections_fts(section_id, title, body) VALUES (?1, ?2, ?3)",
        )?;
        for s in sections {
            // Drop dangling/self parent refs so the deferred FK always validates.
            let parent = s
                .parent_id
                .as_deref()
                .filter(|p| *p != s.id && ids.contains(p));
            ins_sec.execute(params![
                s.id,
                parent,
                s.title,
                s.level,
                s.ordinal,
                s.word_count,
                content_hash(&s.content),
            ])?;
            ins_fts.execute(params![s.id, s.title, s.content])?;
        }
    }
    tx.commit()?;
    Ok(())
}

/// Run a full-text search over indexed sections, returning ranked hits (best
/// first). Empty / operator-only queries return an empty vec WITHOUT touching
/// the DB — raw input is never handed to FTS5 MATCH.
pub fn search(conn: &Connection, raw_query: &str, limit: u32) -> AppResult<Vec<SearchHit>> {
    let match_query = match sanitize_query(raw_query) {
        Some(q) => q,
        None => return Ok(Vec::new()),
    };
    // The content-storing FTS5 table holds section_id (UNINDEXED), title, and
    // body, so search reads everything it needs from it directly — no JOIN.
    // FTS5's MATCH operator and `rank` column bind to the TABLE NAME, not a SQL
    // alias (`WHERE f MATCH …` would make SQLite look for a column named `f`).
    //
    // The snippet is built by FTS5's own snippet() rather than a hand-rolled
    // scan: it shares the porter/unicode61 tokenizer, so it centers on stemmed
    // (running↔run) and case-folded (CAFÉ↔café) matches that a literal
    // substring search would miss. Column -1 lets FTS5 pick the best-matching
    // column; the empty markers keep the result plain text for the sidebar.
    let mut stmt = conn.prepare(
        "SELECT section_id, title, snippet(sections_fts, -1, '', '', '…', 10), rank
         FROM sections_fts
         WHERE sections_fts MATCH ?1
         ORDER BY rank
         LIMIT ?2",
    )?;
    let rows = stmt.query_map(params![match_query, limit], |row| {
        Ok(SearchHit {
            section_id: row.get(0)?,
            title: row.get(1)?,
            snippet: row.get(2)?,
            rank: row.get(3)?,
        })
    })?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

/// Turn arbitrary user input into a safe FTS5 MATCH expression: keep only
/// alphanumeric runs, quote each as a literal token, and AND them together.
/// This neutralizes every FTS5 operator (`AND OR NOT NEAR * : ^ " ( )`) and
/// the empty-query syntax error. Returns None when nothing searchable remains.
fn sanitize_query(raw: &str) -> Option<String> {
    let tokens: Vec<String> = raw
        .split(|c: char| !c.is_alphanumeric())
        .filter(|t| !t.is_empty())
        .map(|t| format!("\"{t}\""))
        .collect();
    if tokens.is_empty() {
        None
    } else {
        Some(tokens.join(" "))
    }
}

/// Stable, dependency-free content fingerprint for the `sections.content_hash`
/// column. Not cryptographic — only used to detect change for a rebuildable
/// cache.
fn content_hash(s: &str) -> String {
    use std::hash::{Hash, Hasher};
    let mut h = std::collections::hash_map::DefaultHasher::new();
    s.hash(&mut h);
    format!("{:016x}", h.finish())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_cache() -> (tempfile::TempDir, Connection) {
        let dir = tempfile::tempdir().unwrap();
        let layout = Layout::new(dir.path());
        let conn = open_cache(&layout).unwrap();
        (dir, conn)
    }

    fn sec(id: &str, title: &str, content: &str) -> SectionInput {
        SectionInput {
            id: id.into(),
            parent_id: None,
            title: title.into(),
            level: 1,
            ordinal: 0,
            content: content.into(),
            word_count: content.split_whitespace().count() as i64,
        }
    }

    #[test]
    fn search_returns_ranked_hits_over_body_and_title() {
        let (_d, conn) = temp_cache();
        rebuild_index(
            &conn,
            &[
                sec("intro", "Introduction", "The dissertation examines coastal erosion patterns."),
                sec("method", "Methodology", "We measured erosion with LIDAR surveys."),
                sec("concl", "Conclusion", "Tidal forces dominate the final chapter."),
            ],
        )
        .unwrap();

        let erosion = search(&conn, "erosion", 10).unwrap();
        assert_eq!(erosion.len(), 2, "erosion appears in two section bodies");
        assert!(erosion.iter().all(|h| !h.snippet.is_empty()));

        // Title-only match: querying the heading word finds the section.
        let methodology = search(&conn, "methodology", 10).unwrap();
        assert_eq!(methodology.len(), 1);
        assert_eq!(methodology[0].section_id, "method");
    }

    #[test]
    fn sanitize_neutralizes_operators_and_empties() {
        assert_eq!(sanitize_query(""), None);
        assert_eq!(sanitize_query("   "), None);
        assert_eq!(sanitize_query("*:^()"), None);
        // FTS operators become quoted literal tokens, not operators.
        assert_eq!(sanitize_query("foo OR bar"), Some("\"foo\" \"OR\" \"bar\"".to_string()));
        assert_eq!(sanitize_query("a-b c"), Some("\"a\" \"b\" \"c\"".to_string()));
    }

    #[test]
    fn empty_or_operator_query_returns_no_hits_without_touching_match() {
        let (_d, conn) = temp_cache();
        rebuild_index(&conn, &[sec("a", "A", "hello world")]).unwrap();
        assert!(search(&conn, "", 10).unwrap().is_empty());
        assert!(search(&conn, "  ** : ^  ", 10).unwrap().is_empty());
    }

    #[test]
    fn adversarial_content_and_query_neither_inject_nor_panic() {
        let (_d, conn) = temp_cache();
        let nasty = "NEAR(* OR \"unterminated AND ) :: ^ café ".repeat(40);
        rebuild_index(
            &conn,
            &[
                sec("x", "Tricky \"Title\" OR NOT", &nasty),
                sec("y", "Unicode café", "Searching for a café in the corpus."),
            ],
        )
        .unwrap();
        // A query full of FTS operators is sanitized, never injected.
        let _ = search(&conn, "NEAR( OR ) café", 10).unwrap();
        let cafe = search(&conn, "café", 10).unwrap();
        assert!(cafe.iter().any(|h| h.section_id == "y"));
    }

    #[test]
    fn snippet_uses_the_fts_tokenizer_for_stemmed_and_accented_matches() {
        let (_d, conn) = temp_cache();
        rebuild_index(
            &conn,
            &[
                sec("a", "Alpha", "We run experiments in the lab every single morning."),
                sec("b", "Beta", "A quiet café near the river served strong espresso."),
            ],
        )
        .unwrap();

        // Porter-stemmed match: query 'running' finds the body word 'run', and
        // the snippet centers on it (a literal substring scan would have missed).
        let stemmed = search(&conn, "running", 10).unwrap();
        let a = stemmed.iter().find(|h| h.section_id == "a").expect("stemmed hit");
        assert!(a.snippet.to_lowercase().contains("run"), "snippet: {}", a.snippet);

        // Case-folded accented match: query 'CAFÉ' (uppercase) finds body 'café'.
        let accented = search(&conn, "CAFÉ", 10).unwrap();
        let b = accented.iter().find(|h| h.section_id == "b").expect("accented hit");
        assert!(b.snippet.to_lowercase().contains("café"), "snippet: {}", b.snippet);
    }

    #[test]
    fn parent_ids_in_any_order_with_dangling_refs_still_commit() {
        let (_d, conn) = temp_cache();
        // Child references a parent listed AFTER it, plus one dangling ref.
        let mut child = sec("child", "Child", "child body");
        child.parent_id = Some("parent".into());
        let mut orphan = sec("orphan", "Orphan", "orphan body");
        orphan.parent_id = Some("does-not-exist".into());
        rebuild_index(&conn, &[child, sec("parent", "Parent", "parent body"), orphan]).unwrap();
        let n: i64 = conn
            .query_row("SELECT count(*) FROM sections", [], |r| r.get(0))
            .unwrap();
        assert_eq!(n, 3);
    }

    #[test]
    fn rebuild_on_version_mismatch_preserves_authoritative_sidecars() {
        let dir = tempfile::tempdir().unwrap();
        let layout = Layout::new(dir.path());
        // Author authoritative sidecars beside where the cache will live.
        std::fs::create_dir_all(layout.specs_dir()).unwrap();
        let spec = layout.spec_yaml("intro");
        std::fs::write(&spec, "goals: keep me\n").unwrap();
        let settings = layout.settings_json();
        std::fs::write(&settings, "{\"name\":\"keep\"}").unwrap();

        // Build a cache with data, then poison its stored version.
        {
            let conn = open_cache(&layout).unwrap();
            rebuild_index(&conn, &[sec("intro", "Intro", "hello")]).unwrap();
            conn.execute(
                "INSERT INTO schema_meta(key,value) VALUES('version','-1')
                 ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                [],
            )
            .unwrap();
        }

        // Reopen: version mismatch (-1) forces a rebuild.
        let conn = open_cache(&layout).unwrap();

        // The authoritative sidecars are byte-for-byte intact.
        assert_eq!(std::fs::read_to_string(&spec).unwrap(), "goals: keep me\n");
        assert_eq!(std::fs::read_to_string(&settings).unwrap(), "{\"name\":\"keep\"}");
        // The cache itself was rebuilt empty (poisoned data gone)…
        let n: i64 = conn
            .query_row("SELECT count(*) FROM sections", [], |r| r.get(0))
            .unwrap();
        assert_eq!(n, 0);
        // …and the version healed back to current.
        let v: String = conn
            .query_row("SELECT value FROM schema_meta WHERE key='version'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(v, CACHE_SCHEMA_VERSION.to_string());
    }

    #[test]
    fn content_hash_is_stable_and_distinguishes() {
        assert_eq!(content_hash("abc"), content_hash("abc"));
        assert_ne!(content_hash("abc"), content_hash("abd"));
    }
}
