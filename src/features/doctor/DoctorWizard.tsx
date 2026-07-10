import { useStore } from '../../state';
import { DOCTOR_STEPS } from '../../state/doctor-state';
import { StepDiscovery, StepCalibration, StepDiagnosis } from './WizardSteps';
import { StepStrategy, StepAction } from './WizardStrategy';

const STEP_LABEL: Record<(typeof DOCTOR_STEPS)[number], { title: string; fine: string }> = {
  discovery: { title: 'Discovery', fine: 'what are you trying to say?' },
  calibration: { title: 'Calibration', fine: 'the coherence table' },
  diagnosis: { title: 'Diagnosis', fine: 'the one critical issue' },
  strategy: { title: 'Strategy', fine: 'three rescue roadmaps' },
  action: { title: 'Action', fine: 'the revision checklist' },
};

/**
 * The five-step sequence (the ported Breakthrough Sequence): a forward walk
 * with a cursor in the doctor slice — rail on the left, the active step's panel
 * on the right. Back is cheap (downstream outputs clear; everything is
 * regenerable), matching the interpolation walk's spirit.
 */
export function DoctorWizard() {
  const cursor = useStore((s) => s.doctorStepCursor);
  const retreat = useStore((s) => s.retreatDoctorStep);
  const reset = useStore((s) => s.resetDoctorWizard);
  const busy = useStore((s) => s.doctorStatus === 'running' || s.doctorStatus === 'streaming');

  const step = DOCTOR_STEPS[cursor];

  return (
    <div className="flex-1 flex min-h-0">
      <div className="w-[230px] shrink-0 border-r border-hld-border bg-hld-surface/40 flex flex-col">
        <div className="p-3 flex flex-col gap-1 flex-1">
          {DOCTOR_STEPS.map((s, i) => (
            <div
              key={s}
              aria-current={i === cursor ? 'step' : undefined}
              className={`px-2.5 py-2 border-l-2 transition-all ${
                i === cursor
                  ? 'border-l-hld-cyan bg-hld-cyan/8'
                  : i < cursor
                    ? 'border-l-hld-green/50'
                    : 'border-l-hld-border'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`font-mono text-[9px] w-4 text-center ${
                    i < cursor ? 'text-hld-green' : i === cursor ? 'text-hld-cyan' : 'text-hld-muted-text'
                  }`}
                >
                  {i < cursor ? '✓' : i + 1}
                </span>
                <span
                  className={`font-mono uppercase tracking-[0.12em] text-[9px] font-bold ${
                    i === cursor ? 'text-hld-text' : 'text-hld-muted-text'
                  }`}
                >
                  {STEP_LABEL[s].title}
                </span>
              </div>
              <div className="font-mono text-[8px] text-hld-muted-text pl-6">{STEP_LABEL[s].fine}</div>
            </div>
          ))}
        </div>
        <div className="p-3 flex items-center gap-2 border-t border-hld-border">
          <button
            type="button"
            onClick={retreat}
            disabled={busy || cursor === 0}
            className="px-2.5 py-1.5 border border-hld-border text-hld-muted-text hover:text-hld-text hover:border-hld-cyan/40 font-mono text-[9px] uppercase tracking-[0.12em] transition-all disabled:opacity-40"
          >
            ‹ Back
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={busy || cursor === 0}
            className="px-2.5 py-1.5 text-hld-muted-text hover:text-hld-cyan font-mono text-[9px] uppercase tracking-[0.12em] transition-all disabled:opacity-40"
          >
            Start over
          </button>
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col bg-hld-surface-3 overflow-y-auto">
        {step === 'discovery' && <StepDiscovery />}
        {step === 'calibration' && <StepCalibration />}
        {step === 'diagnosis' && <StepDiagnosis />}
        {step === 'strategy' && <StepStrategy />}
        {step === 'action' && <StepAction />}
      </div>
    </div>
  );
}
