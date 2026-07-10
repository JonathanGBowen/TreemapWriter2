import { useStore } from '../../state';
import { Spinner } from '../shared/Spinner';
import { useDoctorActions } from './use-doctor-actions';
import { useDoctorWizardActions } from './use-doctor-wizard-actions';
import { ThesisDistiller } from './ThesisDistiller';
import { OutlineTable } from './OutlineTable';

const Panel = ({ children }: { children: React.ReactNode }) => (
  <div className="mx-auto w-full max-w-[760px] px-6 py-6 flex flex-col gap-4">{children}</div>
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

/** Step 1 — Discovery: settle the working thesis (document claim / distill / type). */
export function StepDiscovery() {
  const thesis = useStore((s) => s.doctorThesis);
  const options = useStore((s) => s.doctorThesisOptions);
  const busy = useStore((s) => s.doctorStatus === 'running' || s.doctorStatus === 'streaming');
  const advance = useStore((s) => s.advanceDoctorStep);
  const { runDistiller } = useDoctorActions();

  return (
    <Panel>
      <Blurb>
        Phase 1 — Discovery. To unblock this piece, we first need to understand what you are
        trying to say. The sequence reads the live draft in the chosen scope; the working thesis
        above is what it reads against.
      </Blurb>
      {!options?.length && (
        <div className="flex items-center gap-3">
          <Primary onClick={() => void runDistiller()} disabled={busy}>
            ⚗ Analyze &amp; find my thesis
          </Primary>
          <Primary onClick={advance} disabled={busy || !thesis.trim()}>
            I already have a thesis ›
          </Primary>
        </div>
      )}
      {busy && !options?.length && (
        <div className="flex items-center gap-2 font-mono text-[9px] text-hld-cyan">
          <Spinner /> Distilling…
        </div>
      )}
      {options && options.length > 0 && (
        <>
          <Blurb>Choose the thesis that names what the draft is really arguing:</Blurb>
          <ThesisDistiller onPick={advance} />
        </>
      )}
    </Panel>
  );
}

/** Step 2 — Calibration: the thesis check becomes the sequence's outlineData. */
export function StepCalibration() {
  const rows = useStore((s) => s.doctorCoherenceRows);
  const busy = useStore((s) => s.doctorStatus === 'running' || s.doctorStatus === 'streaming');
  const thesis = useStore((s) => s.doctorThesis);
  const { runCalibration } = useDoctorWizardActions();

  return (
    <>
      <Panel>
        <Blurb>
          Phase 2 — Calibration. The Logician maps every paragraph against your thesis: its
          claim, whether it supports the thesis, and why. This table anchors every later step.
        </Blurb>
        {busy ? (
          <div className="flex items-center gap-2 font-mono text-[9px] text-hld-cyan">
            <Spinner /> Mapping the draft…
          </div>
        ) : (
          <Primary onClick={() => void runCalibration()} disabled={!thesis.trim()}>
            {rows ? 'Recalibrate' : 'Start calibration'}
          </Primary>
        )}
      </Panel>
      {rows && !busy && (
        <div className="flex-1 min-h-0 flex flex-col border-t border-hld-border">
          <OutlineTable instrument="thesisCheck" />
        </div>
      )}
    </>
  );
}

/** Step 3 — Diagnosis: streamed CoT ending in the (editable) critical issue. */
export function StepDiagnosis() {
  const diagnosis = useStore((s) => s.doctorDiagnosis);
  const issue = useStore((s) => s.doctorCriticalIssue);
  const setIssue = useStore((s) => s.setDoctorCriticalIssue);
  const status = useStore((s) => s.doctorStatus);
  const advance = useStore((s) => s.advanceDoctorStep);
  const { runDiagnosis } = useDoctorWizardActions();

  const streaming = status === 'streaming';

  return (
    <Panel>
      <Blurb>
        Phase 3 — Diagnosis. A Senior Editor reads the coherence table and reasons, step by
        step, to the single most critical structural problem.
      </Blurb>
      {!diagnosis && !streaming && (
        <Primary onClick={() => void runDiagnosis()}>Identify the critical problem</Primary>
      )}
      {(diagnosis || streaming) && (
        <div className="border border-hld-border bg-hld-surface/60 p-4 max-h-[42vh] overflow-y-auto">
          <div className="font-sans text-[12.5px] text-slate-300 leading-relaxed whitespace-pre-wrap">
            {diagnosis}
            {streaming && <span className="animate-pulse text-hld-cyan">▍</span>}
          </div>
        </div>
      )}
      {diagnosis && !streaming && (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono uppercase tracking-[0.14em] text-[9px] text-hld-yellow">
              The critical issue (yours to edit)
            </span>
            <textarea
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
              rows={2}
              className="font-sans text-[12px] px-3 py-2 rounded border border-hld-border bg-hld-surface text-hld-text outline-none focus:border-hld-cyan/60 resize-y"
            />
          </label>
          <div className="flex items-center gap-3">
            <Primary onClick={() => void runDiagnosis()}>Re-diagnose</Primary>
            <Primary onClick={advance} disabled={!issue.trim()}>
              Accept the diagnosis ›
            </Primary>
          </div>
        </>
      )}
    </Panel>
  );
}
