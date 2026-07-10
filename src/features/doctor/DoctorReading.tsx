import { useStore } from '../../state';
import { Spinner } from '../shared/Spinner';
import { OutlineTable } from './OutlineTable';
import { DoctorReport } from './DoctorReport';
import { ParagraphDiagnostic } from './ParagraphDiagnostic';

/** Orienting blurbs for each instrument's empty state (the Climate idiom). */
const BLURB: Record<string, string> = {
  claims: 'The classic reverse outline: the thesis on top, one maximally concise claim per paragraph — the skeleton of what you actually wrote.',
  saysDoes: 'The Functional Reverse Outline: per paragraph, what it SAYS (content) and what it DOES (rhetorical function) — one line each.',
  thesisCheck: 'The coherence audit: each paragraph’s claim, judged — does it support the thesis? Yes, No, or Weakly, with the reason.',
  flow: 'A Structural Logician walks the outline claim by claim, flagging weak, abrupt, or missing logical connections.',
  redundancy: 'A Manuscript Editor scans the outline for repeated claims and “monster” paragraphs carrying more than one main idea.',
  gaps: 'A Critical Logician stress-tests the outline with skeptical-reader questions, closing with the key gaps.',
  paragraph: 'Pick one paragraph; the Logician separates what it says from what it does, and checks the two align.',
};

/**
 * The instruments-mode result pane: routes the selected instrument to its
 * renderer (row tables / markdown report / the ¶ diagnostic), with run and
 * empty states.
 */
export function DoctorReading() {
  const instrument = useStore((s) => s.doctorInstrument);
  const status = useStore((s) => s.doctorStatus);
  const outlineRows = useStore((s) => s.doctorOutlineRows);
  const saysDoesRows = useStore((s) => s.doctorSaysDoesRows);
  const coherenceRows = useStore((s) => s.doctorCoherenceRows);
  const report = useStore((s) => s.doctorReport);

  if (instrument === 'paragraph') return <ParagraphDiagnostic />;

  const hasResult =
    instrument === 'claims'
      ? !!outlineRows
      : instrument === 'saysDoes'
        ? !!saysDoesRows
        : instrument === 'thesisCheck'
          ? !!coherenceRows
          : report?.instrument === instrument;

  if (status === 'running') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
        <Spinner />
        <div className="font-mono uppercase tracking-[0.14em] text-[9px] text-hld-cyan">
          Consulting the Logician…
        </div>
      </div>
    );
  }

  if (!hasResult) {
    return (
      <div className="flex-1 flex items-center justify-center px-8 text-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-hld-muted-text leading-[1.8] max-w-[460px]">
          {status === 'error' ? 'The reading failed — adjust and run again.' : BLURB[instrument]}
        </div>
      </div>
    );
  }

  if (instrument === 'flow' || instrument === 'redundancy' || instrument === 'gaps') {
    return <DoctorReport />;
  }
  return <OutlineTable instrument={instrument} />;
}
