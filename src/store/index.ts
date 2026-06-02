/**
 * Back-compat re-export. The store now lives in `src/state/`, partitioned
 * by lifecycle (ui / editor / document / project / ai). Components still
 * import from `./store` for now; new code should import from `src/state`
 * (or a specific slice) directly.
 *
 * @deprecated New code: `import { useStore } from '../state'` instead.
 */
export { useStore } from '../state';
export type { AppState } from '../state';
