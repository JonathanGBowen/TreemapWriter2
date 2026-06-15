// Living Sprints — the Sprint Brief (Direction A). A ~60s co-definition step in
// the yellow coach voice: a short framing turn + the writer's one-line goal +
// context chips → a generated, section-specific plan that bends the chosen
// shape. Single-shot generation (shows progress; >200ms rule). On any failure
// it degrades gracefully to the shape's default plan, so the writer is never
// blocked. The plan is reviewed here and locked once the runner starts.

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, Sparkles } from 'lucide-react';
import { ModalShell } from '../ModalShell';
import { ModelPicker } from '../ModelPicker';
import { useModelChoice } from '../use-model-choice';
import { Pip } from '../../shared/Pip';
import { aiProvider } from '../../../services/ai-provider-registry';
import { goalPlan, minutesOf, planFromShape } from '../../../lib/sprintPlan';
import type { ArgumentShape, PromptsConfig, SectionSpec, SprintPlan } from '../../../types';
import type { SprintBacklog } from '../../../services/ai-provider';

interface SprintBriefProps {
  isOpen: boolean;
  sectionTitle: string;
  targetSectionId: string;
  spec?: SectionSpec;
  shape: ArgumentShape | null;
  totalMin: number;
  backlog: SprintBacklog;
  promptsConfig: PromptsConfig;
  onStart: (plan: SprintPlan) => void;
  onBack: () => void;
  onClose: () => void;
}

function fallbackPlan(props: SprintBriefProps): SprintPlan {
  return props.shape
    ? planFromShape(props.shape, { totalMin: props.totalMin, targetSectionId: props.targetSectionId })
    : goalPlan(props.targetSectionId, props.totalMin);
}

export function SprintBrief(props: SprintBriefProps) {
  const { isOpen, sectionTitle, spec, shape, totalMin, backlog, promptsConfig } = props;
  const [choice, setChoice] = useModelChoice('generateSprintPlan', isOpen);
  const [sessionGoal, setSessionGoal] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<SprintPlan | null>(null);

  useEffect(() => {
    // Reset when re-opened for a fresh section/shape.
    setPlan(null);
    setError(null);
    setSessionGoal('');
  }, [isOpen, shape, props.targetSectionId]);

  const touched = backlog.lastTouchedDays;
  const coachLine =
    touched == null
      ? `Let's frame this sprint. What's the one thing that has to be true by the end?`
      : `You left this section ${touched} day${touched === 1 ? '' : 's'} ago. What's the one thing that has to be true by the end of today's sprint?`;

  const handleGenerate = async () => {
    setProcessing(true);
    setError(null);
    try {
      const generated = await aiProvider.generateSprintPlan({
        sectionTitle,
        targetSectionId: props.targetSectionId,
        spec,
        sessionGoal,
        shape,
        totalMin,
        backlog,
        config: promptsConfig,
        modelChoice: choice,
      });
      setPlan(generated);
    } catch (e) {
      console.error('[SprintBrief] generation failed', e);
      setPlan(fallbackPlan(props));
      setError("Coach unavailable — using the shape's default plan. You can still start.");
    } finally {
      setProcessing(false);
    }
  };

  const footer = (
    <>
      <button
        type="button"
        onClick={props.onBack}
        className="bg-transparent border border-hld-border text-hld-muted-text hover:text-hld-text font-mono text-[9px] tracking-[0.12em] uppercase px-[14px] py-[10px] transition-colors"
      >
        ← Back
      </button>
      {plan ? (
        <button
          type="button"
          onClick={() => props.onStart(plan)}
          className="bracketed hld-lit ml-auto px-[20px] py-[10px] font-mono text-[10px] font-bold tracking-[0.14em] uppercase"
        >
          ▶ Start — {minutesOf(plan.totalSec)} min · {plan.moves.length} moves
        </button>
      ) : (
        <button
          type="button"
          onClick={handleGenerate}
          disabled={processing}
          className="bracketed hld-lit-magenta ml-auto flex items-center gap-[7px] px-[20px] py-[10px] font-mono text-[10px] font-bold tracking-[0.14em] uppercase disabled:opacity-40"
        >
          {processing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {processing ? 'Generating…' : 'Generate plan'}
        </button>
      )}
    </>
  );

  return (
    <ModalShell
      eyebrow="New Sprint — Brief"
      title="The Sprint Brief"
      sub={sectionTitle}
      onClose={props.onClose}
      widthClass="max-w-xl"
      footer={footer}
    >
      <div className="flex flex-col gap-[14px]">
        {/* Coach turn (yellow voice) */}
        <div className="self-start max-w-[88%] text-[12.5px] leading-relaxed bg-hld-yellow/[0.05] border border-hld-yellow/20 text-[#e9e3c0] px-[12px] py-[9px]">
          <div className="flex items-center gap-[6px] font-mono text-[8px] tracking-[0.16em] uppercase text-hld-yellow mb-[5px]">
            <Pip status="yellow" size="sm" /> Coach
          </div>
          {coachLine}
        </div>

        <textarea
          value={sessionGoal}
          onChange={(e) => setSessionGoal(e.target.value)}
          rows={3}
          placeholder="Draft the core objection and my reply…"
          className="w-full bg-hld-surface2 border border-hld-border text-hld-text text-[12.5px] leading-relaxed p-[10px] outline-none focus:border-hld-cyan/40 resize-none font-sans"
        />

        {/* Context chips */}
        <div className="flex flex-wrap gap-[8px]">
          <Chip pip="yellow" label="unfinished" value={`${backlog.unfinishedCount} ¶`} />
          <Chip
            pip="magenta"
            label="last touched"
            value={touched == null ? 'unknown' : `${touched}d ago`}
          />
          <Chip pip="cyan" label="fragments" value={`${backlog.fragmentCount}`} />
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[9px] tracking-[0.14em] uppercase text-hld-muted-text">Depth</span>
          <ModelPicker value={choice} onChange={(c) => c && setChoice(c)} className="bg-hld-bg border border-hld-border text-[10px] font-mono uppercase tracking-widest text-hld-text px-2 py-1 outline-none focus:border-hld-cyan" />
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-hld-yellow/10 border border-hld-yellow/30 px-3 py-2 text-[11.5px] text-hld-yellow">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {error}
          </div>
        )}

        {plan && (
          <div className="border border-hld-border bg-hld-bgDeep">
            <div className="flex items-center justify-between px-[12px] py-[9px] border-b border-hld-border bg-hld-purple/[0.06]">
              <span className="font-mono text-[9px] tracking-[0.14em] uppercase text-hld-purple">Generated plan</span>
              <span className="font-mono text-[9px] tracking-[0.14em] uppercase text-hld-cyan">
                Shape · {shape?.name ?? 'Freeform'}
              </span>
            </div>
            {plan.moves.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-[11px] px-[12px] py-[9px] border-b border-hld-border last:border-b-0 text-[12px]"
              >
                <span className="font-mono text-[11px] tracking-[-2px] text-hld-muted select-none">⋮⋮</span>
                <span className="flex-1 text-hld-text">
                  <b className="text-white font-semibold">{m.title}</b>
                </span>
                <span className="font-mono text-[10px] text-hld-muted-text">{minutesOf(m.durationSec)}m</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModalShell>
  );
}

function Chip({ pip, label, value }: { pip: 'yellow' | 'magenta' | 'cyan'; label: string; value: string }) {
  return (
    <span className="flex items-center gap-[7px] font-mono text-[10px] text-hld-muted-text bg-hld-bgDeep border border-hld-border px-[9px] py-[6px]">
      <Pip status={pip} size="sm" /> {label}: <b className="text-hld-text font-medium">{value}</b>
    </span>
  );
}
