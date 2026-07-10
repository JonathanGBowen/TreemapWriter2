import { useStore } from '../../state';
import { Spinner } from '../shared/Spinner';
import { useDoctorWizardActions } from './use-doctor-wizard-actions';
import { ChecklistPanel } from './ChecklistPanel';

const Panel = ({ children }: { children: React.ReactNode }) => (
  <div className="mx-auto w-full max-w-[820px] px-6 py-6 flex flex-col gap-4">{children}</div>
);

const Blurb = ({ children }: { children: React.ReactNode }) => (
  <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-hld-muted-text leading-[1.8]">
    {children}
  </div>
);

const Primary = ({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="hld-lit px-4 py-2 self-start font-mono text-[10px] uppercase tracking-[0.12em] disabled:opacity-50 disabled:cursor-wait"
  >
    {children}
  </button>
);

/** Step 4 — Strategy: three rescue roadmaps; picking one is one click (the
 *  ported app made the writer copy-paste their choice — that step is gone). */
export function StepStrategy() {
  const issue = useStore((s) => s.doctorCriticalIssue);
  const roadmaps = useStore((s) => s.doctorRoadmaps);
  const chosen = useStore((s) => s.doctorChosenRoadmap);
  const choose = useStore((s) => s.chooseDoctorRoadmap);
  const busy = useStore((s) => s.doctorStatus === 'running' || s.doctorStatus === 'streaming');
  const { runStrategy, runChecklist } = useDoctorWizardActions();

  return (
    <Panel>
      <div className="border border-hld-yellow/30 bg-hld-yellow/5 px-4 py-3">
        <div className="font-mono uppercase tracking-[0.14em] text-[8px] text-hld-yellow mb-1">
          Critical diagnosis
        </div>
        <div className="font-sans text-[12px] text-slate-300 leading-relaxed">{issue}</div>
      </div>
      <Blurb>
        Phase 4 — Strategy. An Argument Strategist proposes three distinct roadmaps for
        restructuring the paper around the existing claims. Choose the one that names the paper
        you want.
      </Blurb>
      {busy ? (
        <div className="flex items-center gap-2 font-mono text-[9px] text-hld-cyan">
          <Spinner /> Strategizing…
        </div>
      ) : !roadmaps ? (
        <Primary onClick={() => void runStrategy()}>Generate rescue roadmaps</Primary>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {roadmaps.map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => choose(i)}
                aria-pressed={chosen === i}
                className={`text-left p-3 border transition-all flex flex-col gap-2 ${
                  chosen === i
                    ? 'border-hld-cyan bg-hld-cyan/8'
                    : 'border-hld-border bg-hld-surface hover:border-hld-cyan/50'
                }`}
              >
                <div
                  className={`font-mono uppercase tracking-[0.12em] text-[9px] font-bold ${
                    chosen === i ? 'text-hld-cyan' : 'text-hld-text'
                  }`}
                >
                  {chosen === i ? '◈ ' : ''}
                  {r.title}
                </div>
                {r.summary && (
                  <div className="font-sans text-[11px] text-slate-400 leading-snug">{r.summary}</div>
                )}
                <ul className="flex flex-col gap-1">
                  {r.outline.map((line, j) => (
                    <li key={j} className="font-sans text-[11px] text-slate-300 leading-snug pl-3 relative">
                      <span className="absolute left-0 text-hld-muted-text">·</span>
                      {line}
                    </li>
                  ))}
                </ul>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Primary onClick={() => void runStrategy()}>Redraw the roadmaps</Primary>
            <Primary onClick={() => void runChecklist()} disabled={chosen == null}>
              Create the action plan ›
            </Primary>
          </div>
        </>
      )}
    </Panel>
  );
}

/** Step 5 — Action: preview the tasks, save the checklist (the persisted ledger). */
export function StepAction() {
  const draftTasks = useStore((s) => s.doctorDraftTasks);
  const saved = useStore((s) => s.doctorChecklist);
  const busy = useStore((s) => s.doctorStatus === 'running' || s.doctorStatus === 'streaming');
  const { saveChecklist } = useDoctorWizardActions();

  // Once saved, the panel below is the live ledger (checkable, downloadable).
  const draftIsSaved =
    !!saved && !!draftTasks && saved.tasks.length === draftTasks.length &&
    saved.tasks.every((t, i) => t.text === draftTasks[i]?.text);

  return (
    <Panel>
      <Blurb>
        Phase 5 — Action. The chosen roadmap, as small, specific revision tasks anchored to your
        paragraphs. Save it: the checklist persists with the project and survives reloads.
      </Blurb>
      {busy && (
        <div className="flex items-center gap-2 font-mono text-[9px] text-hld-cyan">
          <Spinner /> Planning…
        </div>
      )}
      {draftTasks && !draftIsSaved && (
        <>
          <div className="border border-hld-green/30 bg-hld-green/5">
            {draftTasks.map((t, i) => (
              <div key={t.id} className="px-4 py-2 border-b border-hld-border/50 last:border-b-0 flex gap-3">
                <span className="font-mono text-[9px] text-hld-muted-text shrink-0 w-5 text-right pt-0.5">
                  {i + 1}.
                </span>
                <span className="font-sans text-[12px] text-slate-300 leading-relaxed flex-1">{t.text}</span>
                {t.paragraphNumbers.length > 0 && (
                  <span className="font-mono text-[8px] text-hld-muted-text shrink-0 pt-0.5">
                    ¶ {t.paragraphNumbers.join(', ')}
                  </span>
                )}
              </div>
            ))}
          </div>
          <Primary onClick={saveChecklist}>Save the checklist</Primary>
        </>
      )}
      {draftIsSaved && <ChecklistPanel />}
    </Panel>
  );
}
