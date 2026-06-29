import type { MoveResult, MoveStatus, Section, TestSuiteEntry } from '../../types';

/**
 * The single move the structure is now asking the writer to perform, surfaced at
 * the point of action (F5). Derived from the section's last diagnostic (preferred)
 * or, before any diagnostic, the spec's first required move.
 */
export interface ActiveMoveCue {
  /** The one-line demand — a vector (preferred) or a move/spec description. */
  text: string;
  /** The located gap / diagnosis behind the demand (the "why"), revealed on hover. */
  detail?: string;
  /** Status of the underlying move; drives the margin pip's colour. */
  status: MoveStatus;
  /** Where the cue came from, for wording. */
  source: 'vector' | 'move' | 'spec';
}

/** The first move the structure still owes: 'missing' is the true gap (surface
 *  first); 'partial'/'unclear' are in-progress. 'present' moves are not unmet. */
const firstUnmet = (moves?: MoveResult[]): MoveResult | undefined => {
  if (!moves) return undefined;
  return (
    moves.find((m) => m.status === 'missing') ??
    moves.find((m) => m.status === 'partial' || m.status === 'unclear')
  );
};

/**
 * Pure: pick the active move for a section, or null when there is nothing the
 * structure is asking for here (no section, the whole-document node, a solved
 * section, or no spec/diagnostic yet). No store, no React — unit-testable.
 *
 * Preference mirrors the diagnostic's own ladder: the located gap→vector
 * (`nextAction`, demand rhetoric) beats a raw unmet `MoveResult`, which beats the
 * spec's first `requiredMove` (the "where to start" before any diagnostic exists).
 * This is what lets the cue name *what the structure now requires, here* rather
 * than a generic checklist — the F5 / concrete-operation intent.
 */
export const selectActiveMove = (
  section: Section | null,
  entry: TestSuiteEntry | undefined,
): ActiveMoveCue | null => {
  if (!section || section.id === 'root') return null;
  if (entry?.status === 'success') return null;

  const diag = entry?.lastDiagnostic;
  const worst = firstUnmet(diag?.moveResults);

  const vector = diag?.nextAction?.vector?.trim();
  if (vector) {
    return {
      text: vector,
      detail: diag?.nextAction?.gap?.trim() || undefined,
      // A vector with no specific unmet move is a refinement, not a hole: attention, not alarm.
      status: worst?.status ?? 'partial',
      source: 'vector',
    };
  }

  if (worst) {
    return {
      text: (worst.suggestedAction || worst.moveDescription).trim(),
      detail: worst.diagnosis?.trim() || undefined,
      status: worst.status,
      source: 'move',
    };
  }

  const firstMove = entry?.spec?.requiredMoves?.[0];
  if (firstMove?.description?.trim()) {
    return { text: firstMove.description.trim(), status: 'missing', source: 'spec' };
  }

  return null;
};
