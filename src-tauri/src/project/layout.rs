// Phase 3a — path layout for an on-disk project.
//
// One source of truth for "where does X live in the project folder?".
// Centralized so the rest of Rust never reaches `.join(".twriter")`
// inline; a future layout change touches one file.

use std::path::{Path, PathBuf};

pub struct Layout {
    pub root: PathBuf,
}

impl Layout {
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Self { root: root.into() }
    }

    pub fn project_md(&self) -> PathBuf {
        self.root.join("project.md")
    }

    pub fn twriter_dir(&self) -> PathBuf {
        self.root.join(".twriter")
    }

    pub fn settings_json(&self) -> PathBuf {
        self.twriter_dir().join("settings.json")
    }

    pub fn personas_json(&self) -> PathBuf {
        self.twriter_dir().join("personas.json")
    }

    pub fn prompts_json(&self) -> PathBuf {
        self.twriter_dir().join("prompts.json")
    }

    pub fn models_json(&self) -> PathBuf {
        self.twriter_dir().join("models.json")
    }

    pub fn hidden_json(&self) -> PathBuf {
        self.twriter_dir().join("hidden.json")
    }

    pub fn uistate_json(&self) -> PathBuf {
        self.twriter_dir().join("uistate.json")
    }

    pub fn specs_dir(&self) -> PathBuf {
        self.twriter_dir().join("specs")
    }

    pub fn spec_yaml(&self, section_id: &str) -> PathBuf {
        self.specs_dir().join(format!("{section_id}.spec.yaml"))
    }

    pub fn sessions_dir(&self) -> PathBuf {
        self.twriter_dir().join("sessions")
    }

    pub fn session_yaml(&self, id: &str) -> PathBuf {
        self.sessions_dir().join(format!("{id}.yaml"))
    }

    pub fn cache_sqlite(&self) -> PathBuf {
        self.twriter_dir().join("index.sqlite")
    }

    pub fn gitignore(&self) -> PathBuf {
        self.root.join(".gitignore")
    }

    /// True if the path looks like a TreemapWriter project (has both
    /// `project.md` and a `.twriter/` directory).
    pub fn looks_like_project(root: &Path) -> bool {
        root.join("project.md").is_file() && root.join(".twriter").is_dir()
    }
}
