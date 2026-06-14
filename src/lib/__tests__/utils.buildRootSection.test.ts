import { describe, expect, it } from 'vitest';
import { buildRootSection, parseMarkdown } from '../utils';

describe('buildRootSection', () => {
  it('wraps the parsed sections as a synthetic level-0 root', () => {
    const md = '# A\nalpha\n\n# B\nbeta gamma\n';
    const sections = parseMarkdown(md);
    const root = buildRootSection(md, sections, 'My Doc');

    expect(root.id).toBe('root');
    expect(root.level).toBe(0);
    expect(root.title).toBe('My Doc');
    expect(root.parentId).toBeNull();
    // fullContent is the entire document — this is what root analysis/eval reads.
    expect(root.fullContent).toBe(md);
    // children are the already-parsed top-level sections (no copy).
    expect(root.children).toBe(sections);
    expect(root.wordCount).toBe(md.split(/\s+/).filter(Boolean).length);
  });

  it('defaults the title when none is given', () => {
    const root = buildRootSection('x', []);
    expect(root.title).toBe('Document Root');
    expect(root.children).toEqual([]);
  });
});
