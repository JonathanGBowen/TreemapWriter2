import { useStore } from '../../state';
import type { SegmentGenre, SegmentGranularity, SegmentMode } from '../../types';
import type { ModelTier } from '../../services/ai/model-catalog';
import { SegControl, type SegOption } from '../modals/shared/SegControl';
import { resolveDepthChoice, tierOf, depthModelLabel } from '../modals/analysis/depth-choice';
import { useSegmentActions } from './use-segment-actions';

const MODES: SegmentMode[] = ['conservative', 'exploratory', 'summaries'];
const MODE_GLYPHS = ['◈', '✶', '❝'];
const MODE_LABELS = ['Conserve', 'Explore', 'Summaries'];

const GRAINS: SegmentGranularity[] = ['coarse', 'medium', 'fine'];
const GRAIN_GLYPHS = ['◦', '◦◦', '◦◦◦'];
const GRAIN_LABELS = ['Coarse', 'Medium', 'Fine'];

const GENRES: SegmentGenre[] = ['article', 'monograph', 'compilation'];
const GENRE_GLYPHS = ['¶', '▭', '❏'];
const GENRE_LABELS = ['Article', 'Mono', 'Volume'];

const DEPTH_TIERS: ModelTier[] = ['fast', 'balanced', 'deep'];
const DEPTH_GLYPHS = ['»', '»»', '◆'];
const DEPTH_LABELS = ['Fast', 'Balanced', 'Deep'];

/** Header: Done · ⑂ Articulate · mode · granularity · genre · depth · run all · continue. */
export function SegmentTopBar() {
  const close = useStore((s) => s.closeSegment);
  const catalog = useStore((s) => s.modelCatalog);
  const mode = useStore((s) => s.segmentMode);
  const setMode = useStore((s) => s.setSegmentMode);
  const grain = useStore((s) => s.segmentGranularity);
  const setGrain = useStore((s) => s.setSegmentGranularity);
  const genre = useStore((s) => s.segmentGenre);
  const setGenre = useStore((s) => s.setSegmentGenre);
  const depth = useStore((s) => s.segmentDepthChoice);
  const setDepth = useStore((s) => s.setSegmentDepthChoice);
  const cursor = useStore((s) => s.segmentCursor);
  const levels = useStore((s) => s.segmentLevels);
  const done = useStore((s) => s.segmentDone);

  const { runAllRemaining, continueToSpecs } = useSegmentActions();

  const depthIndex = DEPTH_TIERS.indexOf(tierOf(catalog, depth));
  const depthOptions: SegOption[] = DEPTH_TIERS.map((tier, i) => ({
    glyph: DEPTH_GLYPHS[i],
    label: DEPTH_LABELS[i],
    fine: depthModelLabel(catalog, depth, tier),
  }));
  const seg = (glyphs: string[], labels: string[]): SegOption[] =>
    glyphs.map((g, i) => ({ glyph: g, label: labels[i] }));

  const acceptedCount = levels.filter((l) => l?.status === 'accepted').length;
  const anyBusy = levels.some((l) => l?.status === 'generating');

  return (
    <div className="h-[54px] shrink-0 flex items-center gap-3 px-[18px] border-b border-hld-cyan/25 bg-gradient-to-b from-hld-cyan/5 to-transparent overflow-x-auto">
      <button
        type="button"
        onClick={close}
        className="px-2.5 py-1.5 border border-hld-cyan/30 text-hld-cyan hover:bg-hld-cyan/10 font-mono text-[10px] uppercase tracking-[0.12em] transition-all shrink-0"
      >
        ‹ Done
      </button>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-hld-cyan text-[14px]">⑂</span>
        <span className="font-mono uppercase tracking-[0.14em] text-[10px] font-bold text-hld-text">Articulate</span>
      </div>

      <div className="min-w-[210px] shrink-0">
        <SegControl
          ariaLabel="Mode"
          options={seg(MODE_GLYPHS, MODE_LABELS)}
          value={Math.max(0, MODES.indexOf(mode))}
          onChange={(i) => setMode(MODES[i])}
        />
      </div>
      <div className="min-w-[180px] shrink-0">
        <SegControl
          ariaLabel="Granularity"
          options={seg(GRAIN_GLYPHS, GRAIN_LABELS)}
          value={Math.max(0, GRAINS.indexOf(grain))}
          onChange={(i) => setGrain(GRAINS[i])}
        />
      </div>
      <div className="min-w-[180px] shrink-0">
        <SegControl
          ariaLabel="Genre"
          options={seg(GENRE_GLYPHS, GENRE_LABELS)}
          value={Math.max(0, GENRES.indexOf(genre))}
          onChange={(i) => setGenre(GENRES[i])}
        />
      </div>
      <div className="min-w-[240px] shrink-0">
        <SegControl
          ariaLabel="Depth"
          options={depthOptions}
          value={depthIndex < 0 ? 1 : depthIndex}
          onChange={(i) => setDepth(resolveDepthChoice(catalog, depth, DEPTH_TIERS[i]))}
        />
      </div>

      <div className="ml-auto flex items-center gap-3 shrink-0">
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-hld-muted-text">
          {done ? 'descent complete' : `level ${cursor + 1}`}
        </span>
        <button
          type="button"
          onClick={() => void runAllRemaining()}
          disabled={done || anyBusy}
          className="px-2.5 py-1.5 border border-hld-border text-hld-muted-text-2 hover:text-hld-cyan hover:border-hld-cyan/40 font-mono text-[10px] uppercase tracking-[0.12em] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          title="Articulate every remaining level without stopping (auto-accept)"
        >
          Run all »
        </button>
        <button
          type="button"
          onClick={continueToSpecs}
          disabled={acceptedCount === 0}
          className="px-2.5 py-1.5 border border-hld-cyan/30 text-hld-cyan hover:bg-hld-cyan/10 font-mono text-[10px] uppercase tracking-[0.12em] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          title="Hand the new heading structure to the spec sweep"
        >
          Continue to specs ›
        </button>
      </div>
    </div>
  );
}
