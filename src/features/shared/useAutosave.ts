import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useStore } from '../../store';

/**
 * The 60-second autosave/snapshot loop, extracted from the layout shell so the
 * timing + overlap + error-surfacing invariants live in one place.
 *
 * Two things make this loop subtle, and both are preserved here exactly:
 *
 * 1. **Late binding via ref.** The interval is mounted ONCE (empty-deps effect)
 *    so the timer isn't torn down on every render. But it must read the *latest*
 *    store thunks/values each tick, so we mirror them into a ref that re-syncs on
 *    every render and the tick reads `refs.current`.
 * 2. **Overlap guard.** A save that runs long (slow disk, git commit, network)
 *    must not let the next tick fire a second concurrent write to the same
 *    project file and clobber the first. `isAutoSavingRef` gates that.
 *
 * On failure the latest edits exist ONLY in memory: surface it loudly (toast once
 * per failure streak) and persistently (the `saveError` banner), instead of dying
 * silently in the console as it did during the 2026-06 desktop persistence
 * outage. The banner is cleared by the next SUCCESSFUL save (see saveCurrentState).
 */
export function useAutosave(): void {
  const saveCurrentState = useStore((s) => s.saveCurrentState);
  const createSnapshot = useStore((s) => s.createSnapshot);
  const activeProjectId = useStore((s) => s.activeProjectId);

  // Guards the 60s autosave against overlapping itself.
  const isAutoSavingRef = useRef(false);

  const autoSaveRefs = useRef({ saveCurrentState, createSnapshot, activeProjectId });
  useEffect(() => {
    autoSaveRefs.current = { saveCurrentState, createSnapshot, activeProjectId };
  });

  useEffect(() => {
    const intervalId = setInterval(() => {
      const refs = autoSaveRefs.current;
      if (!refs.activeProjectId) return;
      // Skip this tick if the previous save is still in flight — overlapping
      // writes to the same project file can clobber each other.
      if (isAutoSavingRef.current) return;
      isAutoSavingRef.current = true;
      void (async () => {
        try {
          await refs.saveCurrentState();
          await refs.createSnapshot('autosave');
        } catch (e) {
          console.error('Autosave failed', e);
          const store = useStore.getState();
          if (!store.saveError) {
            toast.error(
              'Save failed — your latest edits are NOT on disk. Export a backup (⌘K → Export project) and restart the app.',
              { duration: 10000 },
            );
          }
          store.setSaveError(
            'Unsaved: your latest edits are not on disk. Export a backup (⌘K → Export project) to be safe.',
          );
        } finally {
          isAutoSavingRef.current = false;
        }
      })();
    }, 60 * 1000); // Save every 60 seconds

    return () => clearInterval(intervalId);
  }, []);
}
