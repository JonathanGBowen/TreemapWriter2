import React, { useState } from "react";
import { ChevronDown, Link as LinkIcon, X } from "lucide-react";
import { Dependency, TestSuite } from "../../types";

/**
 * The dependencies editor, moved verbatim out of the original TestsPanel
 * when the panel became tabbed (used by SpecTab).
 */
export const SpecDependencies: React.FC<{
  sectionId: string;
  dependencies: Dependency[];
  flatSections: { id: string; title: string; level: number }[];
  testSuite: TestSuite;
  onUpdate: (deps: Dependency[]) => void;
}> = ({ sectionId, dependencies, flatSections, testSuite, onUpdate }) => {
  const [dependencyType, setDependencyType] = useState<'prerequisite' | 'reference'>('prerequisite');

  const handleAdd = (depId: string) => {
    onUpdate([...dependencies, { id: depId, type: dependencyType }]);
  };

  const handleRemove = (depId: string) => {
    onUpdate(dependencies.filter(d => d.id !== depId));
  };

  return (
    <div className="space-y-2 pt-3 border-t border-[#1e2f42]">
      <label className="text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-hld-muted flex items-center gap-2">
        <LinkIcon size={12} /> Dependencies
      </label>
      <div className="space-y-1">
        {dependencies.map(dep => {
          const depSection = flatSections.find(s => s.id === dep.id);
          const depStatus = testSuite[dep.id]?.status || 'idle';
          const isMet = depStatus === 'success';
          return (
            <div key={dep.id} className={`flex items-center justify-between p-[6px] border transition-colors ${
              isMet
                ? 'bg-[rgba(0,245,150,0.05)] border-[rgba(0,245,150,0.2)]'
                : 'bg-hld-surface2 border-hld-border'
            }`}>
              <div className="flex items-center gap-[6px] min-w-0 flex-1">
                <div className={`w-[4px] h-[4px] shrink-0 rotate-45 ${isMet ? 'bg-hld-green shadow-[0_0_6px_var(--tw-colors-hld-green)]' : 'bg-hld-muted'}`} />
                <div className="flex flex-col min-w-0 gap-[1px]">
                  <span className={`truncate text-[10px] font-sans font-bold ${isMet ? 'text-hld-green' : 'text-hld-text'}`}>
                    {depSection ? depSection.title : 'Unknown'}
                  </span>
                  <span className="text-[7px] text-hld-muted uppercase tracking-[0.14em] font-mono">
                    {dep.type}
                  </span>
                </div>
              </div>
              <button onClick={() => handleRemove(dep.id)} className="text-hld-muted hover:text-hld-magenta transition-colors ml-2">
                <X size={12} />
              </button>
            </div>
          );
        })}
        {dependencies.length === 0 && (
          <div className="text-[10px] text-hld-muted italic px-[6px] py-1 font-sans">No dependencies.</div>
        )}
      </div>
      <div className="flex gap-2 items-center mt-2">
        <select
          className="w-1/3 pl-2 pr-6 py-1.5 text-[8px] font-mono uppercase tracking-[0.14em] bg-hld-surface2 border border-hld-border rounded-none text-hld-text outline-none focus:border-hld-cyan appearance-none cursor-pointer"
          value={dependencyType}
          onChange={(e) => setDependencyType(e.target.value as 'prerequisite' | 'reference')}
        >
          <option value="prerequisite">Prerequisite</option>
          <option value="reference">Reference</option>
        </select>
        <div className="relative flex-1">
          <select
            className="w-full pl-2 pr-8 py-1.5 text-[8px] font-mono uppercase tracking-[0.14em] bg-hld-surface2 border border-hld-border rounded-none text-hld-text outline-none focus:border-hld-cyan appearance-none cursor-pointer"
            onChange={(e) => { if (e.target.value) { handleAdd(e.target.value); e.target.value = ""; } }}
            value=""
          >
            <option value="" disabled>+ Add...</option>
            {flatSections
              .filter(s => s.id !== sectionId && !dependencies.some(d => d.id === s.id))
              .map(s => (
                <option key={s.id} value={s.id}>
                  {'\u00A0'.repeat((s.level - 1) * 2)} {s.title}
                </option>
              ))}
          </select>
          <div className="absolute right-[6px] top-1/2 -translate-y-1/2 pointer-events-none text-hld-muted">
            <ChevronDown size={10} />
          </div>
        </div>
      </div>
    </div>
  );
};
