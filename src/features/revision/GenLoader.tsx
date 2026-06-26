import { AgentTraceTicker } from '../shared/AgentTraceTicker';
import { Spinner } from '../shared/Spinner';

/** Generating-phase loader. The line is load-bearing: it states the guarantee. */
export function GenLoader() {
  return (
    <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
      <Spinner />
      <div className="font-mono uppercase tracking-[0.14em] text-[9px] text-hld-cyan">
        Tracing sources…
      </div>
      <div className="font-mono text-[9px] text-hld-muted-text max-w-[240px] leading-[1.6]">
        Every proposal will carry a verbatim quote from your sources. No claim without a receipt.
      </div>
      <AgentTraceTicker
        kinds={['generateRevisions']}
        className="flex items-center gap-1.5 text-[10px] font-mono text-hld-muted max-w-[300px] min-w-0"
      />
    </div>
  );
}
