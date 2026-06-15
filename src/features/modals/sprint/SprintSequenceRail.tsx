// Living Sprints — the Sequence rail (Direction B). Done / now / next at a
// glance: a green check for completed moves, a pulsing cyan pip for the current
// one, a hollow pip for what's upcoming — each with its mono duration. Replaces
// the bare "Move 3 of 5" with a felt sense of where you are in the arc.

import { Check } from 'lucide-react';
import { Pip } from '../../shared/Pip';
import { minutesOf } from '../../../lib/sprintPlan';
import type { SprintMove } from '../../../types';

interface SprintSequenceRailProps {
  moves: SprintMove[];
  currentIndex: number;
}

export function SprintSequenceRail({ moves, currentIndex }: SprintSequenceRailProps) {
  return (
    <div className="h-full border-l border-hld-border bg-hld-bg/50 px-[14px] py-[16px] overflow-y-auto">
      <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-hld-muted-text mb-[14px]">
        Sequence
      </div>
      <div className="flex flex-col">
        {moves.map((m, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex;
          return (
            <div
              key={m.id}
              className="flex items-center gap-[11px] py-[8px] border-b border-hld-border/60 last:border-b-0"
            >
              {done ? (
                <Check size={13} className="text-hld-green shrink-0" />
              ) : active ? (
                <Pip status="cyan" pulse />
              ) : (
                <Pip status="idle" />
              )}
              <span
                className={`flex-1 text-[12px] transition-colors ${
                  active ? 'text-white font-semibold' : done ? 'text-hld-muted-text/65' : 'text-hld-muted-text'
                }`}
              >
                {m.title}
              </span>
              <span className="font-mono text-[10px] text-hld-muted">{minutesOf(m.durationSec)}m</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
