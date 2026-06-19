import type { StateCreator } from 'zustand';
import type { AppState } from '.';
import type { AtmosphericInstrument } from '../types';

/**
 * The Climate Artist workspace, as an ephemeral slice. Like the Version Compare
 * and Glass Box slices, NOTHING here is persisted: the chosen instrument, the
 * target, and the prose report are all session state, and the report is
 * regenerable on demand. The workspace-open flag lives here — not in ui-state —
 * because it is inseparable from (and resets with) the reading it gates.
 *
 * Pure state only: the AI call (resolve target text → aiProvider.analyzeAtmosphere)
 * lives in features/climate/use-climate-actions, mirroring use-comparison-actions.
 */
export type ClimateStatus = 'idle' | 'running' | 'error';

export interface ClimateSlice {
  climateOpen: boolean;
  /** Which atmospheric instrument runs on the next reading. */
  climateInstrument: AtmosphericInstrument;
  /** Target: null = the whole draft; otherwise a section id. */
  climateTargetId: string | null;
  /** The last reading (essayistic markdown), or null before the first run. */
  climateReport: string | null;
  climateStatus: ClimateStatus;

  openClimate: () => void;
  closeClimate: () => void;
  setClimateInstrument: (instrument: AtmosphericInstrument) => void;
  setClimateTarget: (id: string | null) => void;
  setClimateReport: (report: string | null) => void;
  setClimateStatus: (status: ClimateStatus) => void;
}

export const createClimateSlice: StateCreator<AppState, [], [], ClimateSlice> = (set) => ({
  climateOpen: false,
  climateInstrument: 'radarScan',
  climateTargetId: null,
  climateReport: null,
  climateStatus: 'idle',

  openClimate: () => set({ climateOpen: true }),
  // Closing keeps the last report + selections (regenerable, cheap to keep) but
  // drops any in-flight status, so reopening lands in a settled state.
  closeClimate: () => set({ climateOpen: false, climateStatus: 'idle' }),
  setClimateInstrument: (climateInstrument) => set({ climateInstrument }),
  setClimateTarget: (climateTargetId) => set({ climateTargetId }),
  setClimateReport: (climateReport) => set({ climateReport }),
  setClimateStatus: (climateStatus) => set({ climateStatus }),
});
