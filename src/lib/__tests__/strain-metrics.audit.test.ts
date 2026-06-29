import { describe, it, expect } from 'vitest';
import { computeAllStrain } from '../strain-metrics';
import type { AuditFinding, Section, SectionSpec, TestSuite } from '../../types';

const sec = (id: string, title: string): Section => ({
  id,
  title,
  level: 1,
  content: '',
  fullContent: '',
  startLine: 0,
  endLine: 0,
  startOffset: 0,
  wordCount: 0,
  children: [],
  parentId: null,
});

const spec = (over: Partial<SectionSpec> = {}): SectionSpec => ({
  function: 'argue',
  mainClaim: '',
  requiredMoves: [],
  incomingContext: [],
  outgoingCommitments: [],
  ...over,
});

const finding = (sectionId: string, over: Partial<AuditFinding> = {}): AuditFinding => ({
  id: `f-${sectionId}`,
  sectionId,
  sectionTitle: '',
  kind: 'unargued-commitment',
  detail: 'a relied-on claim is never argued',
  severity: 'high',
  ...over,
});

describe('computeAllStrain — WS4b audit merge', () => {
  const sections = [sec('a', 'Alpha'), sec('b', 'Beta')];
  const specd = (): TestSuite => ({
    a: { goals: '', status: 'idle', spec: spec() },
    b: { goals: '', status: 'idle', spec: spec() },
  });

  it('surfaces an audit-only section at band MEDIUM (AI never originates a high)', () => {
    const { strained } = computeAllStrain(sections, specd(), [finding('a', { severity: 'high' })]);
    const a = strained.find((s) => s.sectionId === 'a');
    expect(a?.band).toBe('medium'); // capped despite the finding's own 'high' severity
    expect(a?.signals.some((g) => g.kind === 'unargued-commitment' && g.source === 'ai')).toBe(true);
  });

  it('escalates to HIGH when a deterministic mesh break corroborates the same section', () => {
    // Beta declares incoming context that Alpha's outgoing never establishes → a
    // deterministic unmet-incoming. Add an audit finding on Beta → 2 signals → high.
    const ts: TestSuite = {
      a: { goals: '', status: 'idle', spec: spec({ outgoingCommitments: ['the photosynthesis pathway is defined'] }) },
      b: { goals: '', status: 'idle', spec: spec({ incomingContext: ['mitochondrial respiration mechanism'] }) },
    };
    const { strained } = computeAllStrain(sections, ts, [finding('b', { severity: 'medium' })]);
    const b = strained.find((s) => s.sectionId === 'b');
    expect(b?.band).toBe('high');
  });

  it('drops audit findings on spec-less sections (v1 limit — keeps the existing guard)', () => {
    const noSpec: TestSuite = { a: { goals: '', status: 'idle' } };
    const { strained } = computeAllStrain([sec('a', 'Alpha')], noSpec, [finding('a')]);
    expect(strained.find((s) => s.sectionId === 'a')).toBeUndefined();
  });

  it('nothing strained with no findings and no breaks', () => {
    expect(computeAllStrain(sections, specd(), []).count).toBe(0);
  });
});
