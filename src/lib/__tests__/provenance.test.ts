import { describe, it, expect } from 'vitest';
import type { DecorationSet } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { makeProvenanceMark, PROVENANCE_ANCHOR_LEN } from '../provenance';
import { buildProvenanceDeco, provenanceField, setProvenanceMarks } from '../provenanceMarks';
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

describe('provenanceField (live tracking)', () => {
  it('drops a tracked mark whose opening the writer rewrote — never jumps to an earlier duplicate', () => {
    // The same opening exists at offset 0 (the writer's own prose) and later
    // (the accepted AI span). The mark is pinned to the LATER occurrence.
    const opening = 'The results show something interesting about the case at hand.';
    const doc = `${opening} More writer prose.\n\n${opening} AI continuation.`;
    const aiAt = doc.lastIndexOf(opening);
    const mark = makeProvenanceMark(`${opening} AI continuation.`, 'revision', 1, aiAt)!;

    const s0 = EditorState.create({ doc, extensions: [provenanceField] });
    const s1 = s0.update({ effects: setProvenanceMarks.of([mark]) }).state;
    expect(s1.field(provenanceField).offsets).toEqual([aiAt]);

    // Editing inside the AI span's anchor invalidates it at the tracked spot.
    // The tint must FALL OFF (the prose is the writer's now), not relocate to
    // the duplicate opening at offset 0.
    const s2 = s1.update({ changes: { from: aiAt + 4, to: aiAt + 11, insert: 'findings' } }).state;
    expect(s2.field(provenanceField).offsets).toEqual([-1]);
  });

  it('keeps tracking a mark through edits elsewhere in the document', () => {
    const doc = 'Writer intro.\n\nAI SENTENCE that was accepted here, long enough to matter.';
    const aiAt = doc.indexOf('AI SENTENCE');
    const mark = makeProvenanceMark(doc.slice(aiAt), 'revision', 1, aiAt)!;
    const s0 = EditorState.create({ doc, extensions: [provenanceField] });
    const s1 = s0.update({ effects: setProvenanceMarks.of([mark]) }).state;
    const s2 = s1.update({ changes: { from: 0, insert: 'New first line.\n' } }).state;
    expect(s2.field(provenanceField).offsets).toEqual([aiAt + 'New first line.\n'.length]);
  });
});
