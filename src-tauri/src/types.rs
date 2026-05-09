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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptsConfig {
    pub system_instruction: String,
    pub l1_task_instruction: String,
    pub sub_task_instruction: String,
    pub suggest_content_prompt: String,
    pub coach_prompt: String,
    pub refine_spec_prompt: String,
    pub generate_personas_prompt: String,
    pub diagnostic_instruction: String,
    pub dependencies_prompt: String,
}

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
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub cached_suggestions: Option<CachedSuggestions>,
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
    pub interpolation_config: Option<PromptsConfig>,
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
    pub prompts_config: Option<PromptsConfig>,
    /// Pre-Phase-1 alias of `promptsConfig`. Honor on read; never write.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub interpolation_config: Option<PromptsConfig>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub cached_coach_advice: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub revisions: Option<Vec<Snapshot>>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub last_modified: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub ui_state: Option<UiState>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UiState {
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub sidebar_width: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub tests_panel_width: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub focus_mode: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub selected_section_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub active_line_index: Option<i32>,
}
