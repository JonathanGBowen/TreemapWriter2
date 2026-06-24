// The Gist Editor workspace slice — EPHEMERAL only. The persisted scale model
// (segmentation, analysis, grains) lives in document-state (`gist`), like the
// Parallel Editor's outlineA; this slice holds the view-model that drives the
// panel: which grain is shown, panel width, hover, in-flight flags, runtime
// staleness, and the didactic voice toggle. All of it is lost on reload, by design.

import type { StateCreator } from 'zustand';
import type { AppState } from '.';
import type { GistGrain } from '../types';

/** Didactic toggle: the real performing gist vs. the describing anti-pattern. */
export type GistVoiceMode = 'perform' | 'describe';

/** The resizable gist panel: design §4 (260–420 px, default 336). */
export const GIST_PANEL_MIN = 260;
export const GIST_PANEL_MAX = 420;
export const GIST_PANEL_DEFAULT = 336;

export interface GistSlice {
  gistOpen: boolean;
  /** The grain currently rendered. Re-derived by the fit hook; g0 is the safe default. */
  gistGrain: GistGrain;
  /** Resizable gist-panel width (px), clamped to [GIST_PANEL_MIN, GIST_PANEL_MAX]. */
  gistPanelW: number;
  /** The hovered span's segment id — previews the destination section tint. */
  gistHoverId: string | null;
  /** A full generation is in flight; the old gist stays visible until the swap. */
  gistGenerating: boolean;
  /** The segment id mid per-span refresh (Prompt C), or null. */
  gistRefreshingId: string | null;
  /** Runtime staleness, recomputed on edit — never persisted (P6: annotate, don't rewrite). */
  gistStaleIds: string[];
  /** Runtime orphan ids (source section gone), recomputed alongside staleness. */
  gistOrphanIds: string[];
  /** Didactic perform⇄describe toggle (non-persisting; never sent to the model). */
  gistVoiceMode: GistVoiceMode;

  openGist: () => void;
  closeGist: () => void;
  setGistGrain: (grain: GistGrain) => void;
  setGistPanelW: (w: number) => void;
  setGistHoverId: (id: string | null) => void;
  setGistGenerating: (on: boolean) => void;
  setGistRefreshingId: (id: string | null) => void;
  setGistStale: (staleIds: string[], orphanIds: string[]) => void;
  setGistVoiceMode: (mode: GistVoiceMode) => void;
  resetGist: () => void;
}

/** Cleared per-session view state (kept out of openGist's persistent panel width). */
const CLEARED = {
  gistGrain: 'g0' as GistGrain,
  gistHoverId: null as string | null,
  gistGenerating: false,
  gistRefreshingId: null as string | null,
  gistStaleIds: [] as string[],
  gistOrphanIds: [] as string[],
  gistVoiceMode: 'perform' as GistVoiceMode,
};

export const createGistSlice: StateCreator<AppState, [], [], GistSlice> = (set) => ({
  gistOpen: false,
  gistPanelW: GIST_PANEL_DEFAULT,
  ...CLEARED,

  // Open/close are inherently non-destructive (the gist content persists in
  // document-state; the editor is the real document). No confirm.
  openGist: () => set({ gistOpen: true, ...CLEARED }),
  closeGist: () => set({ gistOpen: false, ...CLEARED }),
  setGistGrain: (gistGrain) => set({ gistGrain }),
  setGistPanelW: (gistPanelW) => set({ gistPanelW }),
  setGistHoverId: (gistHoverId) => set({ gistHoverId }),
  setGistGenerating: (gistGenerating) => set({ gistGenerating }),
  setGistRefreshingId: (gistRefreshingId) => set({ gistRefreshingId }),
  setGistStale: (gistStaleIds, gistOrphanIds) => set({ gistStaleIds, gistOrphanIds }),
  setGistVoiceMode: (gistVoiceMode) => set({ gistVoiceMode }),
  resetGist: () => set({ ...CLEARED }),
});
