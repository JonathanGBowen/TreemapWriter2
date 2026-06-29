import { describe, it, expect } from 'vitest';
import { normalizeAuditFindings, buildAuditSeed } from '../audit-helpers';
import { parseAgentProposals } from '../revision-helpers';
import { resolveSectionRef } from '../utils';
import type { Section, SectionSpec } from '../../types';

const sec = (id: string, title: string, children: Section[] = [], level = 1): Section => ({
  id,
  title,
  level,
  content: '',
  fullContent: '',
  startLine: 0,
  endLine: 0,
  startOffset: 0,
  wordCount: 0,
  children,
  parentId: null,
});

const sections: Section[] = [sec('intro', 'Introduction'), sec('methods', 'Methods', [sec('m1', 'Sampling', [], 2)])];

describe('resolveSectionRef', () => {
  it('resolves by id, exact title, and loose (trimmed/cased) title', () => {
    expect(resolveSectionRef('m1', sections)?.id).toBe('m1');
    expect(resolveSectionRef('Sampling', sections)?.id).toBe('m1');
    expect(resolveSectionRef('  introduction ', sections)?.id).toBe('intro');
  });
  it('returns null for an unknown ref', () => {
    expect(resolveSectionRef('Nonexistent', sections)).toBeNull();
    expect(resolveSectionRef('', sections)).toBeNull();
  });
});

describe('normalizeAuditFindings', () => {
  it('anchors by sectionTitle and carries kind/severity/relation', () => {
    const raw = [
      {
        sectionTitle: 'Introduction',
        detail: 'X is relied on later but never argued here.',
        kind: 'unargued-commitment',
        severity: 'high',
        relatedSectionTitle: 'Methods',
        direction: 'downstream',
      },
    ];
    const out = normalizeAuditFindings(raw, { sections });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      sectionId: 'intro',
      sectionTitle: 'Introduction',
      kind: 'unargued-commitment',
      severity: 'high',
      relatedSectionTitle: 'Methods',
      direction: 'downstream',
    });
  });

  it('drops findings with no detail or an unresolvable section', () => {
    const raw = [
      { sectionTitle: 'Ghost Section', detail: 'points nowhere' },
      { sectionTitle: 'Methods' }, // no detail
      { sectionTitle: 'Methods', detail: 'a real gap' },
    ];
    const out = normalizeAuditFindings(raw, { sections });
    expect(out).toHaveLength(1);
    expect(out[0].sectionId).toBe('methods');
  });

  it('clamps unknown severity to medium and unknown kind to a safe default', () => {
    const out = normalizeAuditFindings(
      [{ section: 'Methods', detail: 'd', severity: 'critical', kind: 'whatever' }],
      { sections },
    );
    expect(out[0].severity).toBe('medium');
    expect(out[0].kind).toBe('unargued-commitment');
  });

  it('tolerates a fenced object-envelope answer via parseAgentProposals', () => {
    const answer =
      '```json\n' + JSON.stringify({ findings: [{ sectionTitle: 'Methods', detail: 'd', severity: 'medium' }] }) + '\n```';
    const out = normalizeAuditFindings(parseAgentProposals(answer), { sections });
    expect(out).toHaveLength(1);
    expect(out[0].sectionId).toBe('methods');
  });

  it('returns [] for non-array, null, or empty input', () => {
    expect(normalizeAuditFindings(null, { sections })).toEqual([]);
    expect(normalizeAuditFindings([], { sections })).toEqual([]);
    expect(normalizeAuditFindings('not json', { sections })).toEqual([]);
  });
});

describe('buildAuditSeed', () => {
  it('lists sections with their commitments and folds in a topology note', () => {
    const specs: Record<string, SectionSpec | undefined> = {
      intro: {
        function: 'introduce',
        mainClaim: '',
        requiredMoves: [],
        incomingContext: [],
        outgoingCommitments: ['the frame is set'],
      },
    };
    const seed = buildAuditSeed(sections, specs, { topologyNote: 'Topology: 1 backward arc.' });
    expect(seed).toContain('STRUCTURAL MAP');
    expect(seed).toContain('"Introduction"');
    expect(seed).toContain('establishes: the frame is set');
    expect(seed).toContain('"Methods" (no spec)');
    expect(seed).toContain('Topology: 1 backward arc.');
  });
});
