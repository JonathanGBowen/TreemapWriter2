// Pure, generic directed-graph helpers — forward reachability and
// strongly-connected components by mutual reachability. No React/store/SDK.
// Lifted verbatim from the radix engine (`topo-centering.ts`) so the two graphs
// that need them — the section-dependency graph (centering) and the W₁
// precedence-constraint graph (Arpeggio Phase 5) — share ONE tested
// implementation. O(V²) is ample for one dissertation, and deterministic in the
// caller's id order.

/**
 * Forward reachability from `start` over an adjacency map. The result is NOT
 * seeded with `start`, so it contains `start` itself iff `start` lies on a cycle.
 */
export function reachFrom(start: string, adj: Map<string, string[]>): Set<string> {
  const seen = new Set<string>();
  const stack = [...(adj.get(start) ?? [])];
  while (stack.length) {
    const n = stack.pop() as string;
    if (seen.has(n)) continue;
    seen.add(n);
    for (const t of adj.get(n) ?? []) stack.push(t);
  }
  return seen;
}

/** The reachability set for every id (id → the ids reachable from it). */
export function reachAll(ids: string[], adj: Map<string, string[]>): Map<string, Set<string>> {
  const reach = new Map<string, Set<string>>();
  for (const id of ids) reach.set(id, reachFrom(id, adj));
  return reach;
}

export interface SccGroups {
  /** id → its component index. */
  compId: Map<string, number>;
  /** component index → its member ids (a component of size > 1 is a cycle). */
  compMembers: Map<number, string[]>;
}

/**
 * Strongly-connected components by mutual reachability (an equivalence relation:
 * a and b share a component iff each reaches the other). Deterministic in `ids`
 * order. `reach` must cover every id in `ids` (use `reachAll`).
 */
export function sccGroups(ids: string[], reach: Map<string, Set<string>>): SccGroups {
  const compId = new Map<string, number>();
  const compMembers = new Map<number, string[]>();
  let next = 0;
  for (const id of ids) {
    if (compId.has(id)) continue;
    const ri = reach.get(id) as Set<string>;
    const members = [id, ...ids.filter((j) => j !== id && ri.has(j) && (reach.get(j) as Set<string>).has(id))];
    for (const m of members) compId.set(m, next);
    compMembers.set(next, members);
    next++;
  }
  return { compId, compMembers };
}
