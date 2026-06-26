import type { StageStatus } from '../../state/interpolation-state';

/**
 * The non-agent path for a level: write a steer note in your own words (optional),
 * then generate. Re-generating with a changed note is the iteration loop here. The
 * proposal lands in the editable preview beside this.
 */
export function SteerInput({
  steer,
  status,
  hasProposal,
  onSteerChange,
  onGenerate,
}: {
  steer: string;
  status: StageStatus;
  hasProposal: boolean;
  onSteerChange: (text: string) => void;
  onGenerate: () => void;
}) {
  const generating = status === 'generating';

  return (
    <div className="flex-1 min-h-0 flex flex-col p-[16px] gap-[12px]">
      <div>
        <div className="font-mono text-[9px] font-bold tracking-[0.16em] uppercase text-hld-cyan mb-[8px]">
          Your steer — optional
        </div>
        <p className="text-[12px] font-sans text-hld-muted-text-2 leading-relaxed mb-[10px]">
          Say in your own words what this level should capture — emphases, a claim to foreground, a
          structure to respect. Leave it blank to let the model propose from the text alone.
        </p>
        <textarea
          value={steer}
          onChange={(e) => onSteerChange(e.target.value)}
          placeholder="e.g. Frame these chapters around the methodology/findings split; keep the framework chapter subordinate to the thesis…"
          className="w-full min-h-[7em] p-[11px] text-[13px] leading-relaxed border border-hld-border bg-hld-surface-3 text-hld-text outline-none focus:border-hld-cyan resize-none font-sans placeholder-hld-muted/50"
        />
      </div>
      <button
        type="button"
        onClick={onGenerate}
        disabled={generating}
        className="hld-lit px-3 py-[10px] font-mono text-[10px] uppercase tracking-[0.12em] disabled:opacity-50 disabled:cursor-wait"
      >
        {generating ? 'Generating…' : hasProposal ? '↻ Regenerate this level' : '▸ Generate this level'}
      </button>
    </div>
  );
}
