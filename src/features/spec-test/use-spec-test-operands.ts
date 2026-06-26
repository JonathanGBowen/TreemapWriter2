import { useEffect } from 'react';
import { useStore } from '../../state';
import type { SessionRefOption, VersionRef } from '../../state/comparison-state';
import { repository } from '../../services/repository-registry';

/** `2026-06-21T09-15-00` → `06-21 09:15` for a compact session-ref label. */
function prettySession(id: string): string {
  const day = id.slice(5, 10);
  const time = id.slice(11, 16).replace('-', ':');
  return time ? `${day} ${time}` : day;
}

async function loadSessionRefs(): Promise<SessionRefOption[]> {
  const tags = await repository.listTags('session/*');
  const opts: SessionRefOption[] = [];
  for (const tag of [...tags].sort()) {
    const m = /^session\/(.+)\/(start|end)$/.exec(tag);
    if (!m) continue;
    const commitId = await repository.resolveRef(tag);
    if (!commitId) continue;
    opts.push({ commitId, label: `${prettySession(m[1])} · ${m[2]}` });
  }
  return opts;
}

/**
 * Lazy data loading for the Spec Test workspace (mirrors use-compare-operands).
 * Mounted by the workspace so its effects run only while it's open:
 *  - on open, fetch the deep, blob-free snapshot index;
 *  - resolve session-boundary tags into selectable refs;
 *  - resolve each side's selected snapshot to full content (markdown + testSuite —
 *    the latter is what the snapshot-A held-rubric source reads). Reads live state
 *    via getState() so the effects stay stable and never loop.
 */
export function useSpecTestOperands() {
  const open = useStore((s) => s.specTestOpen);
  const aId = useStore((s) => s.specTestAId);
  const bId = useStore((s) => s.specTestBId);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const { setSpecTestIndex, setSpecTestIndexStatus } = useStore.getState();
    setSpecTestIndexStatus('loading');
    repository
      .listSnapshotMeta()
      .then((metas) => {
        if (cancelled) return;
        setSpecTestIndex(metas);
        setSpecTestIndexStatus('ready');
      })
      .catch(() => {
        if (!cancelled) useStore.getState().setSpecTestIndexStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    loadSessionRefs()
      .then((refs) => {
        if (!cancelled) useStore.getState().setSpecTestSessionRefs(refs);
      })
      .catch(() => {
        if (!cancelled) useStore.getState().setSpecTestSessionRefs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (open) void loadOperand('a', aId);
  }, [open, aId]);

  useEffect(() => {
    if (open) void loadOperand('b', bId);
  }, [open, bId]);
}

async function loadOperand(side: 'a' | 'b', ref: VersionRef | null): Promise<void> {
  const state = useStore.getState();
  const setLoaded = side === 'a' ? state.setSpecTestLoadedA : state.setSpecTestLoadedB;
  const loaded = side === 'a' ? state.specTestLoadedA : state.specTestLoadedB;

  if (ref === 'current' || ref === null) {
    if (loaded !== null) setLoaded(null);
    return;
  }
  if (loaded?.id === ref) return;

  const inMem = state.revisions.find((r) => r.id === ref);
  if (inMem) {
    setLoaded(inMem);
    return;
  }

  setLoaded(null);
  const snap = await repository.readSnapshot(ref);
  const currentRef = side === 'a' ? useStore.getState().specTestAId : useStore.getState().specTestBId;
  if (currentRef === ref) setLoaded(snap);
}
