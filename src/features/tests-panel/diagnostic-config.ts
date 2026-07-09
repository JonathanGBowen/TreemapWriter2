import type { MoveStatus, ReadinessLevel } from "../../types";
import type { PipStatus } from "../shared/Pip";

/** Move verdict → the one pip vocabulary. Palette 3C: magenta is content, not a
 *  failing state, so `missing` moves to yellow (the one alert). */
export const MOVE_STATUS_PIP: Record<MoveStatus, PipStatus> = {
  present: 'green',
  partial: 'yellow',
  missing: 'yellow',
  unclear: 'purple',
};

export const MOVE_STATUS_LABEL: Record<MoveStatus, string> = {
  present: 'done',
  partial: 'partial',
  missing: 'missing',
  unclear: 'unclear',
};

export interface ReadinessInfo {
  /** Filled-step count out of four. */
  level: number;
  label: string;
}

/** Palette 3C: readiness is one teal-fill bar, not a per-level hue ladder — so
 *  each level carries only its fill count + label now. */
export const READINESS: Record<ReadinessLevel, ReadinessInfo> = {
  draft: { level: 1, label: 'Draft' },
  developing: { level: 2, label: 'Developing' },
  'nearly-there': { level: 3, label: 'Nearly there' },
  solid: { level: 4, label: 'Solid' },
};

/** The number of steps in the readiness meter (draft → solid). */
export const READINESS_TOTAL = 4;

export interface ReadinessSummary {
  /** How many of the four steps are filled (0 when undiagnosed). */
  filled: number;
  total: number;
  /** Human label — the readiness name, or "Undiagnosed" when there is no diagnostic. */
  label: string;
  diagnosed: boolean;
}

/**
 * Normalise a section's readiness into ONE labelled ordinal summary — the single
 * status encoder the readiness bar renders (replaces the ad-hoc per-surface
 * diamond rows). `null`/`undefined` = undiagnosed (bar empty). Pure.
 */
export function summarizeReadiness(level: ReadinessLevel | null | undefined): ReadinessSummary {
  if (level == null) {
    return { filled: 0, total: READINESS_TOTAL, label: 'Undiagnosed', diagnosed: false };
  }
  const info = READINESS[level];
  return { filled: info.level, total: READINESS_TOTAL, label: info.label, diagnosed: true };
}

/** Section overall status (testSuite entry) → header pip. Palette 3C: `fail`
 *  moves off magenta (content, not danger) onto yellow, the one alert — the
 *  status label still distinguishes fail from stale. */
export function statusPip(status: string): PipStatus {
  switch (status) {
    case 'success': return 'green';
    case 'fail': return 'yellow';
    case 'stale': return 'yellow';
    case 'running': return 'cyan';
    default: return 'idle';
  }
}
