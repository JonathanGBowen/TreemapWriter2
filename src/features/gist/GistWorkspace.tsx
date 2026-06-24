// The Gist Editor workspace: a full-screen re-entry surface (peer to Parallel /
// Compare / Glass Box). Left: the Gist panel (a scale model that always fits).
// Right: the document, in the app's editor. Self-gates on `gistOpen` so App mounts
// it unconditionally. Staleness is recomputed on open and on debounced edits.

import { useEffect, useMemo } from 'react';
import { useStore } from '../../state';
import { findSectionById } from '../tests-panel/use-current-section';
import { GistTopBar } from './GistTopBar';
import { GistPanel } from './GistPanel';
import { GistEditorSurface } from './GistEditorSurface';
import { useGistActions } from './use-gist-actions';

export function GistWorkspace() {
  const open = useStore((s) => s.gistOpen);
  const close = useStore((s) => s.closeGist);
  const gist = useStore((s) => s.gist);
  const localContent = useStore((s) => s.localContent);
  const sections = useStore((s) => s.sections);
  const selectedId = useStore((s) => s.selectedId);
  const { recomputeStaleness } = useGistActions();

  const activeTitle = useMemo(
    () => (selectedId ? findSectionById(sections, selectedId)?.title ?? null : null),
    [selectedId, sections],
  );

  // Escape closes (non-destructive — the gist + document persist).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  // Recompute staleness on open + on debounced edits (~1s). Annotates spans; never
  // rewrites them (P6). Re-runs harmlessly when a fresh gist lands (clears to none).
  useEffect(() => {
    if (!open || !gist) return;
    const t = window.setTimeout(recomputeStaleness, 1000);
    return () => window.clearTimeout(t);
  }, [open, gist, localContent, recomputeStaleness]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-hld-bg text-hld-text overflow-hidden font-sans">
      <GistTopBar />
      <div className="flex-1 flex min-h-0">
        <GistPanel />
        <main className="flex-1 min-w-0 flex flex-col" style={{ background: '#070d14' }}>
          <div className="shrink-0 flex items-center gap-2.5 font-mono" style={{ padding: '11px 28px', borderBottom: '1px solid #172335', background: '#091019' }}>
            <span className="uppercase" style={{ fontSize: 9, letterSpacing: '0.14em', color: '#6f8cab' }}>Whole document</span>
            {activeTitle && (
              <>
                <span style={{ color: '#3d5570' }}>›</span>
                <span className="truncate" style={{ fontSize: 9, letterSpacing: '0.14em', color: '#00e8f5' }}>{activeTitle}</span>
              </>
            )}
            <div className="flex-1" />
            <span className="uppercase" style={{ fontSize: 8, letterSpacing: '0.16em', color: '#5e789a' }}>WYSIWYG · markdown</span>
          </div>
          <div className="flex-1 min-h-0">
            <GistEditorSurface />
          </div>
        </main>
      </div>
    </div>
  );
}
