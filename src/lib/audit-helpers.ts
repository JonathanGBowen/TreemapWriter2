// Pure helpers for the per-source batch citation audit. No React, no store, no
// SDK — the revision slice and the orchestration hook lean on these so the queue
// mechanics stay trivially testable (mirrors lib/revision-helpers.ts in spirit).

import type { RevisionProposal, SourceDocument } from '../types';

/**
 * Honest one-shot statuses only: a single JSON call has no observable
 * reading/proposing boundary, so there is no fake finer-grained progress.
 * `skipped` covers both a cancelled run's remainder and an over-budget source
 * (the `note` says which).
 */
export type AuditItemStatus = 'queued' | 'auditing' | 'done' | 'error' | 'skipped';

export interface AuditItem {
  sourceId: string;
  status: AuditItemStatus;
  /** Proposals this source's audit produced (0 is a good outcome, not a failure). */
  proposalCount: number;
  /** One-line reason for a skip/error, surfaced as the pip tooltip + group caption. */
  note?: string;
}

/** A fresh queue in selection order. */
export const initAuditQueue = (sourceIds: string[]): AuditItem[] =>
  sourceIds.map((sourceId) => ({ sourceId, status: 'queued', proposalCount: 0 }));

/** The next source to audit, or undefined when the run is exhausted. */
export const nextQueued = (queue: AuditItem[]): AuditItem | undefined =>
  queue.find((i) => i.status === 'queued');

/** Patch one item by source id (unknown id is a no-op). */
export const patchAuditQueue = (
  queue: AuditItem[],
  sourceId: string,
  patch: Partial<Omit<AuditItem, 'sourceId'>>,
): AuditItem[] => queue.map((i) => (i.sourceId === sourceId ? { ...i, ...patch } : i));

/** Settle every still-queued item (the cancel path); in-flight/finished items keep their state. */
export const settleRemaining = (
  queue: AuditItem[],
  status: AuditItemStatus,
  note?: string,
): AuditItem[] => queue.map((i) => (i.status === 'queued' ? { ...i, status, note } : i));

/**
 * Exactly what one audit call sends (task scaffolding aside): the whole document,
 * this ONE source, and the directive. The single source of truth for the per-call
 * pre-flight — the `revision-budget.ts` idiom, per source.
 */
export const auditBudgetText = (
  documentText: string,
  source: SourceDocument,
  directive: string,
): string => [documentText, source.content, directive].filter(Boolean).join('\n\n');

/**
 * Group proposals by `source_id` in first-appearance order (which, for an audit
 * run, is the queue order). Proposals with no source id — impossible under strict
 * receipts, but tolerated — group under the empty key last.
 */
export const groupProposalsBySource = <T extends RevisionProposal>(
  proposals: T[],
): { sourceId: string; proposals: T[] }[] => {
  const order: string[] = [];
  const byId = new Map<string, T[]>();
  for (const p of proposals) {
    const key = p.source_id || '';
    if (!byId.has(key)) {
      byId.set(key, []);
      order.push(key);
    }
    byId.get(key)!.push(p);
  }
  // The unattributed group (if any) reads better after every named source.
  order.sort((a, b) => (a === '' ? 1 : 0) - (b === '' ? 1 : 0));
  return order.map((sourceId) => ({ sourceId, proposals: byId.get(sourceId)! }));
};
