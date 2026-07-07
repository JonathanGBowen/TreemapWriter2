// Pure mapping layer for the Zotero live local-API picker. No network, no React,
// no store — services/zotero.ts fetches, this shapes: Zotero item JSON → CSL items
// (reusing bibImport's APA shaping), attachment selection, and the merge/dedupe
// against already-imported sources (by `zoteroKey`, so re-import updates in place).

import type { SourceDocument, SourceRole } from '../types';
import { cslItemToReference, type CslItem, type CslName, type ParsedReference } from './bibImport';

/** One item as the local API returns it with `include=csljson,data`. */
export interface ZoteroApiItem {
  key: string;
  /** Zotero's own item fields (always present). */
  data?: Record<string, unknown>;
  /** The CSL rendering (present when `include=csljson` is honored). */
  csljson?: unknown;
}

/** One child of an item (`/items/<key>/children`) — we care about attachments. */
export interface ZoteroApiChild {
  key: string;
  data?: Record<string, unknown>;
}

const str = (v: unknown): string => (v == null ? '' : String(v).trim());

interface ZoteroCreator {
  creatorType?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
}

const toCslName = (c: ZoteroCreator): CslName =>
  c.name ? { literal: c.name } : { family: c.lastName, given: c.firstName };

/**
 * Map a Zotero item's own `data` fields to the CSL subset bibImport reads — the
 * fallback when the local API doesn't honor `include=csljson`. Minimal on
 * purpose, mirroring bibImport's declared fidelity.
 */
export function zoteroItemToCslItem(data: Record<string, unknown>): CslItem {
  const creators = (Array.isArray(data.creators) ? data.creators : []) as ZoteroCreator[];
  const authors = creators.filter((c) => (c.creatorType ?? 'author') === 'author');
  const editors = creators.filter((c) => c.creatorType === 'editor');
  const yearMatch = /\b(\d{4})\b/.exec(str(data.date));
  return {
    title: str(data.title) || undefined,
    author: authors.length ? authors.map(toCslName) : undefined,
    editor: editors.length ? editors.map(toCslName) : undefined,
    issued: yearMatch ? { 'date-parts': [[yearMatch[1]]] } : undefined,
    'container-title':
      str(data.publicationTitle) || str(data.bookTitle) || str(data.proceedingsTitle) || undefined,
    publisher: str(data.publisher) || undefined,
    volume: str(data.volume) || undefined,
    issue: str(data.issue) || undefined,
    page: str(data.pages) || undefined,
    DOI: str(data.DOI) || undefined,
    URL: str(data.url) || undefined,
    abstract: str(data.abstractNote) || undefined,
  };
}

/** One picker item, normalised: csljson-first, `data`-mapped fallback. */
export function itemToReference(item: ZoteroApiItem): ParsedReference | null {
  const viaCsl = item.csljson ? cslItemToReference(item.csljson) : null;
  if (viaCsl) return viaCsl;
  return item.data ? cslItemToReference(zoteroItemToCslItem(item.data)) : null;
}

/** Display fields for a picker row. */
export function itemDisplay(item: ZoteroApiItem): { title: string; stem: string; year: string } {
  const ref = itemToReference(item);
  return {
    title: str(item.data?.title) || ref?.apa || '(untitled)',
    stem: ref?.labelStem ?? '',
    year: ref?.year ?? '',
  };
}

/** The chip label for an imported item: the same `Author (Year)` the file import mints. */
export function itemLabel(item: ZoteroApiItem): string {
  const ref = itemToReference(item);
  return ref ? `${ref.labelStem} (${ref.year})` : str(item.data?.title) || item.key;
}

export interface PickedAttachment {
  key: string;
  contentType: string;
  fileName?: string;
}

/**
 * The best full-text attachment among an item's children: PDF, then DOCX, then
 * plain text / markdown, then HTML (a snapshot — usable only via Zotero's own
 * fulltext index, so it ranks last). Null when the item carries none.
 */
export function pickBestAttachment(children: ZoteroApiChild[]): PickedAttachment | null {
  const atts = children
    .filter((c) => str(c.data?.itemType) === 'attachment')
    .map((c) => ({
      key: c.key,
      contentType: str(c.data?.contentType).toLowerCase(),
      fileName: str(c.data?.filename) || undefined,
    }));
  const rank = (ct: string): number => {
    if (ct === 'application/pdf') return 0;
    if (ct === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 1;
    if (ct === 'text/plain' || ct === 'text/markdown') return 2;
    if (ct === 'text/html') return 3;
    return 9;
  };
  const usable = atts.filter((a) => rank(a.contentType) < 9);
  if (!usable.length) return null;
  usable.sort((a, b) => rank(a.contentType) - rank(b.contentType));
  return usable[0];
}

/** A source-to-be from the picker, before ids are minted. */
export interface IncomingZoteroSource {
  zoteroKey: string;
  role: SourceRole;
  label: string;
  content: string;
  fileName?: string;
  mime?: string;
}

/**
 * Split an import into fresh adds and in-place updates: an existing source with
 * the same `zoteroKey` AND role is refreshed (label + content — which naturally
 * marks its exegesis stale) instead of duplicated. Role-scoped on purpose: the
 * bibliographic entry and the full text of the same work are two sources.
 */
export function mergeZoteroImports(
  existing: SourceDocument[],
  incoming: IncomingZoteroSource[],
): {
  adds: IncomingZoteroSource[];
  updates: { id: string; label: string; content: string }[];
} {
  const adds: IncomingZoteroSource[] = [];
  const updates: { id: string; label: string; content: string }[] = [];
  for (const inc of incoming) {
    const match = existing.find((s) => s.zoteroKey === inc.zoteroKey && s.role === inc.role);
    if (match) updates.push({ id: match.id, label: inc.label, content: inc.content });
    else adds.push(inc);
  }
  return { adds, updates };
}
