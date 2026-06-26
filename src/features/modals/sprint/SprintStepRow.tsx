// Living Sprints — one editable step in the Goblin plan editor. Inline-edit the
// title; expand to edit instructions; reorder, remove, or "break down ↳" (the
// recursive decomposition). The reinstate opener is shown locked (no edits, no
// reorder, no removal) — it always anchors the plan.

import { useState } from 'react';
import { ChevronDown, ChevronRight, ChevronUp, Loader2, Scissors, Trash2 } from 'lucide-react';
import { minutesOf } from '../../../lib/sprintPlan';
import { roleHue, roleLabel } from '../../../lib/sprintRoles';
import type { SprintMove } from '../../../types';

interface SprintStepRowProps {
  move: SprintMove;
  isReinstate: boolean;
  busy: boolean;
  canRemove: boolean;
  disableUp: boolean;
  disableDown: boolean;
  onEditTitle: (title: string) => void;
  onEditInstructions: (lines: string[]) => void;
  onBreakDown: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}

export function SprintStepRow({
  move,
  isReinstate,
  busy,
  canRemove,
  disableUp,
  disableDown,
  onEditTitle,
  onEditInstructions,
  onBreakDown,
  onMoveUp,
  onMoveDown,
  onRemove,
}: SprintStepRowProps) {
  const [open, setOpen] = useState(false);
  const hue = roleHue(move.role);

  return (
    <div className="border-b border-hld-border last:border-b-0">
      <div className="flex items-center gap-[10px] px-[12px] py-[9px]">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Collapse' : 'Expand'}
          className="text-hld-muted-text hover:text-hld-text shrink-0"
        >
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
        <span style={{ background: hue }} className="inline-block w-[7px] h-[7px] rotate-45 shrink-0" title={roleLabel(move.role)} />

        {isReinstate ? (
          <span className="flex-1 text-[12.5px] text-hld-text font-semibold">{move.title}</span>
        ) : (
          <input
            value={move.title}
            onChange={(e) => onEditTitle(e.target.value)}
            className="flex-1 min-w-0 bg-transparent border-b border-transparent hover:border-hld-border focus:border-hld-cyan/40 text-[12.5px] text-white font-semibold outline-none py-[2px]"
          />
        )}

        <span className="font-mono text-[10px] text-hld-muted-text tabular-nums shrink-0">{minutesOf(move.durationSec)}m</span>

        {!isReinstate && (
          <div className="flex items-center gap-[3px] shrink-0">
            <IconBtn label="Move up" onClick={onMoveUp} disabled={disableUp}>
              <ChevronUp size={13} />
            </IconBtn>
            <IconBtn label="Move down" onClick={onMoveDown} disabled={disableDown}>
              <ChevronDown size={13} />
            </IconBtn>
            <IconBtn label="Break down step" onClick={onBreakDown} disabled={busy}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Scissors size={13} />}
            </IconBtn>
            <IconBtn label="Remove step" onClick={onRemove} disabled={!canRemove} danger>
              <Trash2 size={13} />
            </IconBtn>
          </div>
        )}
        {isReinstate && (
          <span className="font-mono text-[8px] tracking-[0.12em] uppercase text-hld-muted-text shrink-0">Locked</span>
        )}
      </div>

      {open && (
        <div className="px-[12px] pb-[10px] pl-[40px]">
          {isReinstate ? (
            <ul className="flex flex-col gap-[4px]">
              {move.instructions.map((line, i) => (
                <li key={i} className="text-[11.5px] leading-snug text-hld-muted-text">• {line}</li>
              ))}
            </ul>
          ) : (
            <textarea
              value={move.instructions.join('\n')}
              onChange={(e) => onEditInstructions(e.target.value.split('\n'))}
              rows={Math.min(5, Math.max(2, move.instructions.length + 1))}
              placeholder="One instruction per line…"
              className="w-full bg-hld-surface-2 border border-hld-border text-hld-text text-[11.5px] leading-relaxed p-[8px] outline-none focus:border-hld-cyan/40 resize-none font-sans"
            />
          )}
        </div>
      )}
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  disabled = false,
  danger = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`w-[24px] h-[24px] flex items-center justify-center border border-hld-border text-hld-muted-text transition-colors disabled:opacity-25 disabled:cursor-not-allowed ${
        danger ? 'hover:text-hld-magenta hover:border-hld-magenta/40' : 'hover:text-hld-cyan hover:border-hld-cyan/40'
      }`}
    >
      {children}
    </button>
  );
}
