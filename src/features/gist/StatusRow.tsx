// The slim status row pinned to the panel bottom: generated-at · word/budget ·
// the grain ladder ticks (FINE COARSE G0, the active one lit) · a fit dot (green
// fits, yellow over budget). Calibrated-trust surface (P8): the map's reliability
// state is always inspectable.

import { useStore } from '../../state';
import { grainText } from '../../lib/gist-helpers';
import { countWords } from '../../lib/utils';
import type { GistGrain } from '../../types';

const relTime = (ts: number): string => {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

const TICKS: { g: GistGrain; label: string }[] = [
  { g: 'fine', label: 'FINE' },
  { g: 'coarse', label: 'COARSE' },
  { g: 'g0', label: 'G0' },
];

export function StatusRow() {
  const gist = useStore((s) => s.gist);
  const grain = useStore((s) => s.gistGrain);
  const generating = useStore((s) => s.gistGenerating);

  const budget = !gist ? 0 : grain === 'g0' ? gist.budgets.g0 : grain === 'coarse' ? gist.budgets.coarse : gist.budgets.fine;
  const words = gist ? countWords(grainText(gist, grain)) : 0;
  const over = words > budget;

  return (
    <div className="flex items-center gap-2.5" style={{ padding: '9px 18px', borderTop: '1px solid var(--color-hld-border)', background: 'var(--color-hld-surface)' }}>
      <span className="font-mono uppercase" style={{ fontSize: 8, letterSpacing: '0.1em', color: 'var(--color-hld-muted-text)' }}>
        {generating ? 'generating…' : gist ? `generated ${relTime(gist.generatedAt)}` : '— not generated'}
      </span>
      <div className="flex-1" />
      {gist && (
        <>
          <span className="font-mono" style={{ fontSize: 9, letterSpacing: '0.06em', color: over ? 'var(--color-hld-yellow)' : 'var(--color-hld-muted-text)' }}>
            {words} / {budget} w
          </span>
          <span style={{ width: 1, height: 11, background: 'var(--color-hld-border-strong)' }} />
          <div className="flex items-center gap-1.5" title="Finest grain that fits the window">
            {TICKS.map(({ g, label }) => {
              const on = g === grain;
              return (
                <span
                  key={g}
                  className="font-mono"
                  style={{
                    fontSize: 8, letterSpacing: '0.12em', padding: '1px 4px',
                    color: on ? 'var(--color-hld-cyan)' : 'var(--color-hld-muted)',
                    border: on ? '1px solid rgba(0,232,245,0.4)' : '1px solid transparent',
                    background: on ? 'rgba(0,232,245,0.07)' : 'transparent',
                  }}
                >
                  {label}
                </span>
              );
            })}
            <span
              aria-label={over ? 'Over budget' : 'Fits'}
              title={over ? 'Over budget' : 'Fits'}
              style={{ width: 7, height: 7, transform: 'rotate(45deg)', background: over ? 'var(--color-hld-yellow)' : 'var(--color-hld-green)', boxShadow: `0 0 7px ${over ? 'var(--color-hld-yellow)' : 'var(--color-hld-green)'}`, display: 'inline-block', marginLeft: 3 }}
            />
          </div>
        </>
      )}
    </div>
  );
}
