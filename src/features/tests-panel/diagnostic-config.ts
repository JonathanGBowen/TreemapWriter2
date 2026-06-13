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
