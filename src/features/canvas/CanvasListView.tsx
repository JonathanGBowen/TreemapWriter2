// The W₁ Canvas list-view + SR parity (Arpeggio Phase 4). Two renderings of the
// SAME graph as text, so the canvas is fully usable without the spatial view:
//   • an ALWAYS-mounted `sr-only` outline (mirroring the treemap's sr-mirror
//     pattern) — every node's kind/claim/status/centre + its edges, `, selected`
//     on the active node — so assistive tech reads the whole configuration;
//   • a visible, keyboard-navigable panel (toggled by `canvasListView`) whose
//     rows select the same node the cards do.
// Pure presentation: the parts/edges/selection + the select callback are props.

import type { StructuralEdge, StructuralPart } from '../../types';
import { edgeArrow } from '../../lib/structural-graph-helpers';

/** One line of text describing a node's edges (for the SR outline + row subtitle). */
function edgeLines(part: StructuralPart, edges: StructuralEdge[], claimOf: (id: string) => string): string[] {
  return edges
    .filter((e) => e.fromPartId === part.id || e.toPartId === part.id)
    .map((e) => {
      const outgoing = e.fromPartId === part.id;
      const other = outgoing ? e.toPartId : e.fromPartId;
      return outgoing
        ? `${e.kind} ${edgeArrow(e.kind)} ${claimOf(other)}`
        : `${claimOf(other)} ${edgeArrow(e.kind)} ${e.kind}`;
    });
}

function nodeSentence(part: StructuralPart, links: string[], selected: boolean): string {
  const status = part.status ?? 'germ';
  const centre = part.declaredCenter ? ', declared centre' : '';
  const sel = selected ? ', selected' : '';
  const linkClause = links.length ? `; ${links.length} link${links.length === 1 ? '' : 's'}: ${links.join('; ')}` : '';
  return `${part.kind || 'part'}: ${part.claim || 'untitled'} — ${status}${centre}${sel}${linkClause}`;
}

export function CanvasListView({
  parts,
  edges,
  selectedId,
  visible,
  onSelect,
}: {
  parts: StructuralPart[];
  edges: StructuralEdge[];
  selectedId: string | null;
  visible: boolean;
  onSelect: (id: string) => void;
}) {
  const claimOf = (id: string) => parts.find((p) => p.id === id)?.claim ?? id;

  return (
    <>
      {/* Always-on text alternative — the whole W₁ configuration as an outline. */}
      <ul className="sr-only" aria-label="W₁ canvas">
        {parts.map((p) => (
          <li key={p.id}>{nodeSentence(p, edgeLines(p, edges, claimOf), p.id === selectedId)}</li>
        ))}
      </ul>

      {/* Visible, keyboard-navigable mirror (the list-view toggle). */}
      {visible && (
        <aside className="w-[300px] shrink-0 flex flex-col bg-hld-surface border-r border-hld-border overflow-y-auto">
          <header className="flex items-center gap-[8px] px-[14px] h-[42px] border-b border-hld-border shrink-0">
            <span aria-hidden className="w-[5px] h-[5px] rotate-45 bg-hld-cyan" />
            <span className="font-mono text-[10px] tracking-[0.16em] uppercase text-hld-muted-text">List · {parts.length}</span>
          </header>
          {parts.length === 0 ? (
            <div className="p-[18px] font-mono text-[9px] tracking-[0.12em] uppercase text-hld-muted leading-[1.8]">
              No parts yet. Press N to author a germ node, or drag one in from the inbox.
            </div>
          ) : (
            <ul className="flex flex-col">
              {parts.map((p) => {
                const links = edgeLines(p, edges, claimOf);
                const selected = p.id === selectedId;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(p.id)}
                      aria-current={selected}
                      className={`w-full text-left px-[14px] py-[9px] border-b border-hld-border/50 transition-colors ${
                        selected ? 'bg-hld-cyan/10 border-l-2 border-l-hld-cyan' : 'hover:bg-hld-cyan/5 border-l-2 border-l-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-[6px]">
                        <span className="font-mono text-[7.5px] tracking-[0.12em] uppercase text-hld-muted-text truncate">{p.kind || 'part'}</span>
                        <span className="font-mono text-[7px] tracking-[0.1em] uppercase text-hld-muted ml-auto shrink-0">{p.status ?? 'germ'}</span>
                        {p.declaredCenter && <span className="font-mono text-[8px] text-hld-feat-glow shrink-0" title="declared centre">◎</span>}
                      </div>
                      <div className={`mt-[3px] text-[11px] leading-snug line-clamp-2 ${selected ? 'text-hld-text' : 'text-hld-muted-text'}`}>
                        {p.claim || 'untitled'}
                      </div>
                      {links.length > 0 && (
                        <div className="mt-[3px] font-mono text-[8px] text-hld-purple/80 truncate" title={links.join(' · ')}>
                          {links.length} link{links.length === 1 ? '' : 's'}
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      )}
    </>
  );
}
