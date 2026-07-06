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

    pub fn reverse_outline_json(&self) -> PathBuf {
        self.twriter_dir().join("reverse-outline.json")
    }

    pub fn gist_json(&self) -> PathBuf {
        self.twriter_dir().join("gist.json")
    }

    pub fn provenance_json(&self) -> PathBuf {
        self.twriter_dir().join("provenance.json")
    }

    pub fn structural_parts_json(&self) -> PathBuf {
        self.twriter_dir().join("structural-parts.json")
    }

    pub fn sources_json(&self) -> PathBuf {
        self.twriter_dir().join("sources.json")
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

    /// The single, hardcoded write root for the local agent's tools
    /// (`commands/agent_fs.rs`). A non-authoritative scratch area: the agent
    /// proposes here, the user reviews. Gitignored — never committed, never
    /// part of the dissertation's history. The agent can write nowhere else.
    pub fn agent_output_dir(&self) -> PathBuf {
        self.twriter_dir().join("agent-output")
    }

    pub fn session_yaml(&self, id: &str) -> PathBuf {
        self.sessions_dir().join(format!("{id}.yaml"))
    }

    pub fn cache_sqlite(&self) -> PathBuf {
        self.twriter_dir().join("index.sqlite")
    }

    /// Every on-disk file that makes up the per-project SQLite cache: the DB
    /// itself plus its WAL/SHM sidecars. These — and ONLY these — are removed
    /// when the cache is dropped and rebuilt (`db::index::open_cache`); the
    /// authoritative YAML/JSON sidecars under `.twriter/` are never touched.
    pub fn cache_files(&self) -> Vec<PathBuf> {
        let base = self.cache_sqlite();
        let sidecar = |suffix: &str| {
            let mut s = base.clone().into_os_string();
            s.push(suffix);
            PathBuf::from(s)
        };
        vec![base.clone(), sidecar("-wal"), sidecar("-shm")]
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn paths_match_the_documented_on_disk_tree() {
        let layout = Layout::new("/projects/diss");
        assert_eq!(layout.project_md(), Path::new("/projects/diss/project.md"));
        assert_eq!(layout.twriter_dir(), Path::new("/projects/diss/.twriter"));
        assert_eq!(layout.settings_json(), Path::new("/projects/diss/.twriter/settings.json"));
        assert_eq!(layout.specs_dir(), Path::new("/projects/diss/.twriter/specs"));
        assert_eq!(
            layout.reverse_outline_json(),
            Path::new("/projects/diss/.twriter/reverse-outline.json")
        );
        assert_eq!(
            layout.structural_parts_json(),
            Path::new("/projects/diss/.twriter/structural-parts.json")
        );
        assert_eq!(layout.cache_sqlite(), Path::new("/projects/diss/.twriter/index.sqlite"));
        assert_eq!(layout.gitignore(), Path::new("/projects/diss/.gitignore"));
        assert_eq!(
            layout.agent_output_dir(),
            Path::new("/projects/diss/.twriter/agent-output")
        );
    }

    #[test]
    fn spec_yaml_is_named_per_section_id() {
        let layout = Layout::new("/projects/diss");
        assert_eq!(
            layout.spec_yaml("intro-0"),
            Path::new("/projects/diss/.twriter/specs/intro-0.spec.yaml")
        );
    }

    #[test]
    fn looks_like_project_requires_both_marker_files() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        assert!(!Layout::looks_like_project(root), "empty dir is not a project");

        fs::write(root.join("project.md"), "# doc").unwrap();
        assert!(!Layout::looks_like_project(root), "project.md alone is not enough");

        fs::create_dir(root.join(".twriter")).unwrap();
        assert!(Layout::looks_like_project(root), "both markers present → a project");
    }
}
