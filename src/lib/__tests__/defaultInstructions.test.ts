import { describe, expect, it } from 'vitest';
import {
  DEFAULT_INSTRUCTION_ID,
  DEFAULT_INSTRUCTIONS,
  resolveActiveInstruction,
  resolveInstructionLibrary,
} from '../defaultInstructions';
import type { RevisionInstruction } from '../../types';

const custom: RevisionInstruction[] = [
  { id: 'voice', label: 'Match my voice', body: 'Keep my register.' },
];

describe('default revision instruction', () => {
  it('ships exactly one built-in default, sourced from the locked registry text', () => {
    expect(DEFAULT_INSTRUCTIONS).toHaveLength(1);
    expect(DEFAULT_INSTRUCTIONS[0].id).toBe(DEFAULT_INSTRUCTION_ID);
    expect(DEFAULT_INSTRUCTIONS[0].body).toMatch(/intrinsic requirements/i);
  });
});

describe('resolveInstructionLibrary', () => {
  it('concatenates built-in defaults with the user library', () => {
    const lib = resolveInstructionLibrary(custom);
    expect(lib.map((i) => i.id)).toEqual([DEFAULT_INSTRUCTION_ID, 'voice']);
  });

  it('lets a custom entry shadow a default of the same id', () => {
    const lib = resolveInstructionLibrary([
      { id: DEFAULT_INSTRUCTION_ID, label: 'Mine', body: 'overridden' },
    ]);
    expect(lib).toHaveLength(1);
    expect(lib[0].body).toBe('overridden');
  });
});

describe('resolveActiveInstruction', () => {
  it('returns the active instruction by id', () => {
    expect(resolveActiveInstruction(custom, 'voice').body).toBe('Keep my register.');
  });

  it('falls back to the built-in default when the active id is unknown or null', () => {
    expect(resolveActiveInstruction(custom, 'gone').id).toBe(DEFAULT_INSTRUCTION_ID);
    expect(resolveActiveInstruction([], null).id).toBe(DEFAULT_INSTRUCTION_ID);
  });
});
