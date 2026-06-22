import type { SectionSpec, SectionFunction } from '../../types';
import { SECTION_FUNCTIONS } from '../../lib/constants';
import { MoveList } from '../tests-panel/MoveList';
import type { SpecStage } from '../../services/ai/ai-provider.specs';

/** One read-only context list (incoming / outgoing) — refined via chat/steer. */
function ContextList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="font-mono text-[9px] tracking-[0.12em] uppercase text-hld-muted-text-2 mb-[4px]">{label}</div>
      <div className="flex flex-col gap-[5px]">
        {items.map((t, i) => (
          <div key={i} className="text-[12px] leading-relaxed font-sans text-hld-text pl-[9px] border-l border-hld-border">{t}</div>
        ))}
      </div>
    </div>
  );
}

/** One editable spec block: function + main claim + moves (the actionable core),
 *  with the incoming/outgoing context shown read-only beneath. */
function SpecEditor({
  title,
  spec,
  onEdit,
}: {
  title: string;
  spec: SectionSpec;
  onEdit: (spec: SectionSpec) => void;
}) {
  const writeMoves = (requiredMoves: SectionSpec['requiredMoves']) => onEdit({ ...spec, requiredMoves });
  const editMove = (i: number, text: string) =>
    writeMoves(spec.requiredMoves.map((m, idx) => (idx === i ? { ...m, description: text } : m)));
  const addMove = () => writeMoves([...spec.requiredMoves, { id: `move-${spec.requiredMoves.length}`, description: '' }]);
  const removeMove = (i: number) => writeMoves(spec.requiredMoves.filter((_, idx) => idx !== i));

  return (
    <div className="border border-hld-border bg-hld-surface/30 p-[14px] flex flex-col gap-[12px]">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] font-bold tracking-[0.08em] text-hld-text truncate">{title}</span>
        <span className="inline-flex items-center gap-[3px] shrink-0">
          <select
            value={spec.function}
            onChange={(e) => onEdit({ ...spec, function: e.target.value as SectionFunction })}
            title="Section function"
            className="bg-transparent border border-hld-border focus:border-hld-cyan outline-none font-mono text-[9px] font-semibold tracking-[0.1em] uppercase text-hld-text cursor-pointer appearance-none px-[6px] py-[3px]"
          >
            {SECTION_FUNCTIONS.map((f) => (
              <option key={f.id} value={f.id} className="bg-hld-surface text-hld-text normal-case">{f.label}</option>
            ))}
          </select>
        </span>
      </div>

      <textarea
        value={spec.mainClaim}
        onChange={(e) => onEdit({ ...spec, mainClaim: e.target.value })}
        rows={2}
        placeholder="The core proposition — what makes this section necessary?"
        className="w-full pl-[11px] border-l-2 border-hld-border focus:border-hld-cyan text-[13px] leading-relaxed font-sans text-hld-text bg-transparent outline-none resize-none placeholder-hld-muted/50 min-h-[3.2em] transition-colors"
      />

      <MoveList spec={spec} onEdit={editMove} onAdd={addMove} onRemove={removeMove} onRefine={() => {}} />

      {(spec.incomingContext.length > 0 || spec.outgoingCommitments.length > 0) && (
        <div className="flex flex-col gap-[10px] pt-[4px]">
          <ContextList label="Receives from prior" items={spec.incomingContext} />
          <ContextList label="Must establish for later" items={spec.outgoingCommitments} />
        </div>
      )}
    </div>
  );
}

/**
 * The editable preview of a stage's proposed specs — one block per section at this
 * level (a single block for the document level). Edits write straight back through
 * `onEditSpec`, so what the writer sees is exactly what Accept lands in the testSuite.
 */
export function SpecPreview({
  stage,
  proposed,
  titleFor,
  onEditSpec,
}: {
  stage: SpecStage;
  proposed: Record<string, SectionSpec>;
  titleFor: (sectionId: string) => string;
  onEditSpec: (sectionId: string, spec: SectionSpec) => void;
}) {
  const ids = stage.kind === 'root' ? ['root'] : stage.nodeIds;
  const present = ids.filter((id) => proposed[id]);

  if (present.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-center px-6">
        <p className="text-[12px] font-sans text-hld-muted-text-2 max-w-[28ch]">
          No proposal yet. {stage.kind === 'root' ? 'Generate the document-level spec' : 'Generate this level’s specs'} to review and edit them here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-[16px] flex flex-col gap-[14px]">
      {present.map((id) => (
        <SpecEditor key={id} title={titleFor(id)} spec={proposed[id]} onEdit={(spec) => onEditSpec(id, spec)} />
      ))}
    </div>
  );
}
