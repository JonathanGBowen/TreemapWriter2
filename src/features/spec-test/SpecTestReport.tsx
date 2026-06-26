import { useStore } from '../../state';
import { AgentTraceTicker } from '../shared/AgentTraceTicker';
import { Spinner } from '../shared/Spinner';
import { WholeVerdictPanel } from './SpecTestWholeVerdict';
import { SpecTestSectionCard } from './SpecTestSectionCard';

/** The Spec Test report: the WHOLE verdict first, the parts beneath. While a run
 *  is live the parts fill incrementally from `specTestPartial`. */
export function SpecTestReport() {
  const status = useStore((s) => s.specTestStatus);
  const report = useStore((s) => s.specTestReport);
  const partial = useStore((s) => s.specTestPartial);
  const running = status === 'running';
  const sections = report ? report.sections : partial;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[860px] mx-auto p-5">
        {!report && !running && (
          <div className="px-2 py-16 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-hld-muted-text leading-[1.8]">
            Hold a spec as the test. Pick two versions and run — the report leads with whether B served the WHOLE, then the parts beneath. A piece can improve while the whole pays for it.
          </div>
        )}

        {report && (
          <WholeVerdictPanel
            whole={report.whole}
            tally={report.tally}
            audit={`${report.mode} · rubric: ${report.rubricSource} · scope: ${report.scopeLabel} · ${report.labelA} → ${report.labelB}`}
          />
        )}

        {running && (
          <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
            <Spinner />
            <div className="font-mono uppercase tracking-[0.14em] text-[9px] text-hld-cyan">Testing each part, then the whole…</div>
            <div className="font-mono text-[9px] text-hld-muted-text max-w-[260px] leading-[1.6]">
              Scoring B vs A against the held rubric, then judging whether the whole held — not a sum of the parts.
            </div>
            <AgentTraceTicker
              kinds={['runSpecTestSection', 'runSpecTestWhole']}
              className="flex items-center gap-1.5 text-[10px] font-mono text-hld-muted max-w-[300px] min-w-0"
            />
          </div>
        )}

        {sections.length > 0 && (
          <section>
            <div className="font-mono uppercase tracking-[0.14em] text-[10px] font-bold text-hld-text mb-2">By section · {sections.length}</div>
            <div className="space-y-1.5">
              {sections.map((s, i) => (
                <SpecTestSectionCard key={`${s.sectionTitle}-${i}`} section={s} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
