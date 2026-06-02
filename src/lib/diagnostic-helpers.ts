// Pure (non-AI) helpers around DiagnosticResult / SectionSpec, extracted from
// the retired `lib/ai-pipeline.tsx` during Phase 3.5. The AI calls themselves
// live in `services/gemini-provider.ts`; what stayed here is the small layer
// of derivation logic that runs locally and has no network dependency.

import type { DiagnosticResult, SectionSpec } from '../types';

/** Derive an overall status from a DiagnosticResult for the treemap coloring. */
export function diagnosticToStatus(diag: DiagnosticResult): 'success' | 'fail' | 'stale' {
  const counts = { present: 0, partial: 0, missing: 0, unclear: 0 };
  diag.moveResults.forEach(mr => { counts[mr.status]++; });

  if (counts.missing === 0 && counts.unclear === 0 && counts.partial === 0) return 'success';
  if (counts.present === 0 && diag.moveResults.length > 0) return 'fail';
  return 'stale';
}

/** Build a fallback spec from a legacy goals string, for backward compatibility. */
export function specFromLegacyGoals(goals: string, mainClaim?: string): SectionSpec {
  return {
    function: 'argue',
    mainClaim: mainClaim || '',
    requiredMoves: goals
      ? [{ id: 'move-0', description: goals }]
      : [],
    incomingContext: [],
    outgoingCommitments: [],
  };
}
