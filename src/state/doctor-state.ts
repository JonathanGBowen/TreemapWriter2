import type { StateCreator } from 'zustand';
import type { AppState } from '.';
import type {
  CoherenceRow,
  DoctorOutlineRow,
  DoctorReportInstrument,
  DoctorRowInstrument,
  DoctorTask,
  FunctionalOutlineRow,
  ParagraphDiagnosis,
  RoadmapOption,
  ThesisOption,
} from '../types';

/**
 * The Reverse Outline Doctor workspace, as an ephemeral slice. Like the Climate
 * slice, every reading here is regenerable session state; the ONLY domain landing
 * is the saved checklist (document-state `doctorChecklist`, written by the
 * step-5 Save action). The workspace-open flag lives here — not in ui-state —
 * because it is inseparable from the readings it gates.
 *
 * Two halves, mirroring the ported app: `instruments` (one-shot readings —
 * outlines, thesis check, reports, the ¶ diagnostic) and `wizard` (the renamed
 * Breakthrough Sequence: a forward walk over DOCTOR_STEPS with a cursor, per the
 * interpolation/segment stepped-slice pattern).
 *
 * Pure state only: the AI calls live in features/doctor/use-doctor-actions +
 * use-doctor-wizard-actions, mirroring use-climate-actions.
 */
export type DoctorMode = 'instruments' | 'wizard';
export type DoctorInstrument = DoctorRowInstrument | DoctorReportInstrument | 'paragraph';
export type DoctorStatus = 'idle' | 'running' | 'streaming' | 'error';

/** The wizard's frozen step plan, in walk order. */
export const DOCTOR_STEPS = ['discovery', 'calibration', 'diagnosis', 'strategy', 'action'] as const;
export type DoctorStep = (typeof DOCTOR_STEPS)[number];

export interface DoctorSlice {
  doctorOpen: boolean;
  doctorMode: DoctorMode;
  doctorInstrument: DoctorInstrument;
  /** Target: null = the whole draft; otherwise a section id (climate pattern). */
  doctorTargetId: string | null;
  /** The working thesis every reading is made against (seeded from the root claim). */
  doctorThesis: string;
  /** Where the working thesis came from — provenance for the ThesisBar. */
  doctorThesisSource: 'document' | 'distilled' | 'typed' | null;

  // Last instrument results (regenerable; kept across close, climate-style).
  doctorOutlineRows: DoctorOutlineRow[] | null;
  /** Hash of the scope prose the claims outline was generated from (staleness). */
  doctorOutlineHash: string | null;
  doctorSaysDoesRows: FunctionalOutlineRow[] | null;
  doctorCoherenceRows: CoherenceRow[] | null;
  doctorReport: { instrument: DoctorReportInstrument; markdown: string } | null;
  /** Which block index the ¶ instrument targets (into the current scope's blocks). */
  doctorParagraphIndex: number | null;
  doctorParagraphDiag: ParagraphDiagnosis | null;
  /** Distiller result — shared by the instruments' ThesisBar and wizard step 1. */
  doctorThesisOptions: ThesisOption[] | null;
  doctorStatus: DoctorStatus;

  // The wizard walk: cursor into DOCTOR_STEPS + per-step outputs. Retreating
  // clears everything downstream (cheap, regenerable — the interpolation spirit).
  doctorStepCursor: number;
  /** Step-3 streamed CoT prose (accumulates chunk by chunk). */
  doctorDiagnosis: string;
  /** The extracted "most critical issue" sentence — user-editable. */
  doctorCriticalIssue: string;
  doctorRoadmaps: RoadmapOption[] | null;
  doctorChosenRoadmap: number | null;
  /** Step-5 preview tasks, before Save lands them in document-state. */
  doctorDraftTasks: DoctorTask[] | null;
  /** Monotonic guard: a stale diagnosis stream stops appending after a reset. */
  doctorWizardEpoch: number;

  openDoctor: () => void;
  closeDoctor: () => void;
  setDoctorMode: (mode: DoctorMode) => void;
  setDoctorInstrument: (instrument: DoctorInstrument) => void;
  setDoctorTarget: (id: string | null) => void;
  setDoctorThesis: (thesis: string, source: 'document' | 'distilled' | 'typed') => void;
  setDoctorOutlineRows: (rows: DoctorOutlineRow[] | null, sourceHash?: string | null) => void;
  setDoctorSaysDoesRows: (rows: FunctionalOutlineRow[] | null) => void;
  setDoctorCoherenceRows: (rows: CoherenceRow[] | null) => void;
  setDoctorReport: (report: { instrument: DoctorReportInstrument; markdown: string } | null) => void;
  setDoctorParagraphIndex: (index: number | null) => void;
  setDoctorParagraphDiag: (diag: ParagraphDiagnosis | null) => void;
  setDoctorThesisOptions: (options: ThesisOption[] | null) => void;
  setDoctorStatus: (status: DoctorStatus) => void;
  appendDoctorDiagnosis: (chunk: string) => void;
  setDoctorCriticalIssue: (issue: string) => void;
  setDoctorRoadmaps: (roadmaps: RoadmapOption[] | null) => void;
  chooseDoctorRoadmap: (index: number | null) => void;
  setDoctorDraftTasks: (tasks: DoctorTask[] | null) => void;
  advanceDoctorStep: () => void;
  retreatDoctorStep: () => void;
  resetDoctorWizard: () => void;
}

/** Wizard fields downstream of a given cursor, cleared on retreat/reset. */
const WIZARD_CLEARED = {
  doctorDiagnosis: '',
  doctorCriticalIssue: '',
  doctorRoadmaps: null,
  doctorChosenRoadmap: null,
  doctorDraftTasks: null,
} as const;

export const createDoctorSlice: StateCreator<AppState, [], [], DoctorSlice> = (set, get) => ({
  doctorOpen: false,
  doctorMode: 'instruments',
  doctorInstrument: 'saysDoes',
  doctorTargetId: null,
  doctorThesis: '',
  doctorThesisSource: null,
  doctorOutlineRows: null,
  doctorOutlineHash: null,
  doctorSaysDoesRows: null,
  doctorCoherenceRows: null,
  doctorReport: null,
  doctorParagraphIndex: null,
  doctorParagraphDiag: null,
  doctorThesisOptions: null,
  doctorStatus: 'idle',
  doctorStepCursor: 0,
  doctorDiagnosis: '',
  doctorCriticalIssue: '',
  doctorRoadmaps: null,
  doctorChosenRoadmap: null,
  doctorDraftTasks: null,
  doctorWizardEpoch: 0,

  openDoctor: () => {
    const s = get();
    // Seed the working thesis from the document's claim when none is set yet —
    // the Doctor reads against the root spec's mainClaim by default; the
    // Distiller is the fallback for a discovery draft with no claim.
    if (!s.doctorThesis.trim()) {
      const root = s.testSuite['root'];
      const claim = (root?.spec?.mainClaim ?? root?.mainClaim ?? '').trim();
      if (claim) {
        set({ doctorOpen: true, doctorThesis: claim, doctorThesisSource: 'document' });
        return;
      }
    }
    set({ doctorOpen: true });
  },
  // Closing keeps the readings + wizard progress (regenerable, cheap to keep)
  // but drops any in-flight status, so reopening lands in a settled state.
  closeDoctor: () => set({ doctorOpen: false, doctorStatus: 'idle' }),
  setDoctorMode: (doctorMode) => set({ doctorMode }),
  setDoctorInstrument: (doctorInstrument) => set({ doctorInstrument }),
  // A new target invalidates every scope-derived reading (rows are block-indexed
  // against the OLD scope's numbering) — clear them, keep the thesis.
  setDoctorTarget: (doctorTargetId) =>
    set((s) => {
      if (s.doctorTargetId === doctorTargetId) return {};
      return {
        doctorTargetId,
        doctorOutlineRows: null,
        doctorOutlineHash: null,
        doctorSaysDoesRows: null,
        doctorCoherenceRows: null,
        doctorReport: null,
        doctorParagraphIndex: null,
        doctorParagraphDiag: null,
        doctorStepCursor: 0,
        doctorWizardEpoch: s.doctorWizardEpoch + 1,
        ...WIZARD_CLEARED,
      };
    }),
  setDoctorThesis: (doctorThesis, doctorThesisSource) => set({ doctorThesis, doctorThesisSource }),
  setDoctorOutlineRows: (doctorOutlineRows, sourceHash = null) =>
    set({ doctorOutlineRows, doctorOutlineHash: sourceHash }),
  setDoctorSaysDoesRows: (doctorSaysDoesRows) => set({ doctorSaysDoesRows }),
  setDoctorCoherenceRows: (doctorCoherenceRows) => set({ doctorCoherenceRows }),
  setDoctorReport: (doctorReport) => set({ doctorReport }),
  setDoctorParagraphIndex: (doctorParagraphIndex) => set({ doctorParagraphIndex }),
  setDoctorParagraphDiag: (doctorParagraphDiag) => set({ doctorParagraphDiag }),
  setDoctorThesisOptions: (doctorThesisOptions) => set({ doctorThesisOptions }),
  setDoctorStatus: (doctorStatus) => set({ doctorStatus }),
  appendDoctorDiagnosis: (chunk) => set((s) => ({ doctorDiagnosis: s.doctorDiagnosis + chunk })),
  setDoctorCriticalIssue: (doctorCriticalIssue) => set({ doctorCriticalIssue }),
  setDoctorRoadmaps: (doctorRoadmaps) => set({ doctorRoadmaps }),
  chooseDoctorRoadmap: (doctorChosenRoadmap) => set({ doctorChosenRoadmap }),
  setDoctorDraftTasks: (doctorDraftTasks) => set({ doctorDraftTasks }),
  advanceDoctorStep: () =>
    set((s) => ({ doctorStepCursor: Math.min(s.doctorStepCursor + 1, DOCTOR_STEPS.length - 1) })),
  // Going back invalidates what was derived downstream of the landing step —
  // clear it rather than show a stale chain (regenerable by walking forward).
  retreatDoctorStep: () =>
    set((s) => {
      const cursor = Math.max(s.doctorStepCursor - 1, 0);
      const cleared: Partial<DoctorSlice> = { doctorWizardEpoch: s.doctorWizardEpoch + 1 };
      if (cursor <= 3) {
        cleared.doctorDraftTasks = null;
        cleared.doctorChosenRoadmap = null;
      }
      if (cursor <= 2) cleared.doctorRoadmaps = null;
      if (cursor <= 1) {
        cleared.doctorDiagnosis = '';
        cleared.doctorCriticalIssue = '';
      }
      return { doctorStepCursor: cursor, ...cleared };
    }),
  resetDoctorWizard: () =>
    set((s) => ({
      doctorStepCursor: 0,
      doctorWizardEpoch: s.doctorWizardEpoch + 1,
      ...WIZARD_CLEARED,
    })),
});
