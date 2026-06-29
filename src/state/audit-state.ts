import type { StateCreator } from 'zustand';
import type { AppState } from '.';
import type { AuditFinding } from '../types';

/**
 * The whole-document argument audit (WS4b) — ephemeral, regenerable, and NEVER
 * persisted (re-run to refresh). Holds the latest run's findings + status, read by
 * the Audit modal and folded into the Structural-Tension Register. Mirrors the other
 * on-demand-report slices (comparison-state / spec-test-state): UI/session state only.
 */
export type AuditStatus = 'idle' | 'running' | 'error';

export interface AuditSlice {
  auditFindings: AuditFinding[];
  auditStatus: AuditStatus;
  /** When the latest findings were produced (epoch ms), or null if never run. */
  auditRunAt: number | null;

  setAuditStatus: (status: AuditStatus) => void;
  /** Replace the findings with a fresh run's output (`at` = the run's timestamp). */
  setAuditFindings: (findings: AuditFinding[], at: number) => void;
  clearAudit: () => void;
}

export const createAuditSlice: StateCreator<AppState, [], [], AuditSlice> = (set) => ({
  auditFindings: [],
  auditStatus: 'idle',
  auditRunAt: null,

  setAuditStatus: (auditStatus) => set({ auditStatus }),
  setAuditFindings: (auditFindings, auditRunAt) =>
    set({ auditFindings, auditRunAt, auditStatus: 'idle' }),
  clearAudit: () => set({ auditFindings: [], auditStatus: 'idle', auditRunAt: null }),
});
