// Phase 3a — YAML helpers for per-section spec sidecars.

use crate::error::AppResult;
use serde::{de::DeserializeOwned, Serialize};
use std::path::Path;

pub fn write_yaml<T: Serialize>(path: &Path, value: &T) -> AppResult<()> {
    let s = serde_yaml::to_string(value)?;
    super::atomic_write_str(path, &s)
}

pub fn read_yaml<T: DeserializeOwned>(path: &Path) -> AppResult<Option<T>> {
    match super::read_to_string_optional(path)? {
        Some(s) => Ok(Some(serde_yaml::from_str(&s)?)),
        None => Ok(None),
    }
}
