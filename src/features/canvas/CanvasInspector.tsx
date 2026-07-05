// The W₁ Canvas node inspector (Arpeggio Phase 4) — a fixed right panel (screen space,
// always crisp) for the selected node: editable claim + kind, the status ladder (germ →
// apprehended → articulated), a declare-centre toggle, the node's edges (deletable), and
// the QUARRY body — a full textarea where dictation dumps + freewrites land as MATERIAL,
// never committed prose (Arpeggio §6.1), persisted on `StructuralPart.body`.

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useStore } from '../../state';
import { edgeArrow } from '../../lib/structural-graph-helpers';
import { useStructuralGraphActions } from '../structure/use-structural-graph-actions';
import { useCanvasActions } from './use-canvas-actions';
import type { StructuralPart } from '../../types';

const STATUSES: NonNullable<StructuralPart['status']>[] = ['germ', 'apprehended', 'articulated'];
const STRATEGIES: NonNullable<StructuralPart['expositionStrategy']>[] = ['systematic', 'genetic', 'spiral', 'reference'];

export function CanvasInspector({ part, onClose }: { part: StructuralPart; onClose: () => void }) {
  const parts = useStore((s) => s.structuralParts);
  const edges = useStore((s) => s.structuralEdges);
  const { updatePart, deletePart, deleteEdge } = useCanvasActions();
  const { toggleDeclaredCenter } = useStructuralGraphActions();

  const [claim, setClaim] = useState(part.claim);
  const [kind, setKind] = useState(part.kind);
  const [body, setBody] = useState(part.body ?? '');
  const claimRef = useRef<HTMLTextAreaElement>(null);
  const prevId = useRef<string | null>(null);

  // Re-sync the local editors when the selected node changes, and — only when the
  // SELECTION changes to a still-unnamed node (a fresh `N` germ) — focus the claim
  // so the writer types straight into it (Arpeggio's <5s, no-dialog authoring).
  useEffect(() => {
    setClaim(part.claim);
    setKind(part.kind);
    setBody(part.body ?? '');
    if (prevId.current !== part.id) {
      prevId.current = part.id;
      if (part.claim.trim() === '') claimRef.current?.focus();
    }
  }, [part.id, part.claim, part.kind, part.body]);

  const claimOf = (id: string) => parts.find((p) => p.id === id)?.claim ?? id;
  const partEdges = edges.filter((e) => e.fromPartId === part.id || e.toPartId === part.id);

  return (
    <aside className="w-[320px] shrink-0 flex flex-col bg-hld-surface border-l border-hld-border overflow-y-auto">
      <header className="flex items-center gap-[8px] px-[14px] h-[42px] border-b border-hld-border">
        <span aria-hidden className="w-[5px] h-[5px] rotate-45 bg-hld-purple" />
        <span className="font-mono text-[10px] tracking-[0.16em] uppercase text-hld-muted-text">Node</span>
        <button type="button" onClick={onClose} aria-label="Deselect" className="ml-auto text-hld-muted hover:text-hld-text transition-colors">
          <X size={13} />
        </button>
      </header>

      <div className="flex flex-col gap-[14px] p-[14px]">
        <label className="flex flex-col gap-[4px]">
          <span className="font-mono text-[8px] tracking-[0.14em] uppercase text-hld-muted">Claim</span>
          <textarea
            ref={claimRef}
            value={claim}
            onChange={(e) => setClaim(e.target.value)}
            onBlur={() => claim !== part.claim && void updatePart(part.id, { claim })}
            rows={2}
            className="resize-none bg-hld-surface-3 border border-hld-border text-hld-text text-[12px] leading-snug px-[8px] py-[6px] focus:outline-none focus:border-hld-cyan font-sans"
          />
        </label>

        <div className="flex items-center gap-[8px]">
          <label className="flex flex-col gap-[4px] flex-1">
            <span className="font-mono text-[8px] tracking-[0.14em] uppercase text-hld-muted">Kind</span>
            <input
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              onBlur={() => kind !== part.kind && void updatePart(part.id, { kind })}
              className="bg-hld-surface-3 border border-hld-border text-hld-text text-[11px] px-[8px] py-[5px] focus:outline-none focus:border-hld-cyan font-mono"
            />
          </label>
          <button
            type="button"
            onClick={() => void toggleDeclaredCenter(part.id)}
            title="Declare this node the argument's centre"
            className={`self-end px-[9px] py-[5px] font-mono text-[8px] tracking-[0.1em] uppercase border transition-colors ${
              part.declaredCenter ? 'border-hld-feat-glow text-hld-feat-glow' : 'border-hld-border text-hld-muted hover:text-hld-feat-glow'
            }`}
          >
            ◎ centre
          </button>
        </div>

        <div className="flex flex-col gap-[4px]">
          <span className="font-mono text-[8px] tracking-[0.14em] uppercase text-hld-muted">Status</span>
          <div className="flex gap-[4px]">
            {STATUSES.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => void updatePart(part.id, { status: st })}
                className={`flex-1 py-[5px] font-mono text-[8px] tracking-[0.08em] uppercase border transition-colors ${
                  (part.status ?? 'germ') === st ? 'border-hld-cyan text-hld-cyan' : 'border-hld-border text-hld-muted hover:text-hld-text'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-[4px]">
          <span className="font-mono text-[8px] tracking-[0.14em] uppercase text-hld-muted" title="How the edges this part GROUNDS derive precedence: systematic/spiral keep ground-before-lean; genetic/reference leave grounds order-free (Arpeggio §5).">
            Exposition strategy
          </span>
          <select
            value={part.expositionStrategy ?? 'systematic'}
            onChange={(e) => void updatePart(part.id, { expositionStrategy: e.target.value as NonNullable<StructuralPart['expositionStrategy']> })}
            className="bg-hld-surface-3 border border-hld-border text-hld-text text-[11px] px-[8px] py-[5px] focus:outline-none focus:border-hld-cyan font-mono"
          >
            {STRATEGIES.map((st) => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
        </label>

        {partEdges.length > 0 && (
          <div className="flex flex-col gap-[4px]">
            <span className="font-mono text-[8px] tracking-[0.14em] uppercase text-hld-muted">Links · {partEdges.length}</span>
            <div className="flex flex-col gap-[4px]">
              {partEdges.map((e) => {
                const outgoing = e.fromPartId === part.id;
                const other = outgoing ? e.toPartId : e.fromPartId;
                return (
                  <div key={e.id} className="flex items-center gap-[6px] px-[7px] py-[5px] border border-hld-border bg-hld-bg-deep">
                    <span className="font-mono text-[8px] font-bold text-hld-purple shrink-0">
                      {outgoing ? '' : `${edgeArrow(e.kind)} `}{e.kind}{outgoing ? ` ${edgeArrow(e.kind)}` : ''}
                    </span>
                    <span className="flex-1 text-[9.5px] text-hld-muted-text truncate" title={claimOf(other)}>{claimOf(other)}</span>
                    <button type="button" onClick={() => void deleteEdge(e.id)} title="Remove edge" className="text-hld-muted hover:text-hld-magenta shrink-0">
                      <X size={10} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <label className="flex flex-col gap-[4px]">
          <span className="font-mono text-[8px] tracking-[0.14em] uppercase text-hld-muted">Quarry — material, not prose</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onBlur={() => body !== (part.body ?? '') && void updatePart(part.id, { body })}
            rows={8}
            placeholder="Dictation dumps, freewrites, quotes, fragments…"
            className="resize-y bg-hld-surface-3 border border-hld-border text-hld-text text-[12px] leading-relaxed px-[8px] py-[6px] focus:outline-none focus:border-hld-cyan font-sans"
          />
        </label>

        <button
          type="button"
          onClick={() => void deletePart(part.id)}
          className="self-start font-mono text-[8px] tracking-[0.12em] uppercase text-hld-muted hover:text-hld-magenta transition-colors"
        >
          delete node
        </button>
      </div>
    </aside>
  );
}
