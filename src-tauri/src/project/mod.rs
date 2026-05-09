// Phase 3a — project handle and global app state.
//
// AppState is held in a tauri::State<Mutex<...>>. At any moment, at most
// one project is "open" — its handle is the active git repo and the
// active SQLite cache connection. Switching projects closes the old
// handle.
//
// The global recent-projects DB is independent of any open project; it
// always exists.

pub mod layout;

use crate::error::AppResult;
use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;

pub use layout::Layout;

/// Resources held while a project is open.
pub struct ProjectHandle {
    pub layout: Layout,
    pub git: git2::Repository,
    pub cache: Connection,
}

pub struct AppState {
    /// The currently-open project, if any.
    pub current: Mutex<Option<ProjectHandle>>,
    /// The global recent-projects DB. Always present.
    pub global: Mutex<Connection>,
}

impl AppState {
    pub fn new() -> AppResult<Self> {
        let global_path = crate::db::global_db_path()?;
        let global = crate::db::open(&global_path)?;
        Ok(Self {
            current: Mutex::new(None),
            global: Mutex::new(global),
        })
    }

    /// Replace the current handle with a new one (or None to close).
    pub fn set_current(&self, handle: Option<ProjectHandle>) {
        let mut guard = self.current.lock().expect("AppState lock poisoned");
        *guard = handle;
    }

    /// Run a closure with the current handle, if any.
    pub fn with_current<F, R>(&self, f: F) -> AppResult<R>
    where
        F: FnOnce(&ProjectHandle) -> AppResult<R>,
    {
        let guard = self.current.lock().expect("AppState lock poisoned");
        match guard.as_ref() {
            Some(h) => f(h),
            None => crate::error::err("no project is currently open"),
        }
    }

    /// Open a project at `path`: creates the cache connection, opens git.
    pub fn open_at(&self, path: PathBuf) -> AppResult<()> {
        let layout = Layout::new(&path);
        let git = git2::Repository::open(&path)?;
        let cache = crate::db::open(&layout.cache_sqlite())?;
        self.set_current(Some(ProjectHandle { layout, git, cache }));
        Ok(())
    }
}
