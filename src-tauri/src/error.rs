// Phase 3 — error glue.
//
// Tauri's IPC layer requires errors to be serializable. anyhow::Error isn't
// (it carries a Box<dyn Error>), so we wrap it in a thin newtype that
// renders to a string for the JS side. Domain code keeps using anyhow::Result;
// only the IPC boundary translates.

use serde::Serialize;
use std::fmt;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error(transparent)]
    Other(#[from] anyhow::Error),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = std::result::Result<T, AppError>;

// Convenience: convert any error into AppError without ceremony.
impl From<rusqlite::Error> for AppError {
    fn from(e: rusqlite::Error) -> Self {
        AppError::Other(anyhow::anyhow!(e))
    }
}

impl From<git2::Error> for AppError {
    fn from(e: git2::Error) -> Self {
        AppError::Other(anyhow::anyhow!(e))
    }
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        AppError::Other(anyhow::anyhow!(e))
    }
}

impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self {
        AppError::Other(anyhow::anyhow!(e))
    }
}

impl From<serde_yaml::Error> for AppError {
    fn from(e: serde_yaml::Error) -> Self {
        AppError::Other(anyhow::anyhow!(e))
    }
}

// For use in places where we want a quick error from a string.
pub fn err<T>(msg: impl fmt::Display) -> AppResult<T> {
    Err(AppError::Other(anyhow::anyhow!("{}", msg)))
}
