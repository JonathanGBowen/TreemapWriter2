import { describe, expect, it } from 'vitest';
import { applySourcePatch, isExegesisStale, sourceContentHash } from '../source-edit';
import { roleGlyph, roleLabel } from '../source-roles';
import type { SourceDocument } from '../../types';

const base = (): SourceDocument => ({
  id: 'src_1',
  role: 'reference',
  kind: roleLabel('reference'),
  label: 'Dewey (1922)',
  glyph: roleGlyph('reference'),
  content: 'Habit is the mainspring of human action.',
  origin: 'paste',
  addedAt: 1,
});

describe('applySourcePatch', () => {
  it('patches label and content without touching anything else', () => {
    const next = applySourcePatch(base(), { label: 'Dewey, HNC', content: 'New text.' });
    expect(next.label).toBe('Dewey, HNC');
    expect(next.content).toBe('New text.');
    expect(next.role).toBe('reference');
    expect(next.kind).toBe(roleLabel('reference'));
    expect(next.glyph).toBe(roleGlyph('reference'));
  });

  it('recomputes the derived kind + glyph on a role change', () => {
    const next = applySourcePatch(base(), { role: 'guidance' });
    expect(next.role).toBe('guidance');
    expect(next.kind).toBe(roleLabel('guidance'));
    expect(next.glyph).toBe(roleGlyph('guidance'));
  });

  it('leaves derived fields alone when the role patch is a no-op', () => {
    const src = { ...base(), kind: 'Custom legacy kind' };
    const next = applySourcePatch(src, { role: 'reference' });
    expect(next.kind).toBe('Custom legacy kind');
  });

  it('never touches an existing exegesis', () => {
    const exegesis = { content: 'Recon.', createdAt: 5, sourceHash: 'abc' };
    const next = applySourcePatch({ ...base(), exegesis }, { content: 'Edited.' });
    expect(next.exegesis).toEqual(exegesis);
  });

  it('does not mutate the input', () => {
    const src = base();
    applySourcePatch(src, { role: 'voice', label: 'x' });
    expect(src.role).toBe('reference');
    expect(src.label).toBe('Dewey (1922)');
  });
});

describe('isExegesisStale', () => {
  it('is false with no exegesis', () => {
    expect(isExegesisStale(base())).toBe(false);
  });

  it('is false when content matches the stamped hash', () => {
    const src = base();
    src.exegesis = { content: 'Recon.', createdAt: 5, sourceHash: sourceContentHash(src.content) };
    expect(isExegesisStale(src)).toBe(false);
  });

  it('ignores whitespace-only drift (normalized hashing)', () => {
    const src = base();
    src.exegesis = { content: 'Recon.', createdAt: 5, sourceHash: sourceContentHash(src.content) };
    src.content = `  ${src.content.replace(' ', '\n')}  `;
    expect(isExegesisStale(src)).toBe(false);
  });

  it('flips true after a real content edit', () => {
    const src = base();
    src.exegesis = { content: 'Recon.', createdAt: 5, sourceHash: sourceContentHash(src.content) };
    src.content = 'Habit is NOT the mainspring of human action.';
    expect(isExegesisStale(src)).toBe(true);
  });
});
