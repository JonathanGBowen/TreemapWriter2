import { useStore } from '../../state';
import { Pip } from '../shared/Pip';
import { ReviseConfig } from './ReviseConfig';
import { GenLoader } from './GenLoader';
import { AuditRun } from './AuditRun';
import { GroupedProposals } from './GroupedProposals';
import { ProposalCard } from './ProposalCard';
import { useRevisionActions } from './use-revision-actions';

/** N pending · N applied summary with the "new pass" reset. */
function ReviewSummary() {
  const proposals = useStore((s) => s.proposals);
  const resetRevision = useStore((s) => s.resetRevision);
  const pending = proposals.filter((p) => p._status === 'pending').length;
  const applied = proposals.filter((p) => p._status === 'accepted').length;
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 mb-3 border border-hld-border bg-hld-cyan/5">
      <Pip status="cyan" />
      <span className="font-mono uppercase tracking-[0.14em] text-[9px] text-hld-text">
        {pending} pending · {applied} applied
      </span>
      <button
        type="button"
        onClick={resetRevision}
        className="ml-auto font-mono text-[8.5px] uppercase tracking-[0.12em] text-hld-muted-text hover:text-hld-text"
      >
        ↺ new pass
      </button>
    </div>
  );
}

/** The phase switch: config → generating | auditing → review. Shared across the flow. */
export function ProposalsColumn({ large = false }: { large?: boolean }) {
  const phase = useStore((s) => s.revisionPhase);
  const proposals = useStore((s) => s.proposals);
  const audited = useStore((s) => s.auditQueue.length > 0);
  const { accept, reject } = useRevisionActions();

  if (phase === 'config') return <ReviseConfig />;
  if (phase === 'generating') return <GenLoader />;
  if (phase === 'auditing') return <AuditRun large={large} />;
  return (
    <div>
      <ReviewSummary />
      {audited ? (
        // A finished batch audit keeps its by-source grouping through review.
        <GroupedProposals large={large} onAccept={accept} onReject={reject} />
      ) : (
        proposals.map((p) => (
          <ProposalCard key={p.id} proposal={p} large={large} onAccept={accept} onReject={reject} />
        ))
      )}
    </div>
  );
}
