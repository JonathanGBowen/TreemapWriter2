// Living Sprints — the Goblin plan editor. Generates the initial plan from the
// captured goal at the chosen granularity, then lets the writer edit it before
// the clock starts: change spiciness (regenerates), edit titles/instructions,
// reorder, add/remove, and recursively "break down" any step. Every structural
// op keeps the durations summing to the total (lib/sprintEdit). On any AI
// failure it degrades to the shape/goal default so the writer is never blocked.

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, Plus, Sparkles } from 'lucide-react';
import { ModalShell } from '../ModalShell';
import { ModelPicker } from '../ModelPicker';
import { SegControl } from '../SegControl';
import { useModelChoice } from '../use-model-choice';
import { Pip } from '../../shared/Pip';
import { SprintStepRow } from './SprintStepRow';
import { AgentTraceTicker } from '../../shared/AgentTraceTicker';
import { aiProvider } from '../../../services/ai-provider-registry';
import { goalPlan, minutesOf, planFromShape } from '../../../lib/sprintPlan';
import {
  canRemoveStep,
  editStep,
  insertStep,
  moveStep,
  removeStep,
  replaceStepWithChildren,
} from '../../../lib/sprintEdit';
import type { SprintBacklog } from '../../../services/ai-provider';
import type {
  ArgumentShape,
  PromptsConfig,
  SectionSpec,
  SprintGoalFraming,
  SprintGranularity,
  SprintPlan,
} from '../../../types';

interface SprintPlanReviewProps {
  sectionTitle: string;
  targetSectionId: string;
  spec?: SectionSpec;
  shape: ArgumentShape | null;
  totalMin: number;
  backlog: SprintBacklog;
  framing: SprintGoalFraming;
  transcript?: string;
  config: PromptsConfig;
  onStart: (plan: SprintPlan) => void;
  onBack: () => void;
  onClose: () => void;
}

const GRAN: SprintGranularity[] = ['coarse', 'medium', 'fine'];

export function SprintPlanReview(props: SprintPlanReviewProps) {
  const { sectionTitle, targetSectionId, spec, shape, totalMin, backlog, framing, transcript, config } = props;
  const [choice, setChoice] = useModelChoice('generateSprintPlan', true);
  const [granularity, setGranularity] = useState<SprintGranularity>('coarse');
  const [plan, setPlan] = useState<SprintPlan | null>(null);
  const [processing, setProcessing] = useState(false);
  const [busyStepId, setBusyStepId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(false);

  const fallbackPlan = (): SprintPlan => {
    const base = shape
      ? planFromShape(shape, { totalMin, targetSectionId })
      : goalPlan(targetSectionId, totalMin);
    return { ...base, goal: framing };
  };

  // Generate on mount and whenever the granularity changes (a fresh breakdown).
  useEffect(() => {
    let alive = true;
    setProcessing(true);
    setError(null);
    aiProvider
      .generateSprintPlan({
        sectionTitle,
        targetSectionId,
        spec,
        sessionGoal: framing.wish,
        goal: framing,
        granularity,
        extraContext: transcript,
        shape,
        totalMin,
        backlog,
        config,
        modelChoice: choice,
      })
      .then((generated) => {
        if (!alive) return;
        setPlan({ ...generated, goal: framing });
        setIsFallback(false);
      })
      .catch((e) => {
        console.error('[SprintPlanReview] generation failed', e);
        if (!alive) return;
        setPlan(fallbackPlan());
        setIsFallback(true);
        setError("Coach unavailable — using the shape's default plan. You can still edit and start.");
      })
      .finally(() => {
        if (alive) setProcessing(false);
      });
    return () => {
      alive = false;
    };
    // Regenerate only on a granularity change (other inputs are stable for the
    // modal's life; we don't want a model-picker change to discard edits).
  }, [granularity]);

  const update = (next: SprintPlan['moves']) => setPlan((p) => (p ? { ...p, moves: next } : p));

  const onBreakDown = async (index: number) => {
    if (!plan) return;
    const step = plan.moves[index];
    setBusyStepId(step.id);
    setError(null);
    try {
      const children = await aiProvider.decomposeSprintStep({
        sectionTitle,
        step,
        granularity,
        config,
        modelChoice: choice,
      });
      setPlan((p) =>
        p ? { ...p, moves: replaceStepWithChildren(p.moves, index, children, p.totalSec) } : p,
      );
    } catch (e) {
      console.error('[SprintPlanReview] decompose failed', e);
      setError('Could not break down that step — edit it by hand, or try again.');
    } finally {
      setBusyStepId(null);
    }
  };

  const addStep = () => {
    if (!plan) return;
    update(
      insertStep(
        plan.moves,
        plan.moves.length,
        { id: 'new', title: 'New step', instructions: [], durationSec: 120, role: 'draft' },
        plan.totalSec,
      ),
    );
  };

  const footer = (
    <>
      <button
        type="button"
        onClick={props.onBack}
        className="bg-transparent border border-hld-border text-hld-muted-text hover:text-hld-text font-mono text-[9px] tracking-[0.12em] uppercase px-[14px] py-[10px] transition-colors"
      >
        ← Goal
      </button>
      <button
        type="button"
        onClick={() => plan && props.onStart({ ...plan, goal: framing })}
        disabled={!plan || processing}
        className="bracketed hld-lit ml-auto px-[20px] py-[10px] font-mono text-[10px] font-bold tracking-[0.14em] uppercase disabled:opacity-40"
      >
        ▶ Start{plan ? ` — ${minutesOf(plan.totalSec)} min · ${plan.moves.length} moves` : ''}
      </button>
    </>
  );

  return (
    <ModalShell
      eyebrow="New Sprint — Plan"
      title="Break it into steps"
      sub={sectionTitle}
      onClose={props.onClose}
      widthClass="max-w-xl"
      footer={footer}
    >
      <div className="flex flex-col gap-[14px]">
        {/* The goal this plan serves. */}
        <div className="border-l-2 border-hld-cyan pl-3">
          <div className="font-mono text-[8px] tracking-[0.16em] uppercase text-hld-muted-text mb-[3px]">Goal</div>
          <div className="text-[12.5px] text-hld-text leading-snug">{framing.wish}</div>
          {framing.model === 'woop' && (framing.obstacle || framing.ifThen) && (
            <div className="mt-[6px] text-[11.5px] text-hld-muted-text leading-snug">
              {framing.obstacle && <div>⚠ {framing.obstacle}</div>}
              {framing.ifThen && <div className="text-hld-yellow">↪ {framing.ifThen}</div>}
            </div>
          )}
        </div>

        {/* Granularity ("spiciness"). */}
        <div>
          <div className="flex items-center justify-between mb-[6px]">
            <span className="font-mono text-[9px] tracking-[0.16em] uppercase text-hld-muted-text">
              Granularity 🌶 — regenerates
            </span>
            <ModelPicker
              value={choice}
              onChange={(c) => c && setChoice(c)}
              className="bg-hld-bg border border-hld-border text-[10px] font-mono uppercase tracking-widest text-hld-text px-2 py-1 outline-none focus:border-hld-cyan"
            />
          </div>
          <SegControl
            ariaLabel="Granularity"
            value={GRAN.indexOf(granularity)}
            onChange={(i) => setGranularity(GRAN[i])}
            options={[
              { glyph: '▪', label: 'Coarse', fine: 'fewer' },
              { glyph: '▪▪', label: 'Medium' },
              { glyph: '▪▪▪', label: 'Fine', fine: 'more' },
            ]}
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-hld-yellow/10 border border-hld-yellow/30 px-3 py-2 text-[11.5px] text-hld-yellow">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {error}
          </div>
        )}

        {/* The plan. */}
        <div className="border border-hld-border bg-hld-bgDeep min-h-[80px]">
          <div className="flex items-center justify-between px-[12px] py-[9px] border-b border-hld-border bg-hld-purple/[0.06]">
            <span className={`font-mono text-[9px] tracking-[0.14em] uppercase ${isFallback ? 'text-hld-yellow' : 'text-hld-purple'}`}>
              {processing ? 'Generating…' : isFallback ? 'Default plan · coach offline' : 'Generated plan'}
            </span>
            <span className="font-mono text-[9px] tracking-[0.14em] uppercase text-hld-cyan">
              Shape · {shape?.name ?? 'Freeform'}
            </span>
          </div>

          {processing && !plan ? (
            <div className="px-[12px] py-[16px] text-[12px] text-hld-muted-text">
              <div className="flex items-center gap-[8px]">
                <Loader2 size={14} className="animate-spin" /> Breaking your goal into steps…
              </div>
              <AgentTraceTicker
                kinds={['generateSprintPlan', 'decomposeSprintStep']}
                className="mt-2 flex items-center gap-1.5 text-[10px] font-mono text-hld-muted min-w-0"
              />
            </div>
          ) : plan ? (
            plan.moves.map((m, i) => (
              <SprintStepRow
                key={m.id}
                move={m}
                isReinstate={m.role === 'reinstate'}
                busy={busyStepId === m.id}
                canRemove={canRemoveStep(plan.moves, i)}
                disableUp={i <= 1}
                disableDown={i === 0 || i >= plan.moves.length - 1}
                onEditTitle={(title) => update(editStep(plan.moves, i, { title }))}
                onEditInstructions={(lines) => update(editStep(plan.moves, i, { instructions: lines }))}
                onBreakDown={() => void onBreakDown(i)}
                onMoveUp={() => update(moveStep(plan.moves, i, i - 1))}
                onMoveDown={() => update(moveStep(plan.moves, i, i + 1))}
                onRemove={() => update(removeStep(plan.moves, i, plan.totalSec))}
              />
            ))
          ) : null}
        </div>

        {plan && (
          <button
            type="button"
            onClick={addStep}
            className="self-start flex items-center gap-[6px] bg-transparent border border-hld-border text-hld-muted-text hover:text-hld-cyan hover:border-hld-cyan/40 font-mono text-[9px] tracking-[0.12em] uppercase px-[12px] py-[8px] transition-colors"
          >
            <Plus size={12} /> Add step
          </button>
        )}

        <div className="flex items-center gap-[7px] font-mono text-[9px] tracking-[0.1em] uppercase text-hld-muted-text">
          <Pip status="magenta" size="sm" /> Plan locks when the sprint starts.{' '}
          {plan && <Sparkles size={11} className="inline opacity-60" />}
        </div>
      </div>
    </ModalShell>
  );
}
