import type { MoveStatus, ReadinessLevel } from "../../types";
import type { PipStatus } from "../shared/Pip";

/** Move verdict → the one pip vocabulary. */
export const MOVE_STATUS_PIP: Record<MoveStatus, PipStatus> = {
  present: 'green',
  partial: 'yellow',
  missing: 'magenta',
  unclear: 'purple',
};

export const MOVE_STATUS_LABEL: Record<MoveStatus, string> = {
  present: 'done',
  partial: 'partial',
  missing: 'missing',
  unclear: 'unclear',
};

export interface ReadinessInfo {
  /** Filled-pip count out of four. */
  level: number;
  pip: PipStatus;
  label: string;
}

export const READINESS: Record<ReadinessLevel, ReadinessInfo> = {
  draft: { level: 1, pip: 'magenta', label: 'Draft' },
  developing: { level: 2, pip: 'yellow', label: 'Developing' },
  'nearly-there': { level: 3, pip: 'cyan', label: 'Nearly there' },
  solid: { level: 4, pip: 'green', label: 'Solid' },
};

/** The number of steps in the readiness meter (draft → solid). */
export const READINESS_TOTAL = 4;

export interface ReadinessSummary {
  /** How many of the four steps are filled (0 when undiagnosed). */
  filled: number;
  total: number;
  /** Hue for the filled steps; `idle` when undiagnosed. */
  pip: PipStatus;
  /** Human label — the readiness name, or "Undiagnosed" when there is no diagnostic. */
  label: string;
  diagnosed: boolean;
}

/**
 * Normalise a section's readiness into ONE labelled ordinal summary — the single
 * status encoder the 4-step meter renders (replaces the ad-hoc per-surface
 * diamond rows). `null`/`undefined` = undiagnosed (all steps hollow). Pure.
 */
export function summarizeReadiness(level: ReadinessLevel | null | undefined): ReadinessSummary {
  if (level == null) {
    return { filled: 0, total: READINESS_TOTAL, pip: 'idle', label: 'Undiagnosed', diagnosed: false };
  }
  const info = READINESS[level];
  return { filled: info.level, total: READINESS_TOTAL, pip: info.pip, label: info.label, diagnosed: true };
}

/** Section overall status (testSuite entry) → header pip. */
export function statusPip(status: string): PipStatus {
  switch (status) {
    case 'success': return 'green';
    case 'fail': return 'magenta';
    case 'stale': return 'yellow';
    case 'running': return 'cyan';
    default: return 'idle';
  }
}
