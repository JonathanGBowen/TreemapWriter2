// The Gist panel (left): title row + voice chip, the generate button, the gist
// prose (or an absent placeholder), and the status row — on a quiet paper-tint
// ground, resizable 260–420 px. This component owns the FIT guarantee: after any
// size or content change it measures candidate grains against an offscreen twin and
// renders the finest that fits — the panel never scrolls (P1).

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useStore } from '../../state';
import { ResizeHandle } from '../shared/ResizeHandle';
import { useColumnResize } from '../shared/useColumnResize';
import { chooseGrain, type PanelMetrics } from '../../lib/gist-helpers';
import { GIST_PANEL_MAX, GIST_PANEL_MIN } from '../../state/gist-state';
import { GenerateButton } from './GenerateButton';
import { GistProse } from './GistProse';
import { StatusRow } from './StatusRow';
import { useGistActions } from './use-gist-actions';

const VOICE_TAG_RESERVE = 38; // px reserved above the prose for the voice tag
const PROSE_PAD = 18;
const GLYPH_SAMPLE = 'the quick brown fox jumps over the lazy dog, and then some.';

/** Average glyph width for the prose font, via an offscreen canvas (design §6.1). */
const avgGlyphPx = (): number => {
  try {
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return 7.2;
    ctx.font = '15px Inter, sans-serif';
    return ctx.measureText(GLYPH_SAMPLE).width / GLYPH_SAMPLE.length;
  } catch {
    return 7.2;
  }
};

export function GistPanel() {
  const gist = useStore((s) => s.gist);
  const panelW = useStore((s) => s.gistPanelW);
  const setPanelW = useStore((s) => s.setGistPanelW);
  const grain = useStore((s) => s.gistGrain);
  const setGrain = useStore((s) => s.setGistGrain);
  const voiceMode = useStore((s) => s.gistVoiceMode);
  const setVoiceMode = useStore((s) => s.setGistVoiceMode);
  const { generate, refreshSpan, refitFine } = useGistActions();

  const containerRef = useRef<HTMLDivElement>(null);
  const proseRef = useRef<HTMLParagraphElement>(null);
  const twinRef = useRef<HTMLDivElement>(null);
  const refitKey = useRef<number | null>(null);

  // The empirical fit check: pick the finest grain whose rendered height fits.
  const measureFit = useCallback(() => {
    const g = useStore.getState().gist;
    const container = containerRef.current;
    const twin = twinRef.current;
    if (!g || !container || !twin) return;
    const H = container.clientHeight - VOICE_TAG_RESERVE;
    const W = (proseRef.current?.clientWidth ?? container.clientWidth - PROSE_PAD * 2) || 240;
    twin.style.width = `${W}px`;
    const measure = (text: string) => {
      twin.textContent = text;
      return twin.scrollHeight;
    };
    const next = chooseGrain(g, measure, H);
    if (next !== useStore.getState().gistGrain) setGrain(next);
    // Re-fit rescue (Prompt D): the fine grain overflowed — try compressing it once
    // per generation before living with the coarser fallback. Guaranteed no-scroll
    // either way, so this only ever upgrades the result.
    if (next !== 'fine' && refitKey.current !== g.generatedAt && g.fine.length) {
      refitKey.current = g.generatedAt;
      void refitFine(g.budgets.fine);
    }
  }, [setGrain, refitFine]);

  // Re-measure on content change and on any panel/window resize (ResizeObserver
  // covers both width drags and height changes; debounced ~150ms). Never regenerates.
  useLayoutEffect(measureFit, [measureFit, gist, panelW]);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let t: number | undefined;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(t);
      t = window.setTimeout(measureFit, 150);
    });
    ro.observe(container);
    return () => { ro.disconnect(); window.clearTimeout(t); };
  }, [measureFit]);

  const onResize = useColumnResize({ width: panelW, setWidth: setPanelW, edge: 'right', min: GIST_PANEL_MIN, max: GIST_PANEL_MAX });

  const handleGenerate = () => {
    const container = containerRef.current;
    const metrics: PanelMetrics = {
      contentW: (proseRef.current?.clientWidth ?? (container ? container.clientWidth - PROSE_PAD * 2 : panelW - 36)) || 240,
      contentH: (container ? container.clientHeight - VOICE_TAG_RESERVE : 600),
      lineHeightPx: 15 * 1.5,
      avgGlyphPx: avgGlyphPx(),
    };
    void generate(metrics);
  };

  const describe = voiceMode === 'describe';

  return (
    <aside
      className="relative shrink-0 flex flex-col min-h-0"
      style={{ width: panelW, background: 'var(--color-hld-surface)' }}
      aria-label="Gist — a scale model of the document"
    >
      {/* title row + voice chip */}
      <div style={{ padding: '14px 18px 10px', borderBottom: '1px solid var(--color-hld-border)' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 3 }}>
          <span className="font-mono uppercase" style={{ fontSize: 8, letterSpacing: '0.26em', color: 'var(--color-hld-muted-text)' }}>The Gist</span>
          <button
            type="button"
            onClick={() => setVoiceMode(describe ? 'perform' : 'describe')}
            title="Show how a describing summary fails this reader"
            className="font-mono uppercase"
            style={{
              fontSize: 8, letterSpacing: '0.1em', padding: '3px 7px', cursor: 'pointer',
              border: `1px solid ${describe ? 'rgba(255,230,0,0.5)' : 'rgba(0,232,245,0.4)'}`,
              background: describe ? 'rgba(255,230,0,0.08)' : 'rgba(0,232,245,0.06)',
              color: describe ? 'var(--color-hld-yellow)' : 'var(--color-hld-cyan)',
            }}
          >
            {describe ? '✕ describes' : '✓ performs'}
          </button>
        </div>
        <div className="font-sans italic" title={gist?.analysis.thesis ?? undefined} style={{ fontSize: 13, lineHeight: 1.3, color: 'var(--color-hld-muted-text-2)' }}>
          a scale model of the whole — in your own voice
        </div>
      </div>

      {/* generate button zone */}
      <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--color-hld-border)' }}>
        <GenerateButton onGenerate={handleGenerate} />
      </div>

      {/* gist prose (never scrolls) */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 flex flex-col justify-center"
        style={{ overflow: 'hidden', padding: PROSE_PAD, position: 'relative' }}
      >
        {gist ? (
          <GistProse ref={proseRef} gist={gist} grain={grain} onRefresh={refreshSpan} />
        ) : (
          <div className="flex flex-col items-center text-center" style={{ gap: 18, color: 'var(--color-hld-muted)' }}>
            <span aria-hidden style={{ width: 30, height: 30, transform: 'rotate(45deg)', border: '1.5px solid var(--color-hld-border-strong)', display: 'inline-block' }} />
            <div className="font-sans italic" style={{ fontSize: 16, lineHeight: 1.5, color: 'var(--color-hld-muted-text)', maxWidth: 230 }}>
              No gist yet. Generate to see the whole document at low resolution.
            </div>
          </div>
        )}
      </div>

      <StatusRow />

      {/* offscreen twin for pre-flight fit measurement (never visible) */}
      <div
        ref={twinRef}
        aria-hidden
        className="font-sans"
        style={{ position: 'absolute', left: -9999, top: 0, visibility: 'hidden', fontSize: 15, lineHeight: 1.5, whiteSpace: 'normal' }}
      />

      <ResizeHandle side="right" onMouseDown={onResize} />
    </aside>
  );
}
