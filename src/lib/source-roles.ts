import type { SourceRole } from '../types';

/**
 * UI display metadata for the four source roles. Data only (no React, no store, no
 * prompt prose) — mirrors `features/revision/revisionTypeColors.ts`: a `Record`
 * keyed by a domain enum, so the source picker, chips, audit trail, and config hint
 * all read one source of truth.
 *
 * The BEHAVIORAL contract for each role (how the engine treats it) lives in the
 * `.md` prompts (revision-task / citations-task), per the "prompts are content, not
 * code" law — this file carries only the short human-facing label / glyph / hint.
 */
export const SOURCE_ROLES: SourceRole[] = ['reference', 'guidance', 'bibliographic', 'voice'];

export interface SourceRoleMeta {
  /** Short label shown on the role selector + chip. */
  label: string;
  /** A single glyph icon (HLD style). */
  glyph: string;
  /** One-line explanation of how the engine treats the role (tooltip). */
  hint: string;
}

export const sourceRoleMeta: Record<SourceRole, SourceRoleMeta> = {
  reference: {
    label: 'Reference',
    glyph: '❡',
    hint: 'A work to draw on — its ideas are integrated with a proper citation.',
  },
  guidance: {
    label: 'Guidance',
    glyph: '✒',
    hint: 'Advisor / reviewer notes — applied to the prose, never cited.',
  },
  bibliographic: {
    label: 'Bibliography',
    glyph: '◎',
    hint: 'Reference metadata (e.g. Zotero) — cited, but never quote-verified.',
  },
  voice: {
    label: 'Voice',
    glyph: '⚐',
    hint: 'A style sample — its register is matched, never cited or quoted.',
  },
};

/** The default role for a freshly pasted source: the headline use is a reference work. */
export const DEFAULT_SOURCE_ROLE: SourceRole = 'reference';

/** The chip/display glyph for a source's role. */
export const roleGlyph = (role: SourceRole): string => sourceRoleMeta[role].glyph;

/** The short human label for a source's role. */
export const roleLabel = (role: SourceRole): string => sourceRoleMeta[role].label;
