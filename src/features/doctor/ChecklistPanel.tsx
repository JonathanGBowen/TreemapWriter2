import { toast } from 'sonner';
import { useStore } from '../../state';
import { relocateBlock } from '../../lib/paragraph-helpers';
import { sourceHashOf } from '../../lib/parallel-helpers';
import { useDoctorWizardActions } from './use-doctor-wizard-actions';

/**
 * The persisted revision checklist — the project's work ledger. Checkboxes flip
 * `done` (undo = re-flip; autosaved), ¶ chips jump the editor to the paragraph
 * by its stored verbatim anchor, and the header names staleness when the prose
 * has moved on since the wizard ran.
 */
export function ChecklistPanel() {
  const checklist = useStore((s) => s.doctorChecklist);
  const toggle = useStore((s) => s.toggleDoctorTask);
  const save = useStore((s) => s.saveCurrentState);
  const { downloadChecklistMd, sendToSprint } = useDoctorWizardActions();

  // Staleness against the checklist's own scope (not the picker's), resolved live.
  const stale = useStore((s) => {
    if (!s.doctorChecklist) return false;
    const live = s.localContent || s.markdown;
    const text =
      s.doctorChecklist.scopeKey === 'root'
        ? live
        : (function find(nodes: typeof s.sections): string | null {
            for (const n of nodes) {
              if (n.id === s.doctorChecklist?.scopeKey) return n.fullContent;
              const hit = find(n.children);
              if (hit != null) return hit;
            }
            return null;
          })(s.sections);
    return text != null && sourceHashOf(text) !== s.doctorChecklist.sourceHash;
  });

  if (!checklist) return null;

  const jumpTo = (anchor: string) => {
    const s = useStore.getState();
    const live = s.localContent || s.markdown;
    const located = relocateBlock(live, anchor);
    if (!located) {
      toast.error('That paragraph has changed too much to locate.');
      return;
    }
    if (checklist.scopeKey !== 'root') s.setSelectedId(checklist.scopeKey);
    s.setPendingEditorReveal({ offset: located.startOffset });
    s.closeDoctor();
  };

  const done = checklist.tasks.filter((t) => t.done).length;

  return (
    <div className="border border-hld-border flex flex-col">
      <div className="px-4 py-3 border-b border-hld-border flex items-center gap-3 flex-wrap">
        <div className="font-mono uppercase tracking-[0.14em] text-[10px] font-bold text-hld-text">
          Revision checklist
        </div>
        <span className="font-mono text-[9px] text-hld-muted-text">
          {done}/{checklist.tasks.length} · {checklist.roadmapTitle}
        </span>
        {stale && (
          <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-hld-yellow border border-hld-yellow/40 px-1.5 py-0.5">
            prose changed since this plan
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={downloadChecklistMd}
            className="px-2.5 py-1 border border-hld-border text-hld-muted-text hover:text-hld-cyan hover:border-hld-cyan/40 font-mono text-[9px] uppercase tracking-[0.12em] transition-all"
          >
            ↧ Download .md
          </button>
          <button
            type="button"
            onClick={sendToSprint}
            title="Open a Living Sprint whose plan is generated from this checklist"
            className="px-2.5 py-1 border border-hld-cyan/40 text-hld-cyan hover:bg-hld-cyan/10 font-mono text-[9px] uppercase tracking-[0.12em] transition-all"
          >
            » Send to Sprint
          </button>
        </div>
      </div>

      <div>
        {checklist.tasks.map((t, i) => (
          <div
            key={t.id}
            className="px-4 py-2.5 border-b border-hld-border/50 last:border-b-0 flex items-start gap-3"
          >
            <input
              type="checkbox"
              id={`doctor-${t.id}`}
              checked={t.done}
              onChange={() => {
                toggle(t.id);
                void save();
              }}
              className="mt-0.5 accent-[var(--color-hld-cyan)] cursor-pointer"
            />
            <label
              htmlFor={`doctor-${t.id}`}
              className={`font-sans text-[12px] leading-relaxed flex-1 cursor-pointer ${
                t.done ? 'text-hld-muted-text line-through decoration-hld-border' : 'text-slate-300'
              }`}
            >
              <span className="font-mono text-[9px] text-hld-muted-text mr-2">{i + 1}.</span>
              {t.text}
            </label>
            {t.paragraphNumbers.length > 0 && (
              <span className="flex gap-1 shrink-0">
                {t.paragraphNumbers.map((n, j) => (
                  <button
                    key={`${n}-${j}`}
                    type="button"
                    onClick={() => t.anchors[j] && jumpTo(t.anchors[j])}
                    title="Open in the editor at this paragraph"
                    className="font-mono text-[8px] px-1.5 py-0.5 border border-hld-border text-hld-muted-text hover:text-hld-cyan hover:border-hld-cyan/40 transition-all"
                  >
                    ¶{n}
                  </button>
                ))}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
