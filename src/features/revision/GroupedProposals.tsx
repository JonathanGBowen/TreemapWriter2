import { useStore } from '../../state';
import { groupProposalsBySource } from '../../lib/audit-helpers';
import { ProposalCard } from './ProposalCard';
import type { SessionProposal } from '../../state/revision-state';

/**
 * Proposals grouped by source (the batch audit's review shape): a slim glyphic
 * header per source, its cards beneath, and — so silence is never ambiguous —
 * caption-only rows for audited sources that yielded nothing, were skipped, or
 * errored. Reuses the untouched ProposalCard/accept pipeline.
 */
export function GroupedProposals({
  large = false,
  onAccept,
  onReject,
}: {
  large?: boolean;
  onAccept: (p: SessionProposal) => void;
  onReject: (id: string) => void;
}) {
  const proposals = useStore((s) => s.proposals);
  const queue = useStore((s) => s.auditQueue);
  const sources = useStore((s) => s.sources);

  const groups = groupProposalsBySource(proposals);
  const grouped = new Set(groups.map((g) => g.sourceId));
  const meta = (id: string) => sources.find((s) => s.id === id);

  // Audited-but-proposal-less sources (done/0, skipped, error), in queue order.
  const silent = queue.filter(
    (i) => !grouped.has(i.sourceId) && i.status !== 'queued' && i.status !== 'auditing',
  );

  const caption = (status: string, note: string | undefined, count: number) => {
    if (status === 'done')
      return count === 0 ? 'no issues — used well, or not this source\'s territory' : null;
    if (status === 'skipped') return note ? `skipped — ${note}` : 'skipped';
    return note ? `failed — ${note}` : 'failed';
  };

  return (
    <div className="flex flex-col gap-1">
      {groups.map((g) => {
        const src = meta(g.sourceId);
        const pending = g.proposals.filter((p) => p._status === 'pending').length;
        const applied = g.proposals.filter((p) => p._status === 'accepted').length;
        return (
          <div key={g.sourceId || '(intrinsic)'}>
            <div className="flex items-center gap-1.5 px-1 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-hld-muted-text border-b border-hld-border mb-2">
              <span className="text-[11px]">{src?.glyph ?? '◇'}</span>
              <span className="font-semibold text-hld-text truncate">
                {src?.label ?? (g.sourceId ? g.sourceId : 'document-grounded')}
              </span>
              <span className="ml-auto shrink-0">
                {pending} pending · {applied} applied
              </span>
            </div>
            {g.proposals.map((p) => (
              <ProposalCard key={p.id} proposal={p} large={large} onAccept={onAccept} onReject={onReject} />
            ))}
          </div>
        );
      })}
      {silent.map((i) => {
        const src = meta(i.sourceId);
        const text = caption(i.status, i.note, i.proposalCount);
        if (!text) return null;
        return (
          <div
            key={i.sourceId}
            className="flex items-center gap-1.5 px-1 py-1.5 font-mono text-[8.5px] uppercase tracking-[0.1em] text-hld-muted"
            title={i.note}
          >
            <span className="text-[10px]">{src?.glyph ?? '◇'}</span>
            <span className="truncate">{src?.label ?? i.sourceId}</span>
            <span className="shrink-0">— {text}</span>
          </div>
        );
      })}
    </div>
  );
}
