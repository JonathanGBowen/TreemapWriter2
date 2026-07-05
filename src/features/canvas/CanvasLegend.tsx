// The W₁ Canvas edge legend (Arpeggio Phase 4) — an always-available key to the
// seven typed relations, each drawn with the SAME per-kind line treatment the
// edge layer uses (`EDGE_DASH` / `SYMMETRIC_EDGE`), plus its keyboard letter (the
// `E`-then-letter authoring flow). Screen-space, so it never scales with zoom.

import type { StructuralEdgeKind } from '../../types';
import { EDGE_DASH, SYMMETRIC_EDGE } from '../modals/topo/topo-marks';
import { KIND_BY_LETTER } from './canvas-keys';

const KINDS: StructuralEdgeKind[] = ['grounds', 'requires', 'qualifies', 'opposes', 'exemplifies', 'defines', 'answers'];
const LETTER_BY_KIND = Object.fromEntries(Object.entries(KIND_BY_LETTER).map(([l, k]) => [k, l])) as Record<StructuralEdgeKind, string>;

export function CanvasLegend() {
  return (
    <div className="flex flex-col gap-[3px] px-[10px] py-[8px] bg-hld-surface/90 border border-hld-border backdrop-blur-sm">
      <span className="font-mono text-[7.5px] tracking-[0.16em] uppercase text-hld-muted mb-[2px]">Relations</span>
      {KINDS.map((kind) => (
        <div key={kind} className="flex items-center gap-[7px]">
          <svg width={26} height={8} viewBox="0 0 26 8" style={{ overflow: 'visible', flexShrink: 0 }} aria-hidden>
            <line x1={0} y1={4} x2={SYMMETRIC_EDGE(kind) ? 26 : 20} y2={4} stroke="var(--color-hld-purple)" strokeWidth={1.6} strokeDasharray={EDGE_DASH[kind]} strokeLinecap="round" />
            {!SYMMETRIC_EDGE(kind) && <path d="M26,4 L18,1 L18,7 Z" fill="var(--color-hld-purple)" />}
          </svg>
          <span className="font-mono text-[8px] tracking-[0.08em] uppercase text-hld-muted-text">{kind}</span>
          <span className="ml-auto font-mono text-[7.5px] text-hld-muted uppercase">{LETTER_BY_KIND[kind]}</span>
        </div>
      ))}
    </div>
  );
}
