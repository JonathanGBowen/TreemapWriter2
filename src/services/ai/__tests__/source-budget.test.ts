import { describe, expect, it } from 'vitest';
import { budgetRevisionInput, formatSources } from '../source-budget';
import type { SourceDocument } from '../../../types';

const src = (id: string, chars: number): SourceDocument => ({
  id,
  kind: 'Source',
  label: id,
  glyph: '❡',
  content: 'x'.repeat(chars),
});

const totalSourceChars = (sources: SourceDocument[]) =>
  sources.reduce((n, s) => n + s.content.length, 0);

describe('budgetRevisionInput', () => {
  it('keeps everything on a large window (Gemini ~1M)', () => {
    const sources = [src('a', 40000), src('b', 80000)];
    const out = budgetRevisionInput({
      sectionText: 'y'.repeat(40000),
      sources,
      contextWindow: 1_000_000,
    });
    expect(out.trimmed).toBe(false);
    expect(out.sectionText.length).toBe(40000);
    expect(totalSourceChars(out.sources)).toBe(120000);
  });

  it('trims to fit a small window and flags trimmed, keeping a small section whole', () => {
    const out = budgetRevisionInput({
      sectionText: 'y'.repeat(4000), // ~1k tokens, well under 70% of the budget
      sources: [src('a', 400000), src('b', 400000)],
      contextWindow: 30_000, // usable = 30000 - 16000 - 4000 = 10000 tokens
    });
    expect(out.trimmed).toBe(true);
    expect(out.sectionText.length).toBe(4000); // section kept whole
    // Sources packed into the remaining budget (~9k tokens ≈ 36k chars), not their full 800k.
    expect(totalSourceChars(out.sources)).toBeLessThan(800000);
    expect(totalSourceChars(out.sources)).toBeGreaterThan(0);
  });

  it('does not starve small sources when one source is huge (water-fill)', () => {
    const small = src('small', 2000);
    const huge = src('huge', 1_000_000);
    const out = budgetRevisionInput({
      sectionText: 'y'.repeat(1000),
      sources: [huge, small],
      contextWindow: 60_000, // usable = 40000 tokens; plenty for the small source
    });
    const outSmall = out.sources.find((s) => s.id === 'small')!;
    const outHuge = out.sources.find((s) => s.id === 'huge')!;
    expect(outSmall.content.length).toBe(2000); // small source kept whole
    expect(outHuge.content.length).toBeLessThan(1_000_000); // huge source trimmed
    expect(out.trimmed).toBe(true);
  });

  it('uses a conservative fallback budget when the window is unknown', () => {
    const out = budgetRevisionInput({
      sectionText: 'y'.repeat(400000),
      sources: [src('a', 400000)],
      contextWindow: null,
    });
    expect(out.trimmed).toBe(true);
    // Fallback usable = 8000 tokens (~32k chars); section capped at 70% of it.
    expect(out.sectionText.length).toBeLessThan(400000);
    expect(out.usableTokens).toBe(8000);
  });

  it('lets the section use the whole budget when there are no sources', () => {
    const out = budgetRevisionInput({ sectionText: 'y'.repeat(20000), sources: [], contextWindow: null });
    expect(out.sectionText.length).toBe(20000); // ~5k tokens < 8k fallback, kept whole
    expect(out.trimmed).toBe(false);
    expect(out.sources).toEqual([]);
  });
});

describe('formatSources', () => {
  it('renders id/label/kind blocks and a placeholder when empty', () => {
    expect(formatSources([src('s1', 3)])).toContain('[Source ID: s1]');
    expect(formatSources([], '(none)')).toBe('(none)');
  });
});
