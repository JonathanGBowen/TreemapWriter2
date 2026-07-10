import ReactMarkdown from 'react-markdown';
import { useStore } from '../../state';
import { CopyButton } from '../shared/CopyButton';
import type { DoctorReportInstrument } from '../../types';

const TITLE: Record<DoctorReportInstrument, string> = {
  flow: 'Logical Flow & Transitions',
  redundancy: 'Redundancy & Monster Paragraphs',
  gaps: 'Argumentative Gaps (Self-Ask)',
};

/** The essayistic outline-diagnostic reports, rendered as markdown. */
export function DoctorReport() {
  const report = useStore((s) => s.doctorReport);
  if (!report) return null;

  return (
    <>
      <div className="relative px-4 py-3 border-b border-hld-border shrink-0 flex items-center justify-between gap-3">
        <div className="absolute top-0 left-0 right-0 h-px bg-hld-cyan shadow-[0_0_12px_var(--color-hld-cyan)]" />
        <div className="font-mono uppercase tracking-[0.14em] text-[10px] font-bold text-hld-text">
          {TITLE[report.instrument]}
        </div>
        <CopyButton text={report.markdown} label="Copy report" />
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[760px] px-6 py-6">
          <div className="markdown-body font-sans text-sm text-slate-300 leading-relaxed">
            <ReactMarkdown>{report.markdown}</ReactMarkdown>
          </div>
        </div>
      </div>
    </>
  );
}
