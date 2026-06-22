// Phase 3d — snapshots = git commits.
//
// `snapshot_commit` stages the working tree and creates a commit with a
// structured message:
//   <trigger>: <message>
//
//   Scope: all
//   (or)
//   Scope: section-id-1,section-id-2
//
// `snapshot_list` walks `git log` and returns lightweight metadata; the
// full Snapshot (with markdown + testSuite) is fetched lazily by
// `snapshot_read` only when the user opens a specific revision in the UI.
// This keeps project_open fast even for projects with hundreds of commits.

use crate::error::AppResult;
use crate::project::AppState;
use crate::types::{PersistedTestEntry, Snapshot, SnapshotMeta, TestSuite};
use git2::{Commit, Repository};
use serde::Deserialize;
use std::path::Path;
use tauri::State;

/// One git trailer line on a semantic session commit (`Key: value`). Ordered
/// (the caller sends an array) so the trailer block reads in a stable order.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Trailer {
    pub key: String,
    pub value: String,
}

#[tauri::command]
pub async fn snapshot_commit(
    state: State<'_, AppState>,
    message: String,
    trigger: String,
    affected_scope: serde_json::Value, // JS sends as `affectedScope`: a string ("all") or `{ sectionIds: [...] }`
    // Optional, present only for session-end semantic commits. When supplied the
    // subject line becomes `Session goal: <message>` (the brief's visual marker)
    // and the trailer block is appended after the Scope line — machine-parseable
    // via `git log --format='%(trailers:key=...)'`. Older callers omit it (None).
    trailers: Option<Vec<Trailer>>,
) -> AppResult<String> {
    state.with_current(|h| {
        let mut full_message = if trailers.is_some() {
            format!("Session goal: {}\n\n{}", message, encode_scope(&affected_scope))
        } else {
            format!("{}: {}\n\n{}", trigger, message, encode_scope(&affected_scope))
        };
        if let Some(items) = &trailers {
            let block = encode_trailers(items);
            if !block.is_empty() {
                full_message.push('\n');
                full_message.push_str(&block);
            }
        }
        let oid = crate::git::commit_all(&h.git, &full_message)?;
        Ok(oid)
    })
}

/// Create or move a lightweight git tag (`session/<ts>/start|end`) at a commit.
/// Idempotent — re-tagging the same name moves it rather than erroring.
#[tauri::command]
pub async fn git_create_tag(
    state: State<'_, AppState>,
    tag_name: String,
    commit_id: String,
) -> AppResult<()> {
    state.with_current(|h| {
        let oid = git2::Oid::from_str(&commit_id)?;
        crate::git::create_tag(&h.git, &tag_name, oid, true)
    })
}

/// List tag names, optionally filtered by a glob `pattern` (e.g. `session/*`).
#[tauri::command]
pub async fn git_list_tags(
    state: State<'_, AppState>,
    pattern: Option<String>,
) -> AppResult<Vec<String>> {
    state.with_current(|h| crate::git::list_tags(&h.git, pattern.as_deref()))
}

/// Resolve a ref (tag/branch/OID/HEAD) to a commit OID, or `None` if unresolved.
#[tauri::command]
pub async fn git_resolve_ref(
    state: State<'_, AppState>,
    refname: String,
) -> AppResult<Option<String>> {
    state.with_current(|h| crate::git::resolve_ref(&h.git, &refname))
}

/// Word-count delta of `project.md` between two refs (`to - from`).
#[tauri::command]
pub async fn git_word_count_delta(
    state: State<'_, AppState>,
    from_ref: String,
    to_ref: String,
) -> AppResult<i32> {
    state.with_current(|h| crate::git::word_count_delta(&h.git, &from_ref, &to_ref))
}

#[tauri::command]
pub async fn snapshot_list(
    state: State<'_, AppState>,
    limit: u32,
) -> AppResult<Vec<SnapshotMeta>> {
    state.with_current(|h| {
        let mut walker = h.git.revwalk()?;
        // If HEAD doesn't exist (fresh repo with no commits), return empty.
        if walker.push_head().is_err() {
            return Ok(Vec::new());
        }
        let mut out = Vec::with_capacity(limit as usize);
        for (i, oid) in walker.enumerate() {
            if i >= limit as usize {
                break;
            }
            let oid = oid?;
            let commit = h.git.find_commit(oid)?;
            out.push(commit_to_meta(&commit));
        }
        Ok(out)
    })
}

#[tauri::command]
pub async fn snapshot_read(
    state: State<'_, AppState>,
    commit_id: String,
) -> AppResult<Snapshot> {
    state.with_current(|h| {
        let oid = git2::Oid::from_str(&commit_id)?;
        let commit = h.git.find_commit(oid)?;
        let tree = commit.tree()?;

        let markdown = read_blob_at(&h.git, &tree, "project.md")?.unwrap_or_default();
        let test_suite = read_specs_at(&h.git, &tree)?;

        let (trigger, _msg, scope) = parse_commit_message(commit.message().unwrap_or(""));

        Ok(Snapshot {
            id: commit.id().to_string(),
            timestamp: commit.time().seconds() * 1000,
            trigger,
            affected_scope: scope,
            content_hash: tree.id().to_string(),
            markdown,
            test_suite,
            interpolation_config: None, // legacy field; not restored from disk
        })
    })
}

// --- helpers -------------------------------------------------------------

fn commit_to_meta(commit: &Commit<'_>) -> SnapshotMeta {
    let raw_message = commit.message().unwrap_or("").to_string();
    let (trigger, msg, scope) = parse_commit_message(&raw_message);
    SnapshotMeta {
        id: commit.id().to_string(),
        timestamp: commit.time().seconds() * 1000,
        trigger,
        affected_scope: scope,
        content_hash: commit.tree_id().to_string(),
        message: msg,
    }
}

/// Parse a commit message in the form `<trigger>: <text>\n\nScope: ...`.
/// Returns (trigger, text, affectedScope as JSON value). Robust to messages
/// that don't follow the convention (e.g., user-edited via `git commit --amend`):
/// trigger defaults to "manual", scope defaults to "all".
fn parse_commit_message(raw: &str) -> (String, String, serde_json::Value) {
    let mut lines = raw.lines();
    let first = lines.next().unwrap_or("");
    let (trigger, message) = match first.split_once(':') {
        Some((t, rest)) => (t.trim().to_string(), rest.trim().to_string()),
        None => ("manual".to_string(), first.trim().to_string()),
    };
    let mut scope = serde_json::Value::String("all".to_string());
    for line in lines {
        if let Some(rest) = line.strip_prefix("Scope: ") {
            scope = decode_scope_value(rest);
            break;
        }
    }
    (trigger, message, scope)
}

fn encode_trailers(items: &[Trailer]) -> String {
    items
        .iter()
        .filter(|t| !t.key.trim().is_empty())
        .map(|t| format!("{}: {}", t.key.trim(), t.value.trim()))
        .collect::<Vec<_>>()
        .join("\n")
}

fn encode_scope(value: &serde_json::Value) -> String {
    if let Some(s) = value.as_str() {
        return format!("Scope: {}", s);
    }
    if let Some(obj) = value.as_object() {
        if let Some(arr) = obj.get("sectionIds").and_then(|v| v.as_array()) {
            let ids: Vec<String> = arr
                .iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect();
            if !ids.is_empty() {
                return format!("Scope: {}", ids.join(","));
            }
        }
    }
    "Scope: all".to_string()
}

fn decode_scope_value(rest: &str) -> serde_json::Value {
    let s = rest.trim();
    if s == "all" || s.is_empty() {
        return serde_json::Value::String("all".to_string());
    }
    let ids: Vec<String> = s
        .split(',')
        .map(|p| p.trim().to_string())
        .filter(|p| !p.is_empty())
        .collect();
    serde_json::json!({ "sectionIds": ids })
}

fn read_blob_at(
    repo: &Repository,
    tree: &git2::Tree<'_>,
    path: &str,
) -> AppResult<Option<String>> {
    let entry = match tree.get_path(Path::new(path)) {
        Ok(e) => e,
        Err(_) => return Ok(None),
    };
    let blob = repo.find_blob(entry.id())?;
    Ok(Some(String::from_utf8_lossy(blob.content()).into_owned()))
}

fn read_specs_at(repo: &Repository, tree: &git2::Tree<'_>) -> AppResult<TestSuite> {
    // Try .twriter/specs/.
    let entry = match tree.get_path(Path::new(".twriter/specs")) {
        Ok(e) => e,
        Err(_) => return Ok(TestSuite::new()),
    };
    let specs_tree = repo.find_tree(entry.id())?;
    let mut suite = TestSuite::new();
    for tree_entry in specs_tree.iter() {
        let name = match tree_entry.name() {
            Some(n) => n,
            None => continue,
        };
        if !name.ends_with(".spec.yaml") {
            continue;
        }
        let section_id = match name.strip_suffix(".spec.yaml") {
            Some(s) => s.to_string(),
            None => continue,
        };
        let blob = repo.find_blob(tree_entry.id())?;
        let yaml_text = String::from_utf8_lossy(blob.content()).into_owned();
        let persisted: PersistedTestEntry = match serde_yaml::from_str(&yaml_text) {
            Ok(p) => p,
            Err(_) => continue, // tolerate corrupt entries; skip them
        };
        suite.insert(section_id, persisted.into_entry());
    }
    Ok(suite)
}
