// The Zotero local-API client — the ONLY module that talks to Zotero
// (http://localhost:23119, Zotero 7+'s local mirror of the Web API v3).
//
// Zotero's local server sends no CORS headers, so a webview `fetch` is
// same-origin-blocked (unlike Ollama, which has OLLAMA_ORIGINS). Requests
// therefore go through `tauri-plugin-http` — a fetch-alike routed through Rust,
// capability-scoped in src-tauri/capabilities/default.json to localhost:23119
// ONLY — imported dynamically so it never enters the browser bundle. The live
// picker is desktop-only (the FTS5 / fs-tools precedent); the browser keeps the
// file-import path. Requires Zotero's "Allow other applications on this computer
// to communicate with Zotero" preference; the `Zotero-Allowed-Request` header
// avoids a 403 on setups where that pref gates individual requests.

import { isTauri } from './tauri-environment';
import type { ZoteroApiChild, ZoteroApiItem } from '../lib/zoteroImport';

const BASE = 'http://localhost:23119/api/users/0';

/** Cap a browse/search page — the local API is otherwise unpaginated. */
const LIST_LIMIT = 200;

async function zoteroFetch(path: string, timeoutMs: number): Promise<Response> {
  if (!isTauri()) throw new Error('The Zotero picker is desktop-only.');
  const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
  return tauriFetch(`${BASE}${path}`, {
    method: 'GET',
    headers: { 'Zotero-Allowed-Request': 'true' },
    signal: AbortSignal.timeout(timeoutMs),
  });
}

async function getJson<T>(path: string, what: string, timeoutMs = 10000): Promise<T> {
  const res = await zoteroFetch(path, timeoutMs);
  if (!res.ok) throw new Error(`Zotero: ${what} failed (HTTP ${res.status}).`);
  return (await res.json()) as T;
}

/** Quick reachability probe (short timeout; false on any failure). */
export async function zoteroAvailable(): Promise<boolean> {
  try {
    const res = await zoteroFetch('/collections?limit=1', 3000);
    return res.ok;
  } catch {
    return false;
  }
}

export interface ZoteroCollection {
  key: string;
  name: string;
}

/** The library's collections, flat, sorted by name (nesting is a v1 non-goal). */
export async function listCollections(): Promise<ZoteroCollection[]> {
  const raw = await getJson<Array<{ key: string; data?: { name?: string } }>>(
    '/collections',
    'listing collections',
  );
  return raw
    .map((c) => ({ key: c.key, name: c.data?.name?.trim() || c.key }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Top-level items (never attachments/notes), optionally scoped to a collection
 * and/or a title-creator-year search. `include=csljson,data` asks for the CSL
 * rendering beside the raw fields; the mapper falls back to `data` per item.
 */
export async function searchItems(opts: {
  collectionKey?: string;
  q?: string;
}): Promise<ZoteroApiItem[]> {
  const p = new URLSearchParams();
  p.set('include', 'csljson,data');
  p.set('limit', String(LIST_LIMIT));
  if (opts.q?.trim()) {
    p.set('q', opts.q.trim());
    p.set('qmode', 'titleCreatorYear');
  }
  const path = opts.collectionKey
    ? `/collections/${encodeURIComponent(opts.collectionKey)}/items/top`
    : '/items/top';
  return getJson<ZoteroApiItem[]>(`${path}?${p.toString()}`, 'searching items');
}

/** An item's children (attachments live here). */
export async function getItemChildren(itemKey: string): Promise<ZoteroApiChild[]> {
  return getJson<ZoteroApiChild[]>(
    `/items/${encodeURIComponent(itemKey)}/children`,
    'reading attachments',
  );
}

/**
 * Zotero's own indexed full text for an attachment — the preferred path (no
 * PDF parsing needed). Null when Zotero hasn't indexed it (404 / empty).
 */
export async function getIndexedFulltext(attachmentKey: string): Promise<string | null> {
  const res = await zoteroFetch(`/items/${encodeURIComponent(attachmentKey)}/fulltext`, 20000);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Zotero: fulltext read failed (HTTP ${res.status}).`);
  const data = (await res.json()) as { content?: unknown };
  const content = typeof data.content === 'string' ? data.content.trim() : '';
  return content || null;
}

/** The raw attachment binary — the fallback feed for the app's own extractors. */
export async function getAttachmentFile(
  attachmentKey: string,
): Promise<{ buf: ArrayBuffer; contentType: string }> {
  const res = await zoteroFetch(`/items/${encodeURIComponent(attachmentKey)}/file`, 60000);
  if (!res.ok) throw new Error(`Zotero: file download failed (HTTP ${res.status}).`);
  return {
    buf: await res.arrayBuffer(),
    contentType: (res.headers.get('content-type') ?? '').toLowerCase(),
  };
}
