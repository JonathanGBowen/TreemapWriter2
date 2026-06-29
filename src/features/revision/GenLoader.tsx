import { useStore } from '../../store';
import { AgentTraceTicker } from '../shared/AgentTraceTicker';
import { Spinner } from '../shared/Spinner';

/**
 * Generating-phase loader. The caption is load-bearing: it states the guarantee.
 *
 * Two shapes, because the workspace has two generate paths: the single-pass engine
 * (`generateRevisions`) and the bounded deep pass (the local agent, call-kind
 * `runAgent`). The ticker watches BOTH kinds, so the deep pass's live think/activity
 * trail shows inline; and when a `runAgent` run is in flight we swap the
 * receipt-framed caption for a gather-framed one (the deep pass is grounded in the
 * document, not source receipts).
 */
export function GenLoader() {
  const deepPass = useStore((s) =>
    s.traceRuns.some((r) => r.status === 'running' && r.callKind === 'runAgent'),
  );

  return (
    <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
      <Spinner />
      <div className="font-mono uppercase tracking-[0.14em] text-[9px] text-hld-cyan">
        {deepPass ? 'Gathering context…' : 'Tracing sources…'}
      </div>
      <div className="font-mono text-[9px] text-hld-muted-text max-w-[240px] leading-[1.6]">
        {deepPass
          ? 'The agent is reading neighbouring sections, searching the manuscript, and checking history before it proposes. You accept each edit.'
          : 'Every proposal will carry a verbatim quote from your sources. No claim without a receipt.'}
      </div>
      <AgentTraceTicker
        kinds={['generateRevisions', 'runAgent']}
        className="flex items-center gap-1.5 text-[10px] font-mono text-hld-muted max-w-[300px] min-w-0"
      />
    </div>
  );
}
