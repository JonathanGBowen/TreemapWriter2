// Phase 4a — typed wrapper over the OS-keyring Tauri commands.
//
// Service names are short identifiers ("git", "gemini") that the Rust side
// namespaces under "treemap-writer:<service>". Callers don't need to know
// about the namespace.
//
// In the browser (no Tauri), every call resolves to a no-op equivalent:
// getSecret returns null, set/delete resolve quietly. This lets sync-policy
// and the AI registry call these unconditionally without branching on isTauri.

import { invoke } from '@tauri-apps/api/core';
import { isTauri } from './tauri-environment';

export type SecretService = 'git' | 'gemini';

export async function setSecret(service: SecretService, value: string): Promise<void> {
  if (!isTauri()) return;
  await invoke('credentials_set', { service, value });
}

export async function getSecret(service: SecretService): Promise<string | null> {
  if (!isTauri()) return null;
  return await invoke<string | null>('credentials_get', { service });
}

export async function deleteSecret(service: SecretService): Promise<void> {
  if (!isTauri()) return;
  await invoke('credentials_delete', { service });
}
