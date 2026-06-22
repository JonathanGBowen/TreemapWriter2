import ReactMarkdown from 'react-markdown';
import { useStore } from '../../state';
import { CopyButton } from '../shared/CopyButton';
import { AgentTraceTicker } from '../shared/AgentTraceTicker';
import type { AtmosphericInstrument } from '../../types';

const TITLE: Record<AtmosphericInstrument, string> = {
  weatherReport: 'Weather Report',
  radarScan: 'Radar Scan',
  stormSpotter: 'Storm Spotter',
  forecast: 'Forecast',
};

/** Shown in the empty state to orient the writer to the chosen instrument. */
const BLURB: Record<AtmosphericInstrument, string> = {
  weatherReport:
    'A completed-text reading: atmospheric intensity, the substance of the field, and the mechanisms that build it.',
  radarScan:
    'A draft-wide atmospheric map: developing cells, dissipating turkey towers, frontal boundaries, and latent potential.',
  stormSpotter:
    'A close, single-passage diagnosis: what is forming, what feeds it, what disrupts it, and what would let it develop.',
  forecast:
    'A reading of an incomplete work: developing systems, atmospheric debt, and what the sky is trying to become.',
};

/** The atmospheric "weather report": prose rendered as markdown, with run states. */
export function ClimateReport() {
  const status = useStore((s) => s.climateStatus);
  const report = useStore((s) => s.climateReport);
  const instrument = useStore((s) => s.climateInstrument);

  return (
    <>
      <div className="relative px-4 py-3 border-b border-hld-border shrink-0 flex items-center justify-between gap-3">
        <div className="absolute top-0 left-0 right-0 h-px bg-hld-cyan shadow-[0_0_12px_var(--color-hld-cyan)]" />
        <div className="font-mono uppercase tracking-[0.14em] text-[10px] font-bold text-hld-text">
          {TITLE[instrument]}
        </div>
        {report && status !== 'running' && <CopyButton text={report} label="Copy report" />}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[760px] px-6 py-6">
          {status === 'running' ? (
            <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
              <span className="w-3 h-3 rounded-full border-[1.5px] border-hld-cyan/25 border-t-hld-cyan animate-spin" />
              <div className="font-mono uppercase tracking-[0.14em] text-[9px] text-hld-cyan">Reading the weather…</div>
              <div className="font-mono text-[9px] text-hld-muted-text max-w-[260px] leading-[1.6]">
                Tracing pressure, accumulation, and discharge across the text.
              </div>
              <AgentTraceTicker
                kinds={['analyzeAtmosphere']}
                className="flex items-center gap-1.5 text-[10px] font-mono text-hld-muted max-w-[320px] min-w-0"
              />
            </div>
          ) : !report ? (
            <div className="px-2 py-16 text-center">
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-hld-muted-text leading-[1.8]">
                {status === 'error'
                  ? 'The reading failed — adjust and run again.'
                  : BLURB[instrument]}
              </div>
            </div>
          ) : (
            <div className="markdown-body font-sans text-sm text-slate-300 leading-relaxed">
              <ReactMarkdown>{report}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
