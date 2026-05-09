// Phase 3f — Repository registry / dependency injection point.
//
// Picks the active Repository at module load: TauriRepository when running
// under the desktop shell, BrowserRepository in the browser. The choice is
// frozen for the session — there is no way to swap mid-flight, by design.
//
// Every consumer in the codebase imports `repository` from here. This is
// the ONE place that knows about both implementations; everything else
// only knows the interface (`src/services/repository.ts`).

import { browserRepository } from './browser-repository';
import { tauriRepository } from './tauri-repository';
import { isTauri } from './tauri-environment';
import type { Repository } from './repository';

export const repository: Repository = isTauri()
  ? tauriRepository
  : browserRepository;

/** Lets diagnostic code log which repository is active without re-checking isTauri(). */
export const repositoryKind: 'tauri' | 'browser' = isTauri() ? 'tauri' : 'browser';
