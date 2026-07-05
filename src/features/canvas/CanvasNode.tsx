// A W₁ Canvas node card (Arpeggio Phase 4). Absolutely positioned at its part's
// world `position` inside the transformed world layer, so it scales with the camera.
// Shows the claim + a kind badge + a status ring (germ ⅓ · apprehended ⅔ · articulated
// full) and, when the writer has declared it the centre, the one reserved warm glow.
// Pointer-drag repositions (live, edges follow); a clean click selects (or completes an
// armed edge); double-click opens the inspector. `pointerdown` stops propagation so the
// background pan handler never fires.

import { useRef } from 'react';
import type { StructuralPart } from '../../types';
import type { Pt } from './canvas-geometry';

const DRAG_THRESHOLD = 3;

const STATUS_FRAC: Record<NonNullable<StructuralPart['status']>, number> = {
  germ: 0.34,
  apprehended: 0.67,
  articulated: 1,
};

/** A small ring whose filled arc encodes the node's status maturity. */
function StatusRing({ status }: { status?: StructuralPart['status'] }) {
  const frac = STATUS_FRAC[status ?? 'germ'];
  const r = 6;
  const c = 2 * Math.PI * r;
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden style={{ flexShrink: 0 }}>
      <circle cx={8} cy={8} r={r} fill="none" stroke="var(--color-hld-border-strong)" strokeWidth={2} />
      <circle
        cx={8}
        cy={8}
        r={r}
        fill="none"
        stroke="var(--color-hld-cyan)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray={`${frac * c} ${c}`}
        transform="rotate(-90 8 8)"
      />
    </svg>
  );
}

export function CanvasNode({
  part,
  selected,
  camK,
  onClick,
  onOpen,
  onLiveMove,
  onCommitMove,
}: {
  part: StructuralPart;
  selected: boolean;
  camK: number;
  onClick: (id: string) => void;
  onOpen: (id: string) => void;
  onLiveMove: (id: string, pos: Pt) => void;
  onCommitMove: () => void;
}) {
  const pos = part.position ?? { x: 0, y: 0 };
  const drag = useRef<{ sx: number; sy: number; orig: Pt; moved: boolean } | null>(null);
  const center = !!part.declaredCenter;

  return (
    <div
      role="button"
      tabIndex={-1}
      aria-label={`${part.kind}: ${part.claim}${center ? ', centre' : ''}${selected ? ', selected' : ''}`}
      onPointerDown={(e) => {
        e.stopPropagation();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        drag.current = { sx: e.clientX, sy: e.clientY, orig: pos, moved: false };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < DRAG_THRESHOLD) return;
        d.moved = true;
        onLiveMove(part.id, { x: d.orig.x + (e.clientX - d.sx) / camK, y: d.orig.y + (e.clientY - d.sy) / camK });
      }}
      onPointerUp={(e) => {
        const d = drag.current;
        drag.current = null;
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        if (d?.moved) onCommitMove();
        else onClick(part.id);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onOpen(part.id);
      }}
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        transform: 'translate(-50%, -50%)',
        width: 180,
        cursor: 'grab',
        boxShadow: center ? '0 0 0 1px var(--color-hld-feat-glow), 0 0 18px 2px var(--color-hld-feat-glow)' : undefined,
      }}
      className={`select-none rounded-sm border bg-hld-surface px-[10px] py-[8px] ${
        selected ? 'border-hld-cyan' : center ? 'border-hld-feat-glow' : 'border-hld-border'
      }`}
    >
      <div className="flex items-center gap-[6px]">
        <StatusRing status={part.status} />
        <span className="font-mono text-[7.5px] tracking-[0.14em] uppercase text-hld-muted-text truncate">{part.kind || 'part'}</span>
        {center && <span className="ml-auto font-mono text-[8px] text-hld-feat-glow" title="declared centre">◎</span>}
      </div>
      <div className="mt-[4px] text-[11px] leading-snug text-hld-text line-clamp-3">{part.claim || 'untitled'}</div>
    </div>
  );
}
