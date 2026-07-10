// The typed openings behind the anchored-corridor law (docs/dialogue-design.md
// §II–III): a dialogue exists only as a document-anchored occasion with a
// declared deposit — an opening with no artifact is definitionally cut. Pure:
// builders compose deterministic context strings; the deposit parser reads the
// model's fenced block. No React, no store, no AI.

import type { NextAction } from '../types';
import { extractFencedJson } from './fenced-json';
import { safeJsonParse } from './utils';

export type DialogueOpeningKind = 'reentry' | 'coach-plan' | 'unstick';

export interface DialogueOpening {
  kind: DialogueOpeningKind;
  /** Short mono caption for the Focus banner ("RE-ENTRY · where was I?"). */
  label: string;
  /**
   * The deterministic context record — verbatim what the model receives and
   * what the writer can disclose. Includes the deposit contract.
   */
  context: string;
  /** Anchor into the document, when the occasion has one. */
  sectionId?: string;
  /** User turns before the composer yields to the exit (soft, never a lockout). */
  turnBudget: number;
}

/**
 * What a converged dialogue deposits back into the work. All fields optional —
 * the chips render from what is actually present.
 */
export interface OpeningDeposit {
  kind: string;
  /** A one-line session wish (re-entry / coach-plan). */
  wish?: string;
  /** The concrete first action. */
  firstStep?: string;
  /** A located next-action vector (unstick). */
  vector?: string;
  /** Target section, validated against the live tree by the caller. */
  sectionId?: string;
  /** Unstick outcome c: permission to stop — "good enough, move on." */
  goodEnough?: boolean;
}

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;

/** Parse the deposit from a model turn, or null when it has not converged. */
export function extractOpeningDeposit(text: string): OpeningDeposit | null {
  const fenced = extractFencedJson(text);
  if (!fenced) return null;
  const parsed: unknown = safeJsonParse(fenced, null);
  if (!parsed || typeof parsed !== 'object') return null;
  const d = (parsed as { deposit?: unknown }).deposit;
  if (!d || typeof d !== 'object') return null;
  const dep = d as Record<string, unknown>;
  const out: OpeningDeposit = {
    kind: str(dep.kind) ?? '',
    wish: str(dep.wish),
    firstStep: str(dep.firstStep),
    vector: str(dep.vector),
    sectionId: str(dep.sectionId),
    goodEnough: dep.goodEnough === true ? true : undefined,
  };
  if (!out.wish && !out.firstStep && !out.vector && !out.goodEnough) return null;
  return out;
}

/** A model turn with its fenced deposit removed (the chip renders it instead). */
export const stripDepositBlock = (text: string): string =>
  text.replace(/```(?:json)?[\s\S]*?```/gi, '').trim();

/** Cap on the SECTIONS index inside an opening context (orientation, not a dump). */
const SECTION_INDEX_CAP = 60;

const sectionIndexBlock = (sections: Array<{ id: string; title: string }>): string => {
  if (sections.length === 0) return '';
  const shown = sections.slice(0, SECTION_INDEX_CAP);
  const more = sections.length - shown.length;
  return [
    'SECTIONS (id — title):',
    ...shown.map((s) => `${s.id} — ${s.title}`),
    ...(more > 0 ? [`(and ${more} more)`] : []),
  ].join('\n');
};

export interface ReentryOpeningInput {
  /** From `lib/activity-brief.ts`; null when no record exists yet. */
  activityBrief: string | null;
  /** One line naming the top structural tension, when any. */
  strainHeadline?: string | null;
  currentSection?: { id: string; title: string } | null;
  /** The current section's gap→vector demand, when a diagnostic has one. */
  nextAction?: NextAction | null;
  /** Flat section index so the deposit can name a real target. */
  sections: Array<{ id: string; title: string }>;
}

/** The re-entry opening — "where was I, and what is this sitting for?" */
export function buildReentryOpening(input: ReentryOpeningInput): DialogueOpening {
  const context = [
    input.activityBrief
      ? `RECENT ACTIVITY:\n${input.activityBrief}`
      : 'RECENT ACTIVITY:\n(no recorded sessions or snapshots yet)',
    input.strainHeadline ? `TOP STRAIN: ${input.strainHeadline}` : '',
    input.currentSection
      ? `CURRENT SECTION: "${input.currentSection.title}" (${input.currentSection.id})`
      : '',
    input.nextAction
      ? `NEXT DEMAND (current section): ${input.nextAction.gap} → ${input.nextAction.vector}`
      : '',
    sectionIndexBlock(input.sections),
    [
      'DEPOSIT — when converged, emit exactly this fenced block:',
      '```json',
      '{"deposit": {"kind": "reentry", "wish": "<one-line session wish>", "firstStep": "<the concrete first action>", "sectionId": "<one id from SECTIONS, or omit>"}}',
      '```',
    ].join('\n'),
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    kind: 'reentry',
    label: 'RE-ENTRY · where was I?',
    context,
    sectionId: input.currentSection?.id,
    turnBudget: 4,
  };
}
