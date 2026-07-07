import type { SourceDocument, SourceRole } from '../types';
import { roleGlyph, roleLabel } from './source-roles';
import { normalizeForHash } from './gist-helpers';
import { computeHash } from './utils';

/** The user-editable fields of a source: everything else is derived or immutable. */
export interface SourcePatch {
  label?: string;
  content?: string;
  role?: SourceRole;
}

/** Hash of a source's content in the app's staleness idiom (gist / structural parts). */
export const sourceContentHash = (content: string): string =>
  computeHash(normalizeForHash(content));

/**
 * Apply an edit to a source. A role change recomputes the derived display fields
 * (`kind`, `glyph`) — they are projections of the role, never independently edited.
 * The exegesis is deliberately untouched: editing content makes it *stale*
 * (detected by hash, see isExegesisStale), never deleted — annotate, never rewrite.
 */
export const applySourcePatch = (source: SourceDocument, patch: SourcePatch): SourceDocument => {
  const next: SourceDocument = { ...source };
  if (patch.label !== undefined) next.label = patch.label;
  if (patch.content !== undefined) next.content = patch.content;
  if (patch.role !== undefined && patch.role !== source.role) {
    next.role = patch.role;
    next.kind = roleLabel(patch.role);
    next.glyph = roleGlyph(patch.role);
  }
  return next;
};

/** True when the source's content has changed since its exegesis was generated. */
export const isExegesisStale = (source: SourceDocument): boolean =>
  Boolean(source.exegesis && source.exegesis.sourceHash !== sourceContentHash(source.content));
