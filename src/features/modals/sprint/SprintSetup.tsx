// Living Sprints — setup / co-define. Pick the total minutes and (for Content
// sprints) an argument shape that seeds the plan, then Start — or hand off to
// the AI Brief to bend the shape to this section. Goal sprints skip shapes
// (a goal sprint is a trivial reinstate → define-the-claim plan). Wrapped in
// ModalShell; the lit Start is the single primary action.

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { ModalShell } from '../shared/ModalShell';
import { ShapeCard } from './ShapeCard';
import { DEFAULT_ARGUMENT_SHAPES } from '../../../lib/argumentShapes';
import type { ArgumentShape } from '../../../types';

const TOTAL_PRESETS: Record<'goal' | 'content', number[]> = {
  goal: [10, 15],
  content: [25, 35, 45],
};

interface SprintSetupProps {
  mode: 'goal' | 'content';
  onModeChange: (mode: 'goal' | 'content') => void;
  sectionTitle: string;
  onStart: (shape: ArgumentShape | null, totalMin: number) => void;
  onCoach: (shape: ArgumentShape | null, totalMin: number) => void;
  onClose: () => void;
}

export function SprintSetup({ mode, onModeChange, sectionTitle, onStart, onCoach, onClose }: SprintSetupProps) {
  const presets = TOTAL_PRESETS[mode];
  const [totalMin, setTotalMin] = useState(mode === 'content' ? 35 : 10);
  const [shapeId, setShapeId] = useState<string | null>(
    mode === 'content' ? DEFAULT_ARGUMENT_SHAPES[0].id : null,
  );
  const shape = DEFAULT_ARGUMENT_SHAPES.find((s) => s.id === shapeId) ?? null;
  const moveCount = mode === 'content' ? (shape?.moves.length ?? 0) : 2;

  const footer = (
    <>
      <button
        type="button"
        onClick={() => onCoach(shape, totalMin)}
        className="flex items-center gap-[6px] bg-transparent border border-hld-border text-hld-muted-text hover:text-hld-yellow hover:border-hld-yellow/40 font-mono text-[9px] tracking-[0.12em] uppercase px-[14px] py-[10px] transition-colors"
      >
        <Sparkles size={12} /> Start with coach
      </button>
      <button
        type="button"
        onClick={() => onStart(shape, totalMin)}
        className="bracketed hld-lit ml-auto px-[20px] py-[10px] font-mono text-[10px] font-bold tracking-[0.14em] uppercase"
      >
        ▶ Start — {totalMin} min · {moveCount} moves
      </button>
    </>
  );

  return (
    <ModalShell
      eyebrow={`${mode === 'content' ? 'Content' : 'Goal'} Sprint — New`}
      title="Set the sprint"
      sub={sectionTitle}
      onClose={onClose}
      widthClass="max-w-xl"
      footer={footer}
    >
      <div className="flex flex-col gap-[16px]">
        <div>
          <div className="font-mono text-[9px] tracking-[0.16em] uppercase text-hld-muted-text mb-[8px]">
            Sprint type
          </div>
          <div className="flex gap-[8px]">
            <button
              type="button"
              onClick={() => onModeChange('goal')}
              aria-pressed={mode === 'goal'}
              className={`flex-1 py-[10px] border font-mono text-[11px] tracking-[0.1em] uppercase transition-colors ${
                mode === 'goal'
                  ? 'border-hld-cyan text-hld-cyan bg-hld-cyan/[0.06]'
                  : 'border-hld-border text-hld-muted-text hover:text-hld-text'
              }`}
            >
              Goal
            </button>
            <button
              type="button"
              onClick={() => onModeChange('content')}
              aria-pressed={mode === 'content'}
              className={`flex-1 py-[10px] border font-mono text-[11px] tracking-[0.1em] uppercase transition-colors ${
                mode === 'content'
                  ? 'border-hld-cyan text-hld-cyan bg-hld-cyan/[0.06]'
                  : 'border-hld-border text-hld-muted-text hover:text-hld-text'
              }`}
            >
              Draft
            </button>
          </div>
        </div>
        <div>
          <div className="font-mono text-[9px] tracking-[0.16em] uppercase text-hld-muted-text mb-[8px]">
            Total time
          </div>
          <div className="flex gap-[8px]">
            {presets.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setTotalMin(m)}
                aria-pressed={totalMin === m}
                className={`flex-1 py-[10px] border font-mono text-[11px] tracking-[0.1em] uppercase transition-colors ${
                  totalMin === m
                    ? 'border-hld-cyan text-hld-cyan bg-hld-cyan/[0.06]'
                    : 'border-hld-border text-hld-muted-text hover:text-hld-text'
                }`}
              >
                {m} min
              </button>
            ))}
          </div>
        </div>

        {mode === 'content' && (
          <div>
            <div className="font-mono text-[9px] tracking-[0.16em] uppercase text-hld-muted-text mb-[8px]">
              Argument shape — seeds the plan
            </div>
            <div className="flex flex-col">
              {DEFAULT_ARGUMENT_SHAPES.map((s) => (
                <ShapeCard
                  key={s.id}
                  shape={s}
                  selected={s.id === shapeId}
                  onSelect={() => setShapeId(s.id)}
                />
              ))}
            </div>
          </div>
        )}

        {mode === 'goal' && (
          <div className="text-[12px] leading-relaxed text-hld-muted-text border-l-2 border-hld-cyan pl-3">
            A goal sprint opens by reinstating context, then gives you the clock to write the one
            sentence this section must earn.
          </div>
        )}
      </div>
    </ModalShell>
  );
}
