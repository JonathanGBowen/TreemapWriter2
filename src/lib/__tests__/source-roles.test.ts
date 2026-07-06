import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SOURCE_ROLE,
  SOURCE_ROLES,
  roleGlyph,
  roleLabel,
  sourceRoleMeta,
} from '../source-roles';
import type { SourceRole } from '../../types';

const ALL_ROLES: SourceRole[] = ['reference', 'bibliographic', 'guidance', 'voice'];

describe('source-roles', () => {
  it('exposes exactly the four roles', () => {
    expect([...SOURCE_ROLES].sort()).toEqual([...ALL_ROLES].sort());
  });

  it('has complete, non-empty meta for every role', () => {
    for (const role of ALL_ROLES) {
      const meta = sourceRoleMeta[role];
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.glyph.length).toBeGreaterThan(0);
      expect(meta.hint.length).toBeGreaterThan(0);
    }
  });

  it('roleGlyph / roleLabel read from the meta map', () => {
    for (const role of ALL_ROLES) {
      expect(roleGlyph(role)).toBe(sourceRoleMeta[role].glyph);
      expect(roleLabel(role)).toBe(sourceRoleMeta[role].label);
    }
  });

  it('defaults a pasted source to a reference work', () => {
    expect(DEFAULT_SOURCE_ROLE).toBe('reference');
  });
});
