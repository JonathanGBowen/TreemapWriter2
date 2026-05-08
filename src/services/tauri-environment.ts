import { invoke } from '@tauri-apps/api/core';

/**
 * Phase 2 — environment detection + minimal IPC sanity check.
 *
 * Tauri injects a `__TAURI_INTERNALS__` global into the webview. Use it to
 * branch persistence selection (browserRepository vs the future
 * tauriRepository) at boot, and to gate features that require filesystem or
 * native access.
 *
 * `appInfo()` is the smallest possible round-trip to verify JS↔Rust IPC is
 * wired correctly. Useful as a startup probe; not used in production logic.
 */

export interface AppInfo {
  name: string;
  version: string;
  tauri_version: string;
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function appInfo(): Promise<AppInfo> {
  if (!isTauri()) {
    throw new Error('appInfo() called outside Tauri runtime');
  }
  return invoke<AppInfo>('app_info');
}
