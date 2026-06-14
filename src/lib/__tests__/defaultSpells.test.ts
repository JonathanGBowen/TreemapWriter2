import { describe, expect, it } from 'vitest';
import { DEFAULT_SPELLS } from '../defaultSpells';

describe('DEFAULT_SPELLS', () => {
  it('ships the five built-in lenses', () => {
    expect(DEFAULT_SPELLS).toHaveLength(5);
  });

  it('every spell has a non-empty name, persona, and lens', () => {
    for (const spell of DEFAULT_SPELLS) {
      expect(spell.name.trim()).not.toBe('');
      expect(spell.persona.trim()).not.toBe('');
      expect(spell.lens.trim()).not.toBe('');
    }
  });

  it('spell ids are unique', () => {
    const ids = DEFAULT_SPELLS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
