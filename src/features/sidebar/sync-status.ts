import type { PipStatus } from '../shared/Pip';

export type SyncStatus = 'no-remote' | 'idle' | 'pulling' | 'pushing' | 'error' | 'conflict';

export interface SyncSummary {
  pip: PipStatus;
  pulse: boolean;
  text: string;
}

/**
 * Collapse the raw sync state into one composite pip + label.
 * green = safe (local-only or synced clean) · yellow = saved but not pushed, OR
 * error/conflict (palette 3C: magenta is content, not danger — the one alert
 * hue covers both) · cyan pulse = in-flight. Used by the sidebar header pip and
 * the project menu's SYNC row, so they always agree.
 */
export function summarizeSync(status: SyncStatus, error: string | null, ahead: number, behind: number): SyncSummary {
  switch (status) {
    case 'conflict':
      return { pip: 'yellow', pulse: true, text: error || 'merge conflict' };
    case 'error':
      return { pip: 'yellow', pulse: false, text: error || 'sync error' };
    case 'pulling':
      return { pip: 'cyan', pulse: true, text: 'pulling…' };
    case 'pushing':
      return { pip: 'cyan', pulse: true, text: 'pushing…' };
    case 'no-remote':
      return { pip: 'green', pulse: false, text: 'saved · local only' };
    default: {
      const parts = [ahead > 0 ? `${ahead} unpushed` : null, behind > 0 ? `${behind} to pull` : null].filter(Boolean);
      if (parts.length === 0) return { pip: 'green', pulse: false, text: 'saved · synced' };
      return { pip: 'yellow', pulse: false, text: `saved · ${parts.join(' · ')}` };
    }
  }
}
