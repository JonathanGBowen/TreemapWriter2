import { get, set } from 'idb-keyval';

/**
 * Global, app-level preferences that are NOT tied to a specific project.
 * Currently just the tutorial-seen flag; will grow to hold theme, default
 * persona, etc. as those become preferences rather than per-project state.
 *
 * Intentionally separate from the Repository — preferences are shared across
 * projects and survive project deletion.
 */

const TUTORIAL_SEEN_KEY = 'treemap_writer_tutorial_seen';

export async function hasSeenTutorial(): Promise<boolean> {
  return Boolean(await get(TUTORIAL_SEEN_KEY));
}

export async function markTutorialSeen(): Promise<void> {
  await set(TUTORIAL_SEEN_KEY, true);
}
