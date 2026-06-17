import { useEffect } from 'react';
import { useStore } from '../../state';
import type { VersionRef } from '../../state/comparison-state';
import { repository } from '../../services/repository-registry';

/**
 * Lazy data loading for the Version Compare workspace. Mounted by the workspace
 * so its effects run only while it's open:
 *  - on open, fetch the deep, blob-free snapshot index (one cheap call), so the
 *    picker can reach far back without loading any file content;
 *  - whenever a side's selected version changes to a snapshot id, resolve its
 *    full content — fast-pathing the already-loaded recent `revisions`, else
 *    `repository.readSnapshot(id)`. The live draft ('current') needs no fetch.
 *
 * Reads live state via `getState()` so the effects stay stable (no dependency on
 * `revisions`/`loaded*`) and never loop.
 */
export function useCompareOperands() {
  const open = useStore((s) => s.comparisonOpen);
  const versionAId = useStore((s) => s.versionAId);
  const versionBId = useStore((s) => s.versionBId);

  // (Re)load the deep index each time the workspace opens. Cheap (metadata only)
  // and re-validating per open avoids staleness across project switches.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const { setSnapshotIndex, setIndexStatus } = useStore.getState();
    setIndexStatus('loading');
    repository
      .listSnapshotMeta()
      .then((metas) => {
        if (cancelled) return;
        setSnapshotIndex(metas);
        setIndexStatus('ready');
      })
      .catch(() => {
        if (!cancelled) useStore.getState().setIndexStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (open) void loadOperand('a', versionAId);
  }, [open, versionAId]);

  useEffect(() => {
    if (open) void loadOperand('b', versionBId);
  }, [open, versionBId]);
}

async function loadOperand(side: 'a' | 'b', ref: VersionRef | null): Promise<void> {
  const state = useStore.getState();
  const setLoaded = side === 'a' ? state.setLoadedA : state.setLoadedB;
  const loaded = side === 'a' ? state.loadedA : state.loadedB;

  // Live draft / unset: no snapshot to fetch.
  if (ref === 'current' || ref === null) {
    if (loaded !== null) setLoaded(null);
    return;
  }
  // Already resolved.
  if (loaded?.id === ref) return;

  // Fast path: recent revisions are already in memory with full content.
  const inMem = state.revisions.find((r) => r.id === ref);
  if (inMem) {
    setLoaded(inMem);
    return;
  }

  // Deep snapshot: clear the stale operand (UI shows "loading"), then fetch.
  setLoaded(null);
  const snap = await repository.readSnapshot(ref);
  // Guard a race: only apply if this side still wants this ref.
  const currentRef = side === 'a' ? useStore.getState().versionAId : useStore.getState().versionBId;
  if (currentRef === ref) setLoaded(snap);
}
