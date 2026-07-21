import { useStore } from '../../state';
import { useCurrentSection } from './use-current-section';
import { checkContextFit } from '../../services/ai/context-budget';
import { resolveModelChoice } from '../../services/ai/resolve-model-choice';
import { resolveActiveInstruction } from '../../lib/defaultInstructions';
import { revisionBudgetText } from '../revision/revision-budget';

const fmtK = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`);

/**
 * Make the context-fit pre-flight visible BEFORE Generate: estimated tokens for
 * exactly what the pass will send (section + active instruction + selected
 * sources) against the chosen model's window. Surfaces state by color + a fill
 * bar (green within budget, yellow — the one alert — on overflow) — the
 * glass-box payoff.
 */
export function RevisionTokenPreview() {
  const current = useCurrentSection();
  const revisionSources = useStore((s) => s.sources);
  const selectedSourceIds = useStore((s) => s.selectedSourceIds);
  const revisionInstructions = useStore((s) => s.revisionInstructions);
  const activeRevisionInstructionId = useStore((s) => s.activeRevisionInstructionId);
  const modelConfig = useStore((s) => s.modelConfig);
  const globalModelDefault = useStore((s) => s.globalModelDefault);
  const modelCatalog = useStore((s) => s.modelCatalog);

  if (!current) {
    return (
      <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-hld-muted-text">
        select a section to preview its token cost
      </div>
    );
  }

  const sources = revisionSources.filter((s) => selectedSourceIds.includes(s.id));
  const instruction = resolveActiveInstruction(
    revisionInstructions,
    activeRevisionInstructionId,
  ).body;
  const choice = resolveModelChoice('generateRevisions', modelConfig, globalModelDefault);
  const fit = checkContextFit(
    modelCatalog,
    choice,
    revisionBudgetText(current.fullContent, instruction, sources),
  );

  const ratio = fit.usableTokens ? Math.min(1, fit.estimatedTokens / fit.usableTokens) : 0;
  const tone = fit.overflow
    ? 'text-hld-yellow'
    : fit.unknownWindow
      ? 'text-hld-muted-text'
      : 'text-hld-green';
  const barColor = fit.overflow ? 'bg-hld-yellow' : 'bg-hld-green';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between font-mono">
        <span className={`text-[15px] font-bold ${tone}`}>~{fmtK(fit.estimatedTokens)}</span>
        <span className="text-[9px] uppercase tracking-[0.1em] text-hld-muted-text">
          {fit.unknownWindow
            ? `${choice.model} · window unknown`
            : `of ${fmtK(fit.usableTokens ?? 0)} usable · ${fmtK(fit.contextWindow ?? 0)} window`}
        </span>
      </div>
      {!fit.unknownWindow && (
        <div className="h-1 w-full bg-hld-border overflow-hidden">
          <div className={`h-full ${barColor}`} style={{ width: `${Math.round(ratio * 100)}%` }} />
        </div>
      )}
      <div className="font-mono text-[8.5px] uppercase tracking-[0.08em] text-hld-muted">
        {fit.overflow
          ? 'over budget — switch to a larger-context model below'
          : fit.unknownWindow
            ? 'detected model — context window not known'
            : `section + instruction${sources.length ? ` + ${sources.length} source${sources.length === 1 ? '' : 's'}` : ''} · ${choice.model}`}
      </div>
    </div>
  );
}
