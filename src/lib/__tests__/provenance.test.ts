import { describe, it, expect } from 'vitest';
import type { DecorationSet } from '@codemirror/view';
import { makeProvenanceMark, PROVENANCE_ANCHOR_LEN } from '../provenance';
import { buildProvenanceDeco } from '../provenanceMarks';
import type { ProvenanceMark } from '../../types';

describe('makeProvenanceMark', () => {
  it('returns null for empty or blank text', () => {
    expect(makeProvenanceMark('', 'revision', 1)).toBeNull();
    expect(makeProvenanceMark('   \n  ', 'revision', 1)).toBeNull();
  });

  it('captures the anchor prefix, length, source, and at', () => {
    const text = 'The objection fails because the premise equivocates.';
    const mark = makeProvenanceMark(text, 'revision', 1700)!;
    expect(mark.anchor).toBe(text.slice(0, PROVENANCE_ANCHOR_LEN));
    expect(mark.length).toBe(text.length);
    expect(mark.source).toBe('revision');
    expect(mark.at).toBe(1700);
    expect(mark.id).toContain('1700');
  });

  it('truncates the anchor to the prefix length but keeps the full span length', () => {
    const mark = makeProvenanceMark('x'.repeat(200), 'parallel', 2)!;
    expect(mark.anchor.length).toBe(PROVENANCE_ANCHOR_LEN);
    expect(mark.length).toBe(200);
  });
});

const collect = (deco: DecorationSet): { from: number; to: number }[] => {
  const out: { from: number; to: number }[] = [];
  deco.between(0, 1e9, (from, to) => {
    out.push({ from, to });
  });
  return out;
};

describe('buildProvenanceDeco', () => {
  it('is empty for no marks', () => {
    expect(buildProvenanceDeco('hello world', []).size).toBe(0);
  });

  it('decorates the span at a found anchor', () => {
    const doc = 'Intro. AI SENTENCE here. Outro.';
    const mark = makeProvenanceMark('AI SENTENCE here.', 'revision', 1)!;
    const ranges = collect(buildProvenanceDeco(doc, [mark]));
    const from = doc.indexOf('AI SENTENCE here.');
    expect(ranges).toEqual([{ from, to: from + 'AI SENTENCE here.'.length }]);
  });

  it('drops a mark whose anchor was rewritten (prose became the writer\'s own)', () => {
    const mark = makeProvenanceMark('original AI text', 'revision', 1)!;
    expect(buildProvenanceDeco('the writer rewrote everything here', [mark]).size).toBe(0);
  });

  it('clamps the decoration to the document end', () => {
    const doc = 'short AI';
    const mark: ProvenanceMark = { id: 'p', anchor: 'AI', length: 999, source: 'revision', at: 1 };
    const ranges = collect(buildProvenanceDeco(doc, [mark]));
    expect(ranges).toEqual([{ from: doc.indexOf('AI'), to: doc.length }]);
  });

  it('pins a mark to its recorded offset over an earlier duplicate of the anchor', () => {
    // The same inserted phrase appears twice; the accept wrote the SECOND one.
    const doc = 'AI phrase in section one. Later: AI phrase in section three.';
    const second = doc.lastIndexOf('AI phrase');
    const mark = makeProvenanceMark('AI phrase in section three.', 'revision', 1, second)!;
    expect(mark.offset).toBe(second);
    const ranges = collect(buildProvenanceDeco(doc, [mark]));
    expect(ranges).toEqual([{ from: second, to: second + 'AI phrase in section three.'.length }]);
  });

  it('falls back to indexOf when the recorded offset no longer matches', () => {
    const doc = 'moved: AI SENTENCE here.';
    const mark = makeProvenanceMark('AI SENTENCE here.', 'revision', 1, 0)!; // stale offset
    const from = doc.indexOf('AI SENTENCE here.');
    expect(collect(buildProvenanceDeco(doc, [mark]))).toEqual([
      { from, to: from + 'AI SENTENCE here.'.length },
    ]);
  });
});
