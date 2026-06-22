import { useStore } from '../../state';
import type { ModelTier } from '../../services/ai/model-catalog';
import { SegControl, type SegOption } from '../modals/SegControl';
import { resolveDepthChoice, tierOf, depthModelLabel } from '../modals/depth-choice';
import { useInterpolateActions } from './use-interpolate-actions';

const DEPTH_TIERS: ModelTier[] = ['fast', 'balanced', 'deep'];
const DEPTH_GLYPHS = ['»', '»»', '◆'];
const DEPTH_LABELS = ['Fast', 'Balanced', 'Deep'];

/** Header: Done · ✦ Generate Specs · depth · progress · Run all remaining. */
export function InterpolateTopBar() {
  const close = useStore((s) => s.closeInterpolate);
  const catalog = useStore((s) => s.modelCatalog);
  const choice = useStore((s) => s.interpDepth);
  const setChoice = useStore((s) => s.setInterpDepth);
  const stages = useStore((s) => s.interpStages);
  const cursor = useStore((s) => s.stageCursor);
  const stageWork = useStore((s) => s.stageWork);

  const { runAllRemaining } = useInterpolateActions();

  const depthIndex = DEPTH_TIERS.indexOf(tierOf(catalog, choice));
  const depthOptions: SegOption[] = DEPTH_TIERS.map((tier, i) => ({
    glyph: DEPTH_GLYPHS[i],
    label: DEPTH_LABELS[i],
    fine: depthModelLabel(catalog, choice, tier),
  }));

  const done = cursor >= stages.length;
  const anyBusy = Object.values(stageWork).some((w) => w.status === 'generating' || w.status === 'streaming');

  return (
    <div className="h-[54px] shrink-0 flex items-center gap-4 px-[18px] border-b border-hld-cyan/25 bg-gradient-to-b from-hld-cyan/5 to-transparent">
      <button
        type="button"
        onClick={close}
        className="px-2.5 py-1.5 border border-hld-cyan/30 text-hld-cyan hover:bg-hld-cyan/10 font-mono text-[10px] uppercase tracking-[0.12em] transition-all"
      >
        ‹ Done — back to writing
      </button>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-hld-cyan text-[14px]">✦</span>
        <span className="font-mono uppercase tracking-[0.14em] text-[10px] font-bold text-hld-text">Generate Specs</span>
      </div>

      <div className="flex items-center gap-2 min-w-0">
        <span className="font-mono uppercase tracking-[0.14em] text-[9px] text-hld-muted-text shrink-0">Depth</span>
        <div className="min-w-[260px]">
          <SegControl
            ariaLabel="Generation depth"
            options={depthOptions}
            value={depthIndex < 0 ? 1 : depthIndex}
            onChange={(i) => setChoice(resolveDepthChoice(catalog, choice, DEPTH_TIERS[i]))}
          />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-4 shrink-0">
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-hld-muted-text">
          {done ? `${stages.length} / ${stages.length} done` : `Level ${cursor + 1} of ${stages.length}`}
        </span>
        <button
          type="button"
          onClick={() => void runAllRemaining()}
          disabled={done || anyBusy}
          className="px-2.5 py-1.5 border border-hld-border text-hld-muted-text-2 hover:text-hld-cyan hover:border-hld-cyan/40 font-mono text-[10px] uppercase tracking-[0.12em] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          title="Generate every remaining level without stopping (single-shot, auto-accept)"
        >
          Run all remaining »
        </button>
      </div>
    </div>
  );
}
