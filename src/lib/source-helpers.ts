// Pure helpers for the persisted source-document library (Glass Box revision).
// No React, no store — testable in isolation. Mirrors normalizeModelConfig's
// tolerant-hydration style.

import type { SourceDocument } from '../types';

let srcSeq = 0;
/** Monotonic id for a pasted source — Date.now alone can collide within a tick. */
export const makeSourceId = (): string => `src_${Date.now()}_${srcSeq++}`;

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

/**
 * Tolerant hydration for the persisted source library. Drops entries lacking an
 * id or content; fills missing UI metadata so a chip always renders.
 */
export const normalizeSources = (raw: unknown): SourceDocument[] => {
  if (!Array.isArray(raw)) return [];
  const out: SourceDocument[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const id = str(o.id).trim();
    const content = str(o.content);
    if (!id || !content.trim()) continue;
    out.push({
      id,
      content,
      kind: str(o.kind).trim() || 'Source',
      label: str(o.label).trim() || 'Pasted source',
      glyph: str(o.glyph).trim() || '❡',
    });
  }
  return out;
};
