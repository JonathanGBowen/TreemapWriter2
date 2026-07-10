// Phase 3 — Rust mirrors of the TS domain types in src/types/index.ts.
//
// Wire format is camelCase to match TS; Rust internals stay snake_case via
// serde rename_all. Every persisted struct has Option<…> on most fields so
// that real-world data accumulated under earlier schema versions still
// loads. Normalization happens once on import; the in-memory representation
// from disk is loose-by-construction.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectMeta {
    pub id: String,
    pub name: String,
    /// Epoch milliseconds, mirrors JS `Date.now()`.
    pub last_modified: i64,
    pub word_count: i32,
    /// Absolute path on disk. Not stored in the global recent DB? Yes — it's
    /// the primary key in spirit. JS-side uses `id`; we resolve to path
    /// via the `projects` table.
    pub path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Persona {
    pub id: String,
    pub name: String,
    pub role: String,
    pub instruction: String,
}

// NOTE: there is deliberately NO Rust `PromptsConfig` mirror. The prompts config
// is an opaque passthrough blob (`serde_json::Value`), exactly like
// `models_config` and `reverse_outlines` — the TS prompt registry
// (`src/services/prompts/registry.ts`) is the single source of truth for the
// shape. A strict, hand-maintained Rust mirror drifted ~10 fields behind that
// registry and, fatally, REQUIRED fields the TS layer no longer sends: the
// per-project override is SPARSE (often `{}`), so deserializing it into the
// strict struct failed with "missing field systemInstruction", silently failing
// EVERY `project_write` (prose, specs, analyses, snapshots) on desktop. Keep this
// opaque; do not reintroduce a typed mirror. (See migration-log 2026-06-24.)

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequiredMove {
    pub id: String,
    pub description: String,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub after: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SectionSpec {
    pub function: String,
    pub main_claim: String,
    pub required_moves: Vec<RequiredMove>,
    pub incoming_context: Vec<String>,
    pub outgoing_commitments: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Dependency {
    pub id: String,
    /// "prerequisite" | "reference"
    #[serde(rename = "type")]
    pub kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpecHistoryItem {
    pub timestamp: i64,
    pub goals: String,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub instruction: Option<String>,
    /// "manual" | "ai-generate" | "ai-refine"
    #[serde(rename = "type")]
    pub kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CachedSuggestions {
    pub input_hash: String,
    pub suggestions: String,
}

/// One entry in the in-memory TestSuite. Persisted half goes to the YAML
/// sidecar (`spec`, `goals`, `dependencies`, `mainClaim`, `history`); the
/// rest is ephemeral cache (`status`, `lastResult`, `lastDiagnostic`,
/// `cachedSuggestions`).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TestSuiteEntry {
    pub goals: String,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub spec: Option<SectionSpec>,
    /// Status field: "idle" | "running" | "success" | "fail" | "stale".
    /// Defaults to "idle" if absent.
    #[serde(default = "default_status")]
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub history: Option<Vec<SpecHistoryItem>>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub dependencies: Option<Vec<Dependency>>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub main_claim: Option<String>,
    /// One-sentence reverse-outline gloss (the Articulation tool). Persisted with
    /// the spec sidecar; distinct from `main_claim` (the exegetical reconstruction).
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub reverse_summary: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub cached_suggestions: Option<CachedSuggestions>,
    /// Per-section analysis workbench (versions + Socratic dialogue).
    /// Schema-agnostic on the Rust side — the TS layer owns the shape.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub analysis: Option<serde_json::Value>,
    /// Diagnostic + lastResult fields are ephemeral; round-trip through
    /// SQLite cache, not the YAML sidecar. Stored here only when the
    /// in-memory shape needs them.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub last_diagnostic: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub last_result: Option<serde_json::Value>,
}

fn default_status() -> String {
    "idle".to_string()
}

pub type TestSuite = HashMap<String, TestSuiteEntry>;

/// Subset of TestSuiteEntry that gets persisted to the YAML sidecar.
/// Ephemeral fields (`status`, `lastDiagnostic`, `lastResult`,
/// `cachedSuggestions`) deliberately do NOT appear here — they belong in
/// the SQLite cache, not in git history. Round-trip:
/// `TestSuiteEntry → PersistedTestEntry` on write, `PersistedTestEntry →
/// TestSuiteEntry::default()-and-fill` on read.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PersistedTestEntry {
    pub goals: String,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub spec: Option<SectionSpec>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub history: Option<Vec<SpecHistoryItem>>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub dependencies: Option<Vec<Dependency>>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub main_claim: Option<String>,
    /// One-sentence reverse-outline gloss (the Articulation tool). Intellectual
    /// work like specs/analyses, so it rides the YAML sidecar + git history.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub reverse_summary: Option<String>,
    /// Analysis versions + dialogue ARE persisted (intellectual work, like
    /// specs) — they ride the YAML sidecar and therefore git history.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub analysis: Option<serde_json::Value>,
}

impl PersistedTestEntry {
    pub fn from_entry(entry: &TestSuiteEntry) -> Self {
        Self {
            goals: entry.goals.clone(),
            spec: entry.spec.clone(),
            history: entry.history.clone(),
            dependencies: entry.dependencies.clone(),
            main_claim: entry.main_claim.clone(),
            reverse_summary: entry.reverse_summary.clone(),
            analysis: entry.analysis.clone(),
        }
    }

    pub fn into_entry(self) -> TestSuiteEntry {
        TestSuiteEntry {
            goals: self.goals,
            spec: self.spec,
            // Ephemeral on read: status defaults to "stale" because we
            // can't know whether a diagnostic still applies. Other fields
            // start unset.
            status: "stale".to_string(),
            history: self.history,
            dependencies: self.dependencies,
            main_claim: self.main_claim,
            reverse_summary: self.reverse_summary,
            cached_suggestions: None,
            analysis: self.analysis,
            last_diagnostic: None,
            last_result: None,
        }
    }
}

/// Snapshot ↔ git commit. The `id` is the commit OID; `contentHash` is the
/// tree OID. `markdown` and `testSuite` are read on demand.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub id: String,
    pub timestamp: i64,
    /// "manual" | "autosave" | "pre-ai-write"
    pub trigger: String,
    pub affected_scope: serde_json::Value,
    pub content_hash: String,
    pub markdown: String,
    pub test_suite: TestSuite,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub interpolation_config: Option<serde_json::Value>,
}

/// Lightweight metadata for the version-history list. The full `Snapshot`
/// is fetched lazily via `snapshot_read` when the user opens a particular
/// commit.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotMeta {
    pub id: String,
    pub timestamp: i64,
    pub trigger: String,
    pub affected_scope: serde_json::Value,
    pub content_hash: String,
    pub message: String,
}

/// Mirror of `StoredProjectData` from `src/services/repository.ts`. Loose by
/// design — every field is optional because real-world data spans schema
/// versions.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct StoredProjectData {
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub project_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub markdown: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub local_draft: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub test_suite: Option<TestSuite>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub hidden_section_ids: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub active_persona_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub custom_personas: Option<Vec<Persona>>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub prompts_config: Option<serde_json::Value>,
    /// Pre-Phase-1 alias of `promptsConfig`. Honor on read; never write.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub interpolation_config: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub cached_coach_advice: Option<serde_json::Value>,
    /// Per-project, per-call model config (`.twriter/models.json`). Schema-
    /// agnostic on the Rust side — the TS layer owns the shape (provider/model/
    /// thinkingBudget per call kind). Holds model choices, never secrets.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub models_config: Option<serde_json::Value>,
    /// Parallel Editor reverse outlines (`.twriter/reverse-outline.json`). Schema-
    /// agnostic on the Rust side — the TS layer owns the shape (an array of
    /// `{ scopeKey, bullets, sourceHash, generatedAt }`). Committed, like specs.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub reverse_outlines: Option<serde_json::Value>,
    /// Reverse Outline Doctor revision checklist (`.twriter/outline-doctor.json`).
    /// Schema-agnostic on the Rust side — the TS layer owns the shape (a
    /// `DoctorChecklist`: thesis, criticalIssue, roadmap, tasks). One per project;
    /// committed, like specs.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub doctor_checklist: Option<serde_json::Value>,
    /// Gist Editor scale model (`.twriter/gist.json`). Schema-agnostic on the Rust
    /// side — the TS layer owns the shape (`StoredGist`: segmentation, analysis,
    /// budgets, the three grains, stale/orphan ids). One per document; committed.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub gist: Option<serde_json::Value>,
    /// Durable provenance layer for AI-introduced spans (`.twriter/provenance.json`).
    /// Schema-agnostic on the Rust side — the TS layer owns the shape (`ProvenanceDoc`:
    /// `{ marks: ProvenanceMark[] }`). Opaque `Value`, like `gist`, so a sparse/evolving
    /// shape can never reject the whole save (the 2026-06-24 strict-mirror lesson).
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub provenance: Option<serde_json::Value>,
    /// The document's discovered structural-functional parts (`.twriter/structural-parts.json`).
    /// Schema-agnostic on the Rust side — the TS layer owns the shape (a bare `StructuralPart[]`:
    /// anchored move spans mapped many-to-many onto sections). Opaque `Value`, like `gist`/
    /// `provenance`, so a sparse/evolving shape can never reject the whole save.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub structural_parts: Option<serde_json::Value>,
    /// The revision workspace's source documents (`.twriter/sources.json`): pasted notes,
    /// imported bibliography, and uploaded PDF/DOCX/text with their extracted text.
    /// Schema-agnostic on the Rust side — the TS layer owns the shape (a bare
    /// `SourceDocument[]`). Opaque `Value`, like `gist`/`structural_parts`, so a
    /// sparse/evolving shape can never reject the whole save.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub sources: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub revisions: Option<Vec<Snapshot>>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub last_modified: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub ui_state: Option<UiState>,
}

// Session ceremony — mirror of the Sessions layer in src/types/index.ts.
//
// One record per writing session, persisted as `.twriter/sessions/<id>.yaml`
// (committed, like the spec sidecars). The `id` is the hyphenated ISO start
// timestamp and doubles as the linking key for the `session/<id>/start|end`
// git tag pair. Written by the TS session lifecycle via `session_save`; loose
// by design so older records still load.

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionGoal {
    pub wish: String,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub outcome: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub obstacle: Option<String>,
    /// The "if [obstacle], then I will …" implementation intention.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub plan: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionStep {
    pub id: String,
    pub description: String,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub estimated_minutes: Option<i32>,
    #[serde(default)]
    pub completed: bool,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub implementation_intention: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CarryForward {
    pub step_id: String,
    pub next_action: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionRecord {
    pub id: String,
    pub start_tag: String,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub end_tag: Option<String>,
    pub goal: SessionGoal,
    #[serde(default)]
    pub steps: Vec<SessionStep>,
    #[serde(default)]
    pub carry_forward: Vec<CarryForward>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub reflection: Option<String>,
    #[serde(default)]
    pub word_delta: i32,
    #[serde(default)]
    pub word_delta_by_node: HashMap<String, i32>,
    #[serde(default)]
    pub nodes_modified: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub commitment_level: Option<i32>,
    #[serde(default)]
    pub duration_minutes: i32,
    /// How the session was created: "manual" (the standalone Start/End) or
    /// "sprint" (a completed Living Sprint). Defaults to "manual".
    #[serde(default = "default_session_source")]
    pub source: String,
}

fn default_session_source() -> String {
    "manual".to_string()
}

// Phase 4 — sync (git pull/push) outcomes.
//
// Tagged unions, externally tagged. JS side reads `kind` and switches.
// Hard rule from the Phase 4 plan: outcomes that would require destroying
// local commits (MergeRequired, NonFastForward) are RETURNED, not acted on.
// The user resolves out-of-band; we never run reset --hard or anything that
// throws away history.

// NOTE (serde gotcha): on an ENUM, `rename_all` renames the *variant names* only —
// it does NOT rename the fields inside a struct variant. Those need
// `rename_all_fields`. Without it, `MergeRequired { their_commit, base_head }` would
// serialize with snake_case keys while the TS `PullOutcome`/`PendingMerge` types read
// `theirCommit`/`baseHead` — the exact mismatch that crashed `sync_resolve_merge`
// with "missing required key theirCommit". Keep `rename_all_fields` on every tagged
// sync enum so a future multi-word variant field can't regress the same way (it is a
// no-op for the single-word fields the siblings carry today).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase", tag = "kind")]
pub enum PullOutcome {
    UpToDate,
    FastForwarded { commits: u32 },
    /// Divergent but conflict-free: an in-memory 3-way merge succeeded and was
    /// committed automatically (matches the auto-fast-forward UX).
    Merged { commits: u32 },
    /// Divergent with real conflicts. Nothing has been written to disk — the
    /// working tree is untouched. `their_commit` (hex OID, also held alive by
    /// `refs/twriter/incoming`) and `base_head` are echoed back into
    /// `sync_resolve_merge` once the user picks resolutions.
    MergeRequired {
        their_commit: String,
        base_head: String,
        conflicts: Vec<ConflictFile>,
    },
    /// Local and remote share no common ancestor (e.g. the GitHub repo was
    /// created with a README while the local repo was `init`'d separately).
    /// We refuse to merge unrelated histories automatically.
    UnrelatedHistories,
    WorkingTreeDirty,
    NoRemote,
}

/// One conflicted path in a `MergeRequired` outcome. Text content is only
/// populated when a side is present and valid UTF-8; binary/non-UTF-8 content
/// is never lossily decoded (it is resolved by OID, byte-exact).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConflictFile {
    pub path: String,
    /// "text" | "binary" | "modifyDelete"
    pub kind: String,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub base: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub ours: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub theirs: Option<String>,
    /// libgit2 merge-file output with conflict markers (text conflicts only).
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub merged: Option<String>,
    pub automergeable: bool,
    /// For modify/delete conflicts: which side removed the file.
    pub our_deleted: bool,
    pub their_deleted: bool,
}

/// The user's choice for one conflicted path, sent to `sync_resolve_merge`.
/// Externally tagged so binary files stay byte-exact (Ours/Theirs reference the
/// blob OID rather than round-tripping through a string).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase", tag = "kind")]
pub enum Resolution {
    /// Resolved text (text files) — committed as the given UTF-8 bytes.
    Content { path: String, text: String },
    /// Take our side's blob byte-exact.
    Ours { path: String },
    /// Take their side's blob byte-exact.
    Theirs { path: String },
    /// Accept deletion of the path.
    Delete { path: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase", tag = "kind")]
pub enum ResolveOutcome {
    Resolved { commits: u32 },
    /// HEAD moved or the working tree went dirty between detect and resolve;
    /// the caller should re-pull and reopen with fresh conflict data.
    Stale,
    NoRemote,
    /// The merge could not be applied. Nothing was committed; local work is
    /// intact. `reason` is surfaced verbatim in the UI.
    Failed { reason: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase", tag = "kind")]
pub enum PushOutcome {
    UpToDate,
    Pushed { commits: u32 },
    NonFastForward,
    NoRemote,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncState {
    pub has_remote: bool,
    pub remote_url: Option<String>,
    pub ahead: u32,
    pub behind: u32,
    /// True if tracked files have uncommitted edits. Untracked files do not
    /// count — they're invisible to fast-forward checkouts.
    pub working_tree_dirty: bool,
    /// Current local branch (typically "main"). None if HEAD is detached
    /// or there's no commits yet.
    pub branch: Option<String>,
}

/// Cheap change-detection stat of a file: last-modified (epoch ms) + byte size.
/// Lets a caller skip re-reading the whole file when it hasn't changed on disk.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskSignature {
    pub mtime_ms: i64,
    pub size: u64,
}

/// Result of a conditional read: the current signature (`None` if the file is
/// absent) and the content, present only when it differs from the caller's
/// last-known signature.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarkdownDelta {
    pub signature: Option<DiskSignature>,
    pub content: Option<String>,
}

/// One full-text search hit, returned by `search_sections`. `rank` is the
/// FTS5 bm25 score (lower = more relevant); the UI orders by it ascending.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub section_id: String,
    pub title: String,
    pub snippet: String,
    pub rank: f64,
}

/// One entry returned by the local agent's `agent_list_files` tool
/// (`commands/agent_fs.rs`): a path relative to the project root plus its byte
/// size. The agent uses these to decide what to `agent_read_file`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentFileEntry {
    /// Path relative to the project root, using forward slashes.
    pub path: String,
    pub size: u64,
}

/// A section pushed down from the frontend parser (`src/lib/utils.ts`) for
/// indexing. The frontend already owns markdown→section parsing, so we reuse
/// it rather than duplicating a parser in Rust. Loose/defaulted so callers may
/// omit fields the search index doesn't strictly need.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SectionInput {
    pub id: String,
    #[serde(default)]
    pub parent_id: Option<String>,
    pub title: String,
    #[serde(default)]
    pub level: i64,
    #[serde(default)]
    pub ordinal: i64,
    #[serde(default)]
    pub content: String,
    #[serde(default)]
    pub word_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UiState {
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub sidebar_width: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub tests_panel_width: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub revision_rail_width: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub revision_proposals_width: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub compare_report_width: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub focus_mode: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub selected_section_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub active_line_index: Option<i32>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn project_meta_uses_camel_case_keys_for_the_ts_mirror() {
        let meta = ProjectMeta {
            id: "p1".into(),
            name: "Diss".into(),
            last_modified: 1_700_000_000_000,
            word_count: 4200,
            path: Some("/projects/diss".into()),
        };
        let json = serde_json::to_string(&meta).unwrap();
        // The TS side reads camelCase — snake_case here would silently desync it.
        assert!(json.contains("\"lastModified\":1700000000000"));
        assert!(json.contains("\"wordCount\":4200"));

        let back: ProjectMeta = serde_json::from_str(&json).unwrap();
        assert_eq!(back.id, "p1");
        assert_eq!(back.last_modified, 1_700_000_000_000);
        assert_eq!(back.word_count, 4200);
    }

    #[test]
    fn section_spec_round_trips_through_yaml_with_camel_case() {
        // The spec sidecars are YAML; this is the on-disk format for a section.
        let spec = SectionSpec {
            function: "argue".into(),
            main_claim: "The claim.".into(),
            required_moves: vec![RequiredMove {
                id: "m1".into(),
                description: "Establish the premise.".into(),
                after: None,
            }],
            incoming_context: vec!["prior result".into()],
            outgoing_commitments: vec![],
        };
        let yaml = serde_yaml::to_string(&spec).unwrap();
        assert!(yaml.contains("mainClaim:"));
        assert!(yaml.contains("requiredMoves:"));
        assert!(yaml.contains("incomingContext:"));

        let back: SectionSpec = serde_yaml::from_str(&yaml).unwrap();
        assert_eq!(back.main_claim, "The claim.");
        assert_eq!(back.required_moves.len(), 1);
        assert_eq!(back.required_moves[0].id, "m1");
    }

    #[test]
    fn dependency_serializes_kind_as_the_reserved_type_key() {
        let dep = Dependency { id: "s0".into(), kind: "prerequisite".into() };
        let json = serde_json::to_string(&dep).unwrap();
        // `kind` is renamed to `type` to match the TS Dependency shape.
        assert!(json.contains("\"type\":\"prerequisite\""));
        assert!(!json.contains("\"kind\""));

        let back: Dependency = serde_json::from_str(&json).unwrap();
        assert_eq!(back.kind, "prerequisite");
    }

    #[test]
    fn merge_required_serializes_struct_variant_fields_as_camel_case() {
        // Regression guard: `rename_all` on an enum renames variant names, NOT the
        // fields of a struct variant — those need `rename_all_fields`. Without it the
        // TS side reads `theirCommit`/`baseHead` as undefined and `sync_resolve_merge`
        // crashes with "missing required key theirCommit". Pin the exact wire keys.
        let outcome = PullOutcome::MergeRequired {
            their_commit: "aaaa".into(),
            base_head: "bbbb".into(),
            conflicts: vec![ConflictFile {
                path: "project.md".into(),
                kind: "text".into(),
                base: None,
                ours: Some("ours".into()),
                theirs: Some("theirs".into()),
                merged: None,
                automergeable: false,
                our_deleted: false,
                their_deleted: false,
            }],
        };
        let v = serde_json::to_value(&outcome).unwrap();
        assert_eq!(v["kind"], "mergeRequired");
        assert_eq!(v["theirCommit"], "aaaa");
        assert_eq!(v["baseHead"], "bbbb");
        // The snake_case keys must NOT appear — that was the bug.
        assert!(v.get("their_commit").is_none());
        assert!(v.get("base_head").is_none());
        // Nested ConflictFile also camelCases its multi-word fields.
        assert_eq!(v["conflicts"][0]["ourDeleted"], false);
        assert_eq!(v["conflicts"][0]["theirDeleted"], false);

        // And it round-trips back through the TS-facing shape.
        let back: PullOutcome = serde_json::from_value(v).unwrap();
        match back {
            PullOutcome::MergeRequired { their_commit, base_head, conflicts } => {
                assert_eq!(their_commit, "aaaa");
                assert_eq!(base_head, "bbbb");
                assert_eq!(conflicts.len(), 1);
            }
            _ => panic!("expected MergeRequired"),
        }
    }
}
