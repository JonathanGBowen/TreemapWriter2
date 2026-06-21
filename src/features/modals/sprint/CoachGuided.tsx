// Living Sprints — the guided coach (no AI). A single-action-per-screen
// micro-wizard that captures the session goal. Plain = one prompt (the wish).
// WOOP = wish → inner obstacle → if-then plan, one per screen (the report's
// best-validated goal-setting move). Produces a SprintGoalFraming.

import { useMemo, useState } from 'react';
import { Pip } from '../../shared/Pip';
import type { SprintGoalFraming } from '../../../types';

interface CoachGuidedProps {
  goalModel: 'woop' | 'plain';
  onReady: (framing: SprintGoalFraming) => void;
  /** Optional escape hatch (hybrid style offers "Talk it through first"). */
  secondaryAction?: { label: string; onClick: () => void };
}

interface Step {
  key: 'wish' | 'obstacle' | 'ifThen';
  coachLine: string;
  placeholder: string;
}

export function CoachGuided({ goalModel, onReady, secondaryAction }: CoachGuidedProps) {
  const steps = useMemo<Step[]>(() => {
    const wish: Step = {
      key: 'wish',
      coachLine: `What's the one thing that has to be true by the end of this sprint?`,
      placeholder: 'Draft the core objection and my reply…',
    };
    if (goalModel === 'plain') return [wish];
    return [
      wish,
      {
        key: 'obstacle',
        coachLine: `What's the main *inner* thing that'll get in your way? Not "no time" — the real one.`,
        placeholder: `I'll reread instead of writing; I'll chase a citation…`,
      },
      {
        key: 'ifThen',
        coachLine: `Pin the response: if that happens, then you will…?`,
        placeholder: 'set a 2-minute timer and write one bad sentence anyway.',
      },
    ];
  }, [goalModel]);

  const [i, setI] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const step = steps[i];
  const isLast = i === steps.length - 1;

  // Scaffold the if-then with the obstacle the writer just named.
  const scaffold = step.key === 'ifThen' && values.obstacle ? `If ${values.obstacle.trim()}, then I will ` : '';
  const current = values[step.key] ?? (step.key === 'ifThen' ? scaffold : '');
  const canAdvance = (values.wish ?? '').trim().length > 0 && (step.key !== 'wish' || current.trim().length > 0);

  const setCurrent = (v: string) => setValues((prev) => ({ ...prev, [step.key]: v }));

  const finish = () => {
    const wish = (values.wish ?? '').trim();
    if (!wish) return;
    if (goalModel === 'plain') {
      onReady({ model: 'plain', wish });
      return;
    }
    onReady({
      model: 'woop',
      wish,
      obstacle: (values.obstacle ?? '').trim() || undefined,
      ifThen: (values.ifThen ?? scaffold).trim() || undefined,
    });
  };

  const next = () => {
    if (step.key === 'ifThen' && !values.ifThen) setCurrent(scaffold); // commit scaffold
    if (isLast) finish();
    else setI((n) => Math.min(steps.length - 1, n + 1));
  };

  return (
    <div className="flex flex-col gap-[14px]">
      {/* Coach turn (yellow voice) */}
      <div className="self-start max-w-[92%] text-[12.5px] leading-relaxed bg-hld-yellow/[0.05] border border-hld-yellow/20 text-[#e9e3c0] px-[12px] py-[9px]">
        <div className="flex items-center gap-[6px] font-mono text-[8px] tracking-[0.16em] uppercase text-hld-yellow mb-[5px]">
          <Pip status="yellow" size="sm" /> Coach {goalModel === 'woop' ? `· ${i + 1}/${steps.length}` : ''}
        </div>
        {step.coachLine}
      </div>

      <textarea
        autoFocus
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            if (canAdvance) next();
          }
        }}
        rows={3}
        placeholder={step.placeholder}
        className="w-full bg-hld-surface2 border border-hld-border text-hld-text text-[12.5px] leading-relaxed p-[10px] outline-none focus:border-hld-cyan/40 resize-none font-sans"
      />

      <div className="flex items-center gap-[10px]">
        {i > 0 && (
          <button
            type="button"
            onClick={() => setI((n) => Math.max(0, n - 1))}
            className="bg-transparent border border-hld-border text-hld-muted-text hover:text-hld-text font-mono text-[9px] tracking-[0.12em] uppercase px-[14px] py-[10px] transition-colors"
          >
            ← Back
          </button>
        )}
        {secondaryAction && i === 0 && (
          <button
            type="button"
            onClick={secondaryAction.onClick}
            className="bg-transparent border border-hld-border text-hld-muted-text hover:text-hld-yellow hover:border-hld-yellow/40 font-mono text-[9px] tracking-[0.12em] uppercase px-[14px] py-[10px] transition-colors"
          >
            {secondaryAction.label}
          </button>
        )}
        <button
          type="button"
          onClick={next}
          disabled={!canAdvance}
          className="bracketed hld-lit ml-auto px-[20px] py-[10px] font-mono text-[10px] font-bold tracking-[0.14em] uppercase disabled:opacity-40"
        >
          {isLast ? 'Break into steps →' : 'Next →'}
        </button>
      </div>
    </div>
  );
}
