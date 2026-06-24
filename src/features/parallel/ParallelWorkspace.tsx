import { useEffect, useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useStore } from '../../state';
import { sourceHashOf } from '../../lib/parallel-helpers';
import { RevisionRail } from '../revision/RevisionRail';
import { ParallelTopBar } from './ParallelTopBar';
import { ParallelGrid } from './ParallelGrid';
import { ParallelActionBar } from './ParallelActionBar';
import { useParallelActions } from './use-parallel-actions';
import { useParallelScope } from './use-parallel-scope';

/**
 * The Parallel Editor workspace. A full-screen mode (like the Revision Workspace)
 * for reverse-outline-driven revision: original prose · faithful reverse outline ·
 * your edited outline · regenerated draft, aligned by paragraph and scrolling in
 * lockstep. Self-gates on `parallelOpen`, so App mounts it unconditionally.
 */
export function ParallelWorkspace() {
  const open = useStore((s) => s.parallelOpen);
  const close = useStore((s) => s.closeParallel);
  const wholeDoc = useStore((s) => s.parallelWholeDoc);
  const reverseOutlines = useStore((s) => s.reverseOutlines);
  const scope = useParallelScope();
  const scopeKey = scope?.scopeKey;
  const {
    hydrate,
    acceptRow,
    persistOutline,
    generateOutline,
    regenerateChanged,
    acceptAll,
    resetAll,
  } = useParallelActions();

  // Re-hydrate rows whenever the scope changes (section switch / whole-doc toggle)
  // or the workspace opens. Keyed on scopeKey (a string), NOT the scope object, so
  // an accept (which mutates the doc but not the scope) never re-hydrates the rows.
  // `hydrate` is a stable useCallback, so this fires only on a real scope change.
  useEffect(() => {
    if (open) hydrate();
  }, [open, scopeKey, wholeDoc, hydrate]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  const stale = useMemo(() => {
    if (!scope) return false;
    const saved = reverseOutlines.find((d) => d.scopeKey === scope.scopeKey);
    return Boolean(saved && saved.sourceHash !== sourceHashOf(scope.text));
  }, [scope, reverseOutlines]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-hld-bg text-hld-text overflow-hidden font-sans">
      <ParallelTopBar />
      <div className="flex-1 flex min-h-0">
        {!wholeDoc && <RevisionRail />}
        <div className="flex-1 min-w-0 flex flex-col">
          {!scope ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-hld-muted-text">
                Select a section from the rail to begin
              </p>
            </div>
          ) : (
            <>
              {stale && (
                <div className="shrink-0 flex items-center gap-2 px-4 py-1.5 border-b border-hld-yellow/30 bg-hld-yellow/[0.06] text-hld-yellow font-mono text-[10px] tracking-[0.06em]">
                  <AlertTriangle size={12} />
                  The prose changed since this reverse outline was saved — some points may be out of date.
                </div>
              )}
              <ParallelGrid onAccept={acceptRow} onPersistOutline={persistOutline} />
              <ParallelActionBar
                onGenerateOutline={generateOutline}
                onRegenerate={regenerateChanged}
                onAcceptAll={acceptAll}
                onResetAll={resetAll}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
