import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import type { SectionSpec, DiagnosticResult, RequiredMove, MoveResult } from "../../types";
import { Zone } from "../shared/Zone";
import { Pip } from "../shared/Pip";
import { MOVE_STATUS_PIP, MOVE_STATUS_LABEL } from "./diagnostic-config";

/** One move: spec + its verdict, merged. The pip carries hue; a plain status word
 *  beside it means colour isn't the only signal (P4). Expands to WHERE + ACTION. */
function MoveRow({
  move, index, diagResult, onEdit, onRemove, onRefine,
}: {
  move: RequiredMove;
  index: number;
  diagResult?: MoveResult;
  onEdit: (i: number, text: string) => void;
  onRemove: (i: number) => void;
  onRefine: () => void;
}) {
  const [expanded, setExpanded] = useState(diagResult ? diagResult.status !== 'present' : false);
  const pip = diagResult ? MOVE_STATUS_PIP[diagResult.status] : 'idle';
  const done = diagResult?.status === 'present';
  return (
    <div className="border-b border-hld-border/60 group">
      <div className="flex items-start gap-[11px] py-[11px] px-[2px]">
        <span className="mt-[5px]" title={diagResult ? MOVE_STATUS_LABEL[diagResult.status] : 'no verdict yet'}>
          <Pip status={pip} />
        </span>
        <textarea
          value={move.description}
          onChange={(e) => onEdit(index, e.target.value)}
          rows={1}
          placeholder="Describe what this section must do…"
          className={`flex-1 pl-[9px] border-l-2 border-hld-border focus:border-hld-cyan text-[13px] leading-relaxed font-sans bg-transparent outline-none resize-none placeholder-hld-muted/50 min-h-[2.4em] transition-colors ${done ? 'text-hld-muted-text-2' : 'text-hld-text'}`}
        />
        {diagResult && (
          <span className="font-mono text-[9px] tracking-[0.1em] uppercase text-hld-muted-text shrink-0 mt-[5px]">
            {MOVE_STATUS_LABEL[diagResult.status]}
          </span>
        )}
        {diagResult && (
          <button type="button" onClick={() => setExpanded((x) => !x)} aria-label="Toggle move detail" className="text-hld-muted hover:text-hld-cyan shrink-0 mt-[4px] transition-colors">
            <span className={`inline-block text-[10px] transition-transform ${expanded ? 'rotate-90' : ''}`}>▸</span>
          </button>
        )}
        <button type="button" onClick={() => onRemove(index)} aria-label="Remove move" className="text-transparent group-hover:text-hld-muted-text hover:!text-hld-magenta shrink-0 mt-[4px] transition-colors">
          <X size={10} />
        </button>
      </div>
      {expanded && diagResult && (
        <div className="pl-[21px] pb-[12px] flex flex-col gap-[8px]">
          {diagResult.location && (
            <div className="text-[13px] leading-relaxed font-sans text-hld-muted-text-2">
              <span className="font-mono text-[9px] tracking-[0.1em] uppercase text-hld-muted-text mr-[6px]">where</span>
              {diagResult.location}
            </div>
          )}
          {diagResult.diagnosis && (
            <div className="text-[13px] leading-relaxed font-sans text-hld-muted-text-2">{diagResult.diagnosis}</div>
          )}
          {diagResult.suggestedAction && (
            <div className="bg-hld-surface2/60 border-l-2 border-hld-border px-[10px] py-[8px]">
              <span className="block font-mono text-[9px] tracking-[0.12em] uppercase text-hld-muted-text mb-[4px]">action</span>
              <div className="text-[13px] leading-relaxed font-sans text-hld-text">{diagResult.suggestedAction}</div>
            </div>
          )}
          <button type="button" onClick={onRefine} className="self-start flex items-center gap-[5px] font-mono text-[9px] tracking-[0.12em] uppercase text-hld-muted-text hover:text-hld-cyan transition-colors">
            <Sparkles size={9} /> refine
          </button>
        </div>
      )}
    </div>
  );
}

/** The merged move list — one row per required move, verdict pip + word inline.
 *  The actionable core of the Spec tab. */
export function MoveList({
  spec, diagnostic, onEdit, onAdd, onRemove, onRefine,
}: {
  spec: SectionSpec;
  diagnostic?: DiagnosticResult;
  onEdit: (i: number, text: string) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
  onRefine: () => void;
}) {
  const total = spec.requiredMoves.length;
  const done = diagnostic ? diagnostic.moveResults.filter((m) => m.status === 'present').length : 0;
  const meta = diagnostic ? `${done} of ${total} done` : `${total} ${total === 1 ? 'move' : 'moves'}`;

  return (
    <div>
      <Zone label="Moves" meta={meta} />
      <div className="mt-[6px]">
        {spec.requiredMoves.map((move, i) => (
          <MoveRow
            key={move.id}
            move={move}
            index={i}
            diagResult={diagnostic?.moveResults.find((mr) => mr.moveId === move.id)}
            onEdit={onEdit}
            onRemove={onRemove}
            onRefine={onRefine}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="w-full mt-[12px] py-[9px] bg-transparent border border-dashed border-hld-border text-hld-muted-text-2 hover:text-hld-cyan hover:border-hld-cyan/40 font-mono text-[10px] tracking-[0.12em] uppercase transition-colors"
      >
        + Move
      </button>
    </div>
  );
}
