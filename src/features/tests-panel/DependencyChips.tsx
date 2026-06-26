import { useState } from "react";
import { X } from "lucide-react";
import type { Dependency, TestSuite } from "../../types";
import { Pip } from "../shared/Pip";
import { Disclosure } from "../shared/Disclosure";

type FlatSection = { id: string; title: string; level: number };

/** Dependencies as a collapsed disclosure → met/unmet chips + one "+ Add" popover.
 *  Replaces the two always-open <select>s of the old SpecDependencies. */
export function DependencyChips({
  sectionId, dependencies, flatSections, testSuite, onUpdate,
}: {
  sectionId: string;
  dependencies: Dependency[];
  flatSections: FlatSection[];
  testSuite: TestSuite;
  onUpdate: (deps: Dependency[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [depType, setDepType] = useState<'prerequisite' | 'reference'>('prerequisite');

  const met = dependencies.filter((d) => testSuite[d.id]?.status === 'success').length;
  const add = (id: string) => { onUpdate([...dependencies, { id, type: depType }]); setAdding(false); };
  const remove = (id: string) => onUpdate(dependencies.filter((d) => d.id !== id));
  const candidates = flatSections.filter((s) => s.id !== sectionId && !dependencies.some((d) => d.id === s.id));

  return (
    <Disclosure label="Dependencies" count={`${met} met / ${dependencies.length}`}>
      <div className="flex flex-wrap gap-[5px]">
        {dependencies.map((dep) => {
          const sec = flatSections.find((s) => s.id === dep.id);
          const isMet = testSuite[dep.id]?.status === 'success';
          return (
            <span key={dep.id} className={`inline-flex items-center gap-[6px] px-[8px] py-[4px] border text-[9px] ${isMet ? 'border-hld-green/25 text-hld-green' : 'border-hld-border text-hld-muted-text'}`}>
              <Pip status={isMet ? 'green' : 'idle'} size="sm" />
              <span className="truncate max-w-[140px]">{sec?.title ?? 'Unknown'}</span>
              <button type="button" onClick={() => remove(dep.id)} aria-label="Remove dependency" className="text-hld-muted hover:text-hld-magenta transition-colors">
                <X size={9} />
              </button>
            </span>
          );
        })}
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className="px-[9px] py-[4px] border border-hld-border text-hld-muted-text hover:text-hld-cyan hover:border-hld-cyan/40 font-mono text-[9px] tracking-[0.1em] uppercase transition-colors">
            + Add
          </button>
        )}
      </div>

      {adding && (
        <div className="mt-[8px] border border-hld-cyan/25 bg-hld-surface-2 p-[8px] flex flex-col gap-[8px]">
          <div className="flex gap-[6px]">
            {(['prerequisite', 'reference'] as const).map((t) => (
              <button key={t} type="button" onClick={() => setDepType(t)} className={`flex-1 py-[5px] font-mono text-[8px] tracking-[0.12em] uppercase border transition-colors ${depType === t ? 'border-hld-cyan text-hld-cyan bg-hld-cyan/5' : 'border-hld-border text-hld-muted-text'}`}>
                {t}
              </button>
            ))}
          </div>
          <select
            value=""
            onChange={(e) => { if (e.target.value) add(e.target.value); }}
            aria-label="Add a dependency section"
            className="w-full px-[8px] py-[6px] text-[9px] font-mono uppercase tracking-[0.1em] bg-hld-surface border border-hld-border text-hld-text outline-none focus:border-hld-cyan cursor-pointer"
          >
            <option value="" disabled>Select a section…</option>
            {candidates.map((s) => (
              <option key={s.id} value={s.id} className="bg-hld-surface text-hld-text">
                {' '.repeat((s.level - 1) * 2)}{s.title}
              </option>
            ))}
          </select>
        </div>
      )}
    </Disclosure>
  );
}
