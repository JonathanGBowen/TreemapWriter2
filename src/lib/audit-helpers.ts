// Pure helpers for the whole-document argument audit (WS4b). No React, no store, no
// SDK — the audit hook leans on these so it stays thin and testable. The agent reads
// the deterministic structural map (buildAuditSeed) as a starting point, then returns
// findings we validate + anchor here (normalizeAuditFindings).

import type { AuditFinding, AuditFindingKind, Section, SectionSpec } from '../types';
import { pickRaw, pickStr } from './revision-helpers';
import { resolveSectionRef } from './utils';
import { checkCommitmentMesh } from './diagnostic-helpers';

const VALID_KINDS: AuditFindingKind[] = [
  'unargued-commitment',
  'unsupported-assumption',
  'drifted-claim',
  'orphaned-commitment',
];

const coerceKind = (v: unknown): AuditFindingKind => {
  const s = typeof v === 'string' ? v.trim() : '';
  return (VALID_KINDS as string[]).includes(s) ? (s as AuditFindingKind) : 'unargued-commitment';
};

const coerceDirection = (v: unknown): AuditFinding['direction'] => {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return s === 'upstream' || s === 'downstream' || s === 'self' ? s : undefined;
};

const coerceSeverity = (v: unknown): 'medium' | 'high' =>
  (typeof v === 'string' ? v.trim().toLowerCase() : '') === 'high' ? 'high' : 'medium';

/** Pull the findings array out of whatever envelope the model returned. */
const toItems = (raw: unknown): unknown[] => {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    for (const k of ['findings', 'results', 'items', 'audit']) {
      if (Array.isArray(o[k])) return o[k] as unknown[];
    }
  }
  return [];
};

let auditSeq = 0;

/**
 * Validate + anchor the agent's audit JSON. Tolerant of field-name variance (reuses
 * `pickStr`/`pickRaw`); drops any finding lacking a `detail` or whose section can't be
 * resolved to a real node (`resolveSectionRef`) — a finding we can't point at is noise.
 * `severity` clamps to medium/high; unknown `kind`/`direction` coerce to safe defaults.
 */
export const normalizeAuditFindings = (
  raw: unknown,
  opts: { sections: Section[] },
): AuditFinding[] => {
  const out: AuditFinding[] = [];
  for (const item of toItems(raw)) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const detail = pickStr(o, ['detail', 'description', 'finding', 'text']);
    const ref = pickStr(o, ['sectionTitle', 'section', 'section_title', 'sectionId', 'title']);
    if (!detail || !ref) continue;
    const sec = resolveSectionRef(ref, opts.sections);
    if (!sec) continue; // a finding we can't anchor to a real section is dropped
    out.push({
      id: `audit_${auditSeq++}`,
      sectionId: sec.id,
      sectionTitle: sec.title,
      kind: coerceKind(pickRaw(o, ['kind', 'type'])),
      detail,
      relatedSectionTitle:
        pickStr(o, ['relatedSectionTitle', 'related', 'relatedSection', 'related_section_title']) ||
        undefined,
      direction: coerceDirection(pickRaw(o, ['direction'])),
      severity: coerceSeverity(pickRaw(o, ['severity'])),
      drift: pickStr(o, ['drift', 'driftNote', 'drift_note']) || undefined,
    });
  }
  return out;
};

/**
 * The deterministic structural map handed to the audit agent as its starting point —
 * the reading-order outline with each spec'd section's incoming/outgoing commitments
 * and the `checkCommitmentMesh` breaks already detected (the non-model oracle). The
 * agent verifies and goes BEYOND this (semantic gaps, drift) rather than re-deriving it.
 * `topologyNote` (cycles / backward arcs from the topology pass) is computed in the
 * feature layer and passed in, so this stays pure and lib-only.
 */
export const buildAuditSeed = (
  sections: Section[],
  specs: Record<string, SectionSpec | undefined>,
  opts?: { topologyNote?: string },
): string => {
  const lines: string[] = [
    'STRUCTURAL MAP (deterministic — your starting point; verify it against the prose and go beyond it):',
  ];
  const walk = (nodes: Section[]) =>
    nodes.forEach((n) => {
      const spec = specs[n.id];
      const indent = '  '.repeat(Math.max(0, n.level - 1));
      lines.push(`${indent}- "${n.title}"${spec ? '' : ' (no spec)'}`);
      if (spec) {
        if (spec.incomingContext?.length) lines.push(`${indent}    needs: ${spec.incomingContext.join('; ')}`);
        if (spec.outgoingCommitments?.length)
          lines.push(`${indent}    establishes: ${spec.outgoingCommitments.join('; ')}`);
        for (const m of checkCommitmentMesh(n.id, sections, specs)) {
          lines.push(
            `${indent}    ! ${m.kind}${m.relatedSectionTitle ? ` (${m.relatedSectionTitle})` : ''}: ${m.detail}`,
          );
        }
      }
      walk(n.children);
    });
  walk(sections);
  if (opts?.topologyNote) {
    lines.push('', opts.topologyNote);
  }
  return lines.join('\n');
};
