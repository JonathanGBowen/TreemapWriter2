import { describe, it, expect } from 'vitest';
import { buildAgentContext } from '../agent-context';
import type { Section, SectionSpec } from '../../../../types';

function sec(partial: Partial<Section> & { id: string; title: string }): Section {
  return {
    level: 1,
    content: '',
    fullContent: '',
    startLine: 0,
    endLine: 0,
    startOffset: 0,
    wordCount: 0,
    children: [],
    parentId: null,
    ...partial,
  };
}

const spec = (mainClaim: string, extra: Partial<SectionSpec> = {}): SectionSpec => ({
  function: 'argue',
  mainClaim,
  requiredMoves: [],
  incomingContext: [],
  outgoingCommitments: [],
  ...extra,
});

describe('buildAgentContext', () => {
  const intro = sec({
    id: 'intro',
    title: 'Introduction',
    level: 2,
    fullContent: 'The introduction body, in full.',
    parentId: 'ch1',
  });
  const method = sec({
    id: 'method',
    title: 'Method',
    level: 2,
    fullContent: 'Method body.',
    parentId: 'ch1',
  });
  const ch1 = sec({
    id: 'ch1',
    title: 'Chapter 1',
    level: 1,
    fullContent: 'Chapter 1 whole.',
    children: [intro, method],
  });
  const sections = [ch1];
  const specs: Record<string, SectionSpec | undefined> = {
    root: spec('The document proves X.'),
    ch1: spec('Chapter 1 establishes the frame.'),
    intro: spec('The intro motivates the problem.'),
    method: spec('Method specifies the procedure.', { incomingContext: ['the framing from intro'] }),
  };

  it('section scope sends the full section text plus its structural surround', () => {
    const ctx = buildAgentContext({
      scope: 'section',
      selectedSectionId: 'intro',
      sections,
      markdown: 'WHOLE DOC',
      specs,
    });
    expect(ctx).toContain('The introduction body, in full.');
    expect(ctx).toContain('STRUCTURAL SURROUND');
    // The surround names the whole and the parent the part serves.
    expect(ctx).toContain('The document proves X.');
    expect(ctx).toContain('Chapter 1 establishes the frame.');
  });

  it('document scope sends the whole markdown', () => {
    const ctx = buildAgentContext({
      scope: 'document',
      sections,
      markdown: 'THE WHOLE DOCUMENT TEXT',
      specs,
    });
    expect(ctx).toContain('THE WHOLE DOCUMENT TEXT');
  });

  it('degrades an over-budget whole to an OUTLINE of the whole, never a subset', () => {
    const big = 'x'.repeat(500);
    const ctx = buildAgentContext({
      scope: 'document',
      sections,
      markdown: big,
      specs,
      budgetChars: 50,
    });
    // Outline marker + every heading present; the full body is NOT dumped.
    expect(ctx).toContain('OUTLINE of the whole');
    expect(ctx).toContain('Introduction');
    expect(ctx).toContain('Method');
    expect(ctx).not.toContain(big);
  });
});
