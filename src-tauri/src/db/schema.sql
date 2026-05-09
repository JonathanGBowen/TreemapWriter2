-- TreemapWriter SQLite cache schema.
--
-- This schema lives at <project>/.twriter/index.sqlite. It is NEVER
-- authoritative. The source of truth is the markdown + YAML sidecars in
-- the project folder, and the history is .git/. Drop and rebuild this DB
-- at any time without losing user data.
--
-- A SEPARATE global SQLite at <config_dir>/twriter/recent.sqlite holds the
-- `projects` table only — the index of recently-opened project folders
-- across all projects. That table's schema appears at the bottom of this
-- file under the marker `-- @global`.

-- Sections are derived from parsing the markdown file; rebuildable.
CREATE TABLE IF NOT EXISTS sections (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES sections(id),
  title TEXT NOT NULL,
  level INTEGER NOT NULL,
  ordinal INTEGER NOT NULL,
  source_file TEXT NOT NULL,
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 0,
  content_hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sections_parent ON sections(parent_id);

-- Specs mirror the YAML sidecars; rebuildable from disk.
CREATE TABLE IF NOT EXISTS specs (
  section_id TEXT PRIMARY KEY REFERENCES sections(id) ON DELETE CASCADE,
  function TEXT NOT NULL,
  main_claim TEXT NOT NULL,
  required_moves_json TEXT NOT NULL,
  incoming_context_json TEXT NOT NULL,
  outgoing_commitments_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Diagnostics are ephemeral. Not in git, not on disk. SQLite only.
CREATE TABLE IF NOT EXISTS diagnostics (
  section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  generated_at INTEGER NOT NULL,
  readiness TEXT NOT NULL,
  next_priority TEXT,
  move_results_json TEXT NOT NULL,
  coherence_notes_json TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  PRIMARY KEY (section_id, generated_at)
);

-- Dependencies between sections (the graph in DependencyGraphModal).
CREATE TABLE IF NOT EXISTS dependencies (
  from_section TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  to_section   TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  PRIMARY KEY (from_section, to_section, kind)
);

-- FTS5 virtual table over section content for full-text search.
CREATE VIRTUAL TABLE IF NOT EXISTS sections_fts USING fts5(
  section_id UNINDEXED,
  title,
  body,
  content='',
  tokenize='porter unicode61'
);

-- Schema version tracking — bump on incompatible changes; the app may then
-- drop and rebuild the cache.
CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT OR IGNORE INTO schema_meta(key, value) VALUES ('version', '1');

-- @global: applied to <config_dir>/twriter/recent.sqlite, NOT per-project.
-- This is in the same SQL file so the schema bootstrap function can pick
-- one or the other depending on which DB it's opening.

-- One project = one folder. This table indexes recently-opened folders.
-- (Exists in the global DB; harmless if also created in a project cache.)
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  last_opened INTEGER NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS projects_last_opened ON projects(last_opened DESC);
