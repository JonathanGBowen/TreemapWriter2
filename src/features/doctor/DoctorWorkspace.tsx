import { useEffect } from 'react';
import { useStore } from '../../state';
import { DoctorTopBar } from './DoctorTopBar';
import { ThesisBar } from './ThesisBar';
import { InstrumentRail } from './InstrumentRail';
import { DoctorReading } from './DoctorReading';
import { DoctorWizard } from './DoctorWizard';

/**
 * The Reverse Outline Doctor workspace — the ported Prosthetic Logician as a
 * full-screen mode (like Climate / Parallel / Gist). Two halves behind one door:
 * `instruments` (one-shot clinical readings — reverse outlines, thesis check,
 * outline reports, the ¶ diagnostic) and `wizard` (the five-step revision
 * sequence ending in the persisted checklist). Self-gates on `doctorOpen`, so
 * ModalLayer mounts it unconditionally.
 */
export function DoctorWorkspace() {
  const open = useStore((s) => s.doctorOpen);
  const close = useStore((s) => s.closeDoctor);
  const mode = useStore((s) => s.doctorMode);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-hld-bg text-hld-text overflow-hidden font-sans">
      <DoctorTopBar />
      <ThesisBar />
      {mode === 'instruments' ? (
        <div className="flex-1 flex min-h-0">
          <InstrumentRail />
          <div className="flex-1 min-w-0 flex flex-col bg-hld-surface-3">
            <DoctorReading />
          </div>
        </div>
      ) : (
        <DoctorWizard />
      )}
    </div>
  );
}
