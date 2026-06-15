// Living Sprints — an Argument Shape card (Direction C). Name + move-count /
// duration eyebrow + one-line description + a horizontal phase strip whose
// blocks are sized by relative weight and colored by move role. Selected = cyan
// wash. Selecting a shape seeds the sprint plan (the floor, not the ceiling).

import { Pip } from '../../shared/Pip';
import { hexA, roleHue } from '../../../lib/sprintRoles';
import type { ArgumentShape } from '../../../types';

interface ShapeCardProps {
  shape: ArgumentShape;
  selected: boolean;
  onSelect: () => void;
}

export function ShapeCard({ shape, selected, onSelect }: ShapeCardProps) {
  const totalWeight = shape.moves.reduce((a, m) => a + m.weight, 0);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full text-left p-[14px] border border-hld-border transition-colors cursor-pointer ${
        selected ? 'bg-hld-cyan/[0.05] shadow-[inset_0_0_30px_rgba(0,232,245,0.05)]' : 'hover:border-hld-muted'
      }`}
    >
      <div className="flex items-center justify-between mb-[5px]">
        <span className={`flex items-center gap-[9px] text-[14px] font-bold ${selected ? 'text-hld-cyan' : 'text-white'}`}>
          <Pip status={selected ? 'cyan' : 'idle'} />
          {shape.name}
        </span>
        <span className="font-mono text-[9px] tracking-[0.1em] uppercase text-hld-muted-text">
          {shape.moves.length} moves · {totalWeight}m
        </span>
      </div>
      <div className="text-[11.5px] leading-snug text-hld-muted-text mb-[11px] max-w-[54ch]">{shape.description}</div>
      <div className="flex gap-[3px] h-[24px]">
        {shape.moves.map((m, i) => {
          const hue = roleHue(m.role);
          return (
            <div
              key={i}
              title={m.title}
              style={{
                flexGrow: m.weight,
                background: hexA(hue, selected ? 0.16 : 0.1),
                borderColor: hexA(hue, selected ? 0.4 : 0.28),
              }}
              className="h-full flex items-center justify-center border font-mono text-[8px] tracking-[0.04em] uppercase text-white/85 whitespace-nowrap overflow-hidden px-1"
            >
              {m.title.split(' ')[0]}
            </div>
          );
        })}
      </div>
    </button>
  );
}
