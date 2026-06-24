// The gist prose: the active grain rendered as one continuous passage of inline
// anchor spans. Pure prose at rest; on hover a soft underline; the you-are-here
// span carries a 2px cyan bar + leading diamond; a stale span gets a dotted
// underline + a ⟲ refresh; an orphaned span reads stale but can't be refreshed.
// The describe toggle swaps in the synthesized anti-pattern (never persisted).

import { forwardRef, useMemo, useRef, useState } from 'react';
import { useStore } from '../../state';
import { flattenGistSegments, spansForGrain, synthesizeDescribeSpans, describeG0 } from '../../lib/gist-helpers';
import type { GistGrain, GistSpan, StoredGist } from '../../types';

const CYAN = '#00e8f5';

interface GistProseProps {
  gist: StoredGist;
  grain: GistGrain;
  onRefresh: (id: string) => void;
}

/** The prose `<p>` is ref-forwarded so the fit hook can measure its box. */
export const GistProse = forwardRef<HTMLParagraphElement, GistProseProps>(function GistProse(
  { gist, grain, onRefresh },
  proseRef,
) {
  const voiceMode = useStore((s) => s.gistVoiceMode);
  const selectedId = useStore((s) => s.selectedId);
  const setSelectedId = useStore((s) => s.setSelectedId);
  const hoverId = useStore((s) => s.gistHoverId);
  const setHoverId = useStore((s) => s.setGistHoverId);
  const staleIds = useStore((s) => s.gistStaleIds);
  const orphanIds = useStore((s) => s.gistOrphanIds);
  const refreshingId = useStore((s) => s.gistRefreshingId);
  const sections = useStore((s) => s.sections);

  const describe = voiceMode === 'describe';
  const headingPaths = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const seg of flattenGistSegments(sections)) m.set(seg.id, seg.headingPath);
    return m;
  }, [sections]);

  const spans: GistSpan[] = useMemo(() => {
    if (describe) {
      if (grain === 'g0') return [{ id: 'thesis', text: describeG0(gist.analysis.thesis) }];
      const ids = (grain === 'coarse' ? gist.coarse : gist.fine).map((sp) => sp.id);
      return synthesizeDescribeSpans(
        ids.map((id) => ({
          id,
          title: headingPaths.get(id)?.slice(-1)[0] ?? id,
          analysis: gist.analysis.segments.find((a) => a.id === id),
        })),
      );
    }
    return spansForGrain(gist, grain);
  }, [describe, grain, gist, headingPaths]);

  const [roving, setRoving] = useState(0);
  const spanRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const focusSpan = (i: number) => {
    const clamped = Math.max(0, Math.min(i, spans.length - 1));
    setRoving(clamped);
    spanRefs.current[clamped]?.focus();
  };

  return (
    <>
      <div
        className="font-mono uppercase mb-3 flex items-center gap-2"
        style={{ fontSize: 8, letterSpacing: '0.16em', color: describe ? '#ff5d86' : '#5e789a' }}
      >
        {describe ? "describes the document — the register he can't hold" : 'performs the argument — in your own voice'}
      </div>
      <p
        ref={proseRef}
        className="font-sans"
        style={{ fontSize: 15, lineHeight: 1.5, color: '#cfe0f0', margin: 0, textWrap: 'pretty', opacity: describe ? 0.92 : 1 }}
      >
        {spans.map((sp, i) => {
          const navigable = !describe && sp.id !== 'thesis';
          const active = navigable && sp.id === selectedId;
          const hover = navigable && sp.id === hoverId;
          const stale = navigable && staleIds.includes(sp.id);
          const orphan = navigable && orphanIds.includes(sp.id);
          const refreshing = refreshingId === sp.id;
          const path = headingPaths.get(sp.id);

          const style: React.CSSProperties = {
            transition: 'background .2s, color .2s',
            borderRadius: 2,
            padding: '1px 2px',
            cursor: navigable ? 'pointer' : 'default',
            color: active ? '#eaf6ff' : '#cfe0f0',
            outline: 'none',
          };
          if (active) {
            style.background = 'rgba(0,232,245,0.10)';
            style.boxShadow = `-2px 0 0 0 ${CYAN}`;
          } else if (hover) {
            style.background = 'rgba(0,232,245,0.05)';
            style.textDecoration = 'underline';
            style.textDecorationColor = 'rgba(0,232,245,0.5)';
            style.textUnderlineOffset = '3px';
          }
          if (stale || orphan) {
            style.textDecoration = `underline dotted ${orphan ? 'rgba(255,93,134,0.8)' : 'rgba(127,154,182,0.8)'}`;
            style.textUnderlineOffset = '3px';
            style.color = orphan ? '#cf9fb0' : '#9fb4cb';
          }
          if (refreshing) {
            style.background = 'linear-gradient(90deg,rgba(0,232,245,0.04),rgba(0,232,245,0.22),rgba(0,232,245,0.04))';
            style.backgroundSize = '180px 100%';
            style.animation = 'gisthldshim 1s linear infinite';
          }

          return (
            <span key={sp.id + i}>
              <span
                ref={(el) => { spanRefs.current[i] = el; }}
                role={navigable ? 'link' : undefined}
                tabIndex={navigable ? (i === roving ? 0 : -1) : -1}
                aria-label={navigable ? `Go to: ${path ? path.join(' › ') : sp.id}` : undefined}
                title={orphan ? "Can't find this section anymore" : stale ? 'Source changed since this was generated' : ''}
                onClick={() => navigable && setSelectedId(sp.id)}
                onMouseEnter={() => navigable && setHoverId(sp.id)}
                onMouseLeave={() => navigable && setHoverId(null)}
                onFocus={() => setRoving(i)}
                onKeyDown={(e) => {
                  if (!navigable) return;
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(sp.id); }
                  else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); focusSpan(i + 1); }
                  else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); focusSpan(i - 1); }
                }}
                style={style}
              >
                {active && (
                  <span
                    aria-hidden
                    style={{ display: 'inline-block', width: 8, height: 8, transform: 'rotate(45deg)', background: CYAN, boxShadow: `0 0 8px ${CYAN}`, marginRight: 7 }}
                  />
                )}
                {sp.text}
              </span>
              {stale && !orphan && !refreshing && (
                <button
                  type="button"
                  onClick={() => onRefresh(sp.id)}
                  title="Refresh this part"
                  aria-label={`Refresh: ${path ? path.join(' › ') : sp.id}`}
                  style={{ font: 'inherit', fontSize: 10, color: CYAN, background: 'transparent', border: 'none', cursor: 'pointer', padding: '0 2px', opacity: 0.8 }}
                >
                  ⟲
                </button>
              )}{' '}
            </span>
          );
        })}
      </p>
    </>
  );
});
