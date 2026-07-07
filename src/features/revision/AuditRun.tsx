import { useStore } from '../../state';
import { Pip, type PipStatus } from '../shared/Pip';
import { GroupedProposals } from './GroupedProposals';
import { useSourceAudit } from './use-source-audit';
import { useRevisionActions } from './use-revision-actions';
import type { AuditItemStatus } from '../../lib/audit-helpers';

const PIP_FOR: Record<AuditItemStatus, PipStatus> = {
  queued: 'idle',
  auditing: 'cyan',
  done: 'green',
  skipped: 'yellow',
  error: 'magenta',
};

/**
 * The live batch-audit surface: a glyphic per-source pip row (the whole run's
 * state at a glance), quiet controls (continue when paused · stop — both
 * immediate, no confirm), and the proposals accumulating below, grouped by
 * source, reviewable mid-run. Proposals ride the unchanged accept gate.
 */
export function AuditRun({ large = false }: { large?: boolean }) {
  const queue = useStore((s) => s.auditQueue);
  const proposals = useStore((s) => s.proposals);
  const awaiting = useStore((s) => s.auditAwaiting);
  const cancelled = useStore((s) => s.auditCancelled);
  const sources = useStore((s) => s.sources);
  const { continueAudit, stopAudit } = useSourceAudit();
  const { accept, reject } = useRevisionActions();

  const settled = queue.filter((i) => i.status !== 'queued' && i.status !== 'auditing').length;
  const label = (id: string) => sources.find((s) => s.id === id)?.label ?? id;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2.5 px-3 py-2.5 border border-hld-border bg-hld-cyan/5">
        <Pip status="cyan" live pulse={!awaiting} />
        <span className="font-mono uppercase tracking-[0.14em] text-[9px] text-hld-text">
          {settled}/{queue.length} sources · {proposals.length} proposal
          {proposals.length === 1 ? '' : 's'}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {awaiting && (
            <button
              type="button"
              onClick={() => void continueAudit()}
              className="px-2 py-1 border border-hld-cyan/40 text-hld-cyan hover:bg-hld-cyan/10 font-mono text-[8.5px] font-bold uppercase tracking-[0.12em] transition-colors"
            >
              continue →
            </button>
          )}
          {!cancelled && (
            <button
              type="button"
              onClick={stopAudit}
              className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-hld-muted-text hover:text-hld-magenta transition-colors"
            >
              ■ stop
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 px-1">
        {queue.map((i) => (
          <Pip
            key={i.sourceId}
            status={PIP_FOR[i.status]}
            live={i.status === 'auditing'}
            pulse={i.status === 'auditing'}
            title={`${label(i.sourceId)} — ${i.status}${i.note ? ` (${i.note})` : ''}${
              i.status === 'done' ? ` · ${i.proposalCount} proposal${i.proposalCount === 1 ? '' : 's'}` : ''
            }`}
          />
        ))}
      </div>

      {awaiting && (
        <div className="font-mono text-[8.5px] text-hld-muted uppercase tracking-[0.08em] px-1">
          paused — review below, then continue
        </div>
      )}

      <GroupedProposals large={large} onAccept={accept} onReject={reject} />
    </div>
  );
}
