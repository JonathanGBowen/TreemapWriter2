import type { RevisionInstruction } from '../types';
import { getPromptText } from '../services/prompts';

/**
 * Built-in revision "Instructions" — the grounding stance for a SOURCELESS pass.
 * Mirrors `lib/defaultSpells.ts`: the defaults live in code, the user can add
 * custom ones (stored in `revisionInstructions` on the AI slice, a global
 * library). The active instruction is whichever id matches the concatenation of
 * these defaults plus customs (a custom may shadow a default of the same id).
 *
 * The default's TEXT is sourced from the locked prompt registry entry
 * (`revisionInstructionDefault`) so the wording stays content-not-code (law #5).
 */
export const DEFAULT_INSTRUCTION_ID = 'default';

export const DEFAULT_INSTRUCTIONS: RevisionInstruction[] = [
  {
    id: DEFAULT_INSTRUCTION_ID,
    label: 'Intrinsic requirements',
    body: getPromptText('revisionInstructionDefault'),
  },
];

/** The full library: built-in defaults ⊕ user-saved (a custom shadows a default of the same id). */
export const resolveInstructionLibrary = (
  custom: RevisionInstruction[],
): RevisionInstruction[] => {
  const customIds = new Set(custom.map((i) => i.id));
  return [...DEFAULT_INSTRUCTIONS.filter((d) => !customIds.has(d.id)), ...custom];
};

/** Resolve the active instruction; falls back to the first built-in default. */
export const resolveActiveInstruction = (
  custom: RevisionInstruction[],
  activeId: string | null,
): RevisionInstruction => {
  const library = resolveInstructionLibrary(custom);
  return library.find((i) => i.id === activeId) ?? library[0] ?? DEFAULT_INSTRUCTIONS[0];
};
