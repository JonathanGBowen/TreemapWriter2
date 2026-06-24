// The generate button: a four-state machine derived from real conditions (never
// stored). absent + overflow are the two conspicuous filled states (no gist / it
// no longer fits); stale is deliberately intermediate; fresh is a quiet ghost.
// During generation the old gist stays interactive (the swap is atomic elsewhere).

import { useStore } from '../../state';
import type { GistGrain } from '../../types';

const CYAN = '#00e8f5';
const MAGENTA = '#ff1060';

type GenState = 'absent' | 'overflow' | 'stale' | 'fresh';

const deriveState = (hasGist: boolean, grain: GistGrain, staleCount: number): GenState => {
  if (!hasGist) return 'absent';
  if (grain === 'g0') return 'overflow';
  if (staleCount > 0) return 'stale';
  return 'fresh';
};

const STYLES: Record<GenState, React.CSSProperties> = {
  absent: { background: 'rgba(0,232,245,0.13)', border: `1px solid ${CYAN}`, color: '#dffaff', boxShadow: '0 0 22px rgba(0,232,245,0.22), inset 0 0 18px rgba(0,232,245,0.06)' },
  overflow: { background: 'rgba(255,16,96,0.12)', border: `1px solid ${MAGENTA}`, color: '#ffd9e4', boxShadow: '0 0 22px rgba(255,16,96,0.2), inset 0 0 18px rgba(255,16,96,0.06)' },
  stale: { background: 'rgba(0,232,245,0.04)', border: '1px solid rgba(0,232,245,0.55)', color: '#bfeef5' },
  fresh: { background: 'transparent', border: '1px solid #1d2d42', color: '#6f8cab' },
};
const LABELS: Record<GenState, string> = { absent: 'Generate gist', overflow: 'Regenerate to fit', stale: 'Update gist', fresh: 'Regenerate' };

export function GenerateButton({ onGenerate }: { onGenerate: () => void }) {
  const hasGist = useStore((s) => !!s.gist);
  const grain = useStore((s) => s.gistGrain);
  const staleCount = useStore((s) => s.gistStaleIds.length);
  const generating = useStore((s) => s.gistGenerating);

  const state = deriveState(hasGist, grain, staleCount);
  const diamond = (color: string) => (
    <span aria-hidden style={{ width: 7, height: 7, transform: 'rotate(45deg)', background: color, boxShadow: `0 0 8px ${color}`, display: 'inline-block' }} />
  );

  return (
    <div>
      <button
        type="button"
        onClick={onGenerate}
        disabled={generating}
        aria-label={generating ? 'Generating gist' : LABELS[state]}
        className="font-mono uppercase w-full relative overflow-hidden"
        style={{
          padding: '11px 12px', fontSize: 10, fontWeight: 600, letterSpacing: '0.14em',
          cursor: generating ? 'default' : 'pointer',
          ...(generating
            ? { background: 'rgba(0,232,245,0.06)', border: '1px solid rgba(0,232,245,0.4)', color: '#bfeef5' }
            : STYLES[state]),
        }}
      >
        {generating ? (
          <>
            <span aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
              <span style={{ position: 'absolute', top: 0, bottom: 0, width: '40%', background: 'linear-gradient(90deg,transparent,rgba(0,232,245,0.5),transparent)', animation: 'gisthldprog 1.1s linear infinite' }} />
            </span>
            <span style={{ position: 'relative', zIndex: 2 }}>Generating…</span>
          </>
        ) : (
          <span style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
            {(state === 'absent' || state === 'overflow') && diamond(state === 'overflow' ? MAGENTA : CYAN)}
            <span>{LABELS[state]}</span>
            {state === 'stale' && (
              <span style={{ fontSize: 9, fontWeight: 700, color: '#05090d', background: CYAN, borderRadius: 2, padding: '1px 6px', letterSpacing: '0.04em' }}>
                {staleCount} changed
              </span>
            )}
          </span>
        )}
      </button>
      {state === 'overflow' && !generating && (
        <div className="flex items-center gap-2" style={{ marginTop: 8, fontSize: 9, lineHeight: 1.4, letterSpacing: '0.04em', color: '#ff5d86' }}>
          <span aria-hidden style={{ width: 5, height: 5, transform: 'rotate(45deg)', background: MAGENTA, boxShadow: `0 0 6px ${MAGENTA}`, flex: 'none' }} />
          The gist no longer fits this window.
        </div>
      )}
    </div>
  );
}
