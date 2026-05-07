/**
 * Back-compat re-export. The store now lives in `src/state/`, partitioned
 * by lifecycle (ui / editor / document / project / ai). Components still
 * import from `./store` for now; they will migrate to specific slice
 * imports during Phase 1c follow-on work.
 *
 * @deprecated New code should import from `src/state` (or a specific
 *   slice) directly.
 */
export { useStore, STORAGE_PREFIX, META_KEY } from '../state';
export type { AppState } from '../state';
