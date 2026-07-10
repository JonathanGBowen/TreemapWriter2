import { useState } from 'react';
import { toast } from 'sonner';
import { useStore } from '../../state';
import { useDoctorActions } from './use-doctor-actions';
import { ThesisDistiller } from './ThesisDistiller';

const SOURCE_LABEL = {
  document: 'document claim',
  distilled: 'distilled',
  typed: 'typed',
} as const;

/**
 * The working thesis every Doctor reading is made against: inline-editable,
 * with its provenance named, a Distill door (the Mirror/Pivot/Risk picker
 * renders below when options exist), and the one explicit crossing into the
 * exegetical layer — "adopt as document claim" (undo = re-adopt the old text;
 * no confirm, per the house rule).
 */
export function ThesisBar() {
  const thesis = useStore((s) => s.doctorThesis);
  const source = useStore((s) => s.doctorThesisSource);
  const setThesis = useStore((s) => s.setDoctorThesis);
  const options = useStore((s) => s.doctorThesisOptions);
  const status = useStore((s) => s.doctorStatus);
  const adoptDocumentClaim = useStore((s) => s.adoptDocumentClaim);
  const saveCurrentState = useStore((s) => s.saveCurrentState);
  const rootClaim = useStore(
    (s) => (s.testSuite['root']?.spec?.mainClaim ?? s.testSuite['root']?.mainClaim ?? '').trim(),
  );
  const { runDistiller } = useDoctorActions();
  const [draft, setDraft] = useState<string | null>(null);

  const busy = status === 'running' || status === 'streaming';
  const differsFromDoc = thesis.trim() && thesis.trim() !== rootClaim;

  return (
    <div className="shrink-0 border-b border-hld-border bg-hld-surface/60 px-[18px] py-2">
      <div className="flex items-center gap-3">
        <span className="font-mono uppercase tracking-[0.14em] text-[9px] text-hld-muted-text shrink-0">
          Thesis{source ? ` · ${SOURCE_LABEL[source]}` : ''}
        </span>
        <input
          type="text"
          value={draft ?? thesis}
          placeholder="The central argument of my paper is…"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (draft != null && draft !== thesis) setThesis(draft, 'typed');
            setDraft(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          className="flex-1 min-w-0 font-sans text-[12px] px-2 py-1 rounded border border-hld-border bg-hld-surface text-hld-text outline-none focus:border-hld-cyan/60"
        />
        <button
          type="button"
          onClick={runDistiller}
          disabled={busy}
          className="px-2.5 py-1 border border-hld-border text-hld-muted-text hover:text-hld-cyan hover:border-hld-cyan/40 font-mono text-[9px] uppercase tracking-[0.12em] transition-all disabled:opacity-50 shrink-0"
          title="Distill three candidate theses from the draft (Mirror / Pivot / Risk)"
        >
          ⚗ Distill
        </button>
        {differsFromDoc && (
          <button
            type="button"
            onClick={() => {
              adoptDocumentClaim(thesis.trim());
              void saveCurrentState();
              toast.success('Adopted as the document claim.');
            }}
            disabled={busy}
            className="px-2.5 py-1 border border-hld-cyan/40 text-hld-cyan hover:bg-hld-cyan/10 font-mono text-[9px] uppercase tracking-[0.12em] transition-all disabled:opacity-50 shrink-0"
            title="Write this thesis into the root spec's main claim"
          >
            Adopt as document claim
          </button>
        )}
      </div>
      {options && options.length > 0 && (
        <div className="mt-2">
          <ThesisDistiller />
        </div>
      )}
    </div>
  );
}
