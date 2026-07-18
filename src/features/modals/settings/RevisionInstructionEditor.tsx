import { Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useStore } from '../../../state';
import {
  DEFAULT_INSTRUCTION_ID,
  DEFAULT_INSTRUCTIONS,
  resolveInstructionLibrary,
} from '../../../lib/defaultInstructions';

const isBuiltIn = (id: string) => DEFAULT_INSTRUCTIONS.some((d) => d.id === id);
const inputCls =
  'w-full bg-hld-bg border border-hld-border focus:border-hld-cyan outline-none text-hld-text font-mono text-[12px] px-2.5 py-2';

/**
 * Manage the reusable revision Instruction library — the grounding stance for a
 * SOURCELESS pass. A row of selectable chips (the active one lit) + an editor for
 * the active instruction's label/body. Built-ins can be edited (which creates a
 * shadowing custom copy) and reset; custom entries can be deleted. Auto-saves —
 * no confirm (the ADHD rule: undoable, not confirmable).
 */
export function RevisionInstructionEditor() {
  const custom = useStore((s) => s.revisionInstructions);
  const activeId = useStore((s) => s.activeRevisionInstructionId);
  const setCustom = useStore((s) => s.setRevisionInstructions);
  const setActiveId = useStore((s) => s.setActiveRevisionInstructionId);

  const library = resolveInstructionLibrary(custom);
  const active = library.find((i) => i.id === activeId) ?? library[0];
  const overridden = custom.some((i) => i.id === active.id);

  // Patch the active instruction. Editing a pristine built-in shadows it with a
  // custom copy of the same id (so "reset" can later restore the built-in).
  const patchActive = (patch: Partial<{ label: string; body: string }>) =>
    setCustom((prev) =>
      prev.some((i) => i.id === active.id)
        ? prev.map((i) => (i.id === active.id ? { ...i, ...patch } : i))
        : [...prev, { ...active, ...patch }],
    );

  const addNew = () => {
    const id = `instr_${Date.now()}`;
    setCustom((prev) => [...prev, { id, label: 'New instruction', body: '' }]);
    setActiveId(id);
  };

  // Remove a custom entry. If it shadowed a built-in, the built-in re-appears and
  // stays selected; a purely-custom removal falls back to the default.
  const remove = (id: string) => {
    setCustom((prev) => prev.filter((i) => i.id !== id));
    if (activeId === id && !isBuiltIn(id)) setActiveId(DEFAULT_INSTRUCTION_ID);
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-1.5">
        {library.map((i) => {
          const on = i.id === active.id;
          return (
            <button
              key={i.id}
              type="button"
              onClick={() => setActiveId(i.id)}
              className={`px-2 py-1.5 border font-mono text-[9.5px] tracking-[0.04em] transition-all ${
                on
                  ? 'border-hld-cyan/55 bg-hld-cyan/10 text-hld-cyan shadow-[0_0_10px_rgba(0,232,245,0.12)]'
                  : 'border-hld-border text-hld-muted-text hover:text-hld-text'
              }`}
            >
              {i.label || 'Untitled'}
            </button>
          );
        })}
        <button
          type="button"
          onClick={addNew}
          className="flex items-center gap-1 px-2 py-1.5 border border-dashed border-hld-border text-hld-muted-text hover:text-hld-cyan hover:border-hld-cyan/40 font-mono text-[9.5px] uppercase tracking-[0.08em] transition-colors"
        >
          <Plus size={10} /> New
        </button>
      </div>

      <input
        value={active.label}
        onChange={(e) => patchActive({ label: e.target.value })}
        placeholder="Instruction name"
        className={inputCls}
      />
      <textarea
        value={active.body}
        onChange={(e) => patchActive({ body: e.target.value })}
        rows={3}
        placeholder="How should a sourceless pass ground its proposals?"
        className={`${inputCls} resize-none leading-[1.5]`}
      />

      <div className="flex items-center justify-between">
        <span className="font-mono text-[8.5px] text-hld-muted uppercase tracking-[0.08em]">
          {isBuiltIn(active.id) ? (overridden ? 'built-in · edited' : 'built-in default') : 'custom'}
        </span>
        {isBuiltIn(active.id) ? (
          overridden && (
            <button
              type="button"
              onClick={() => remove(active.id)}
              className="flex items-center gap-1 font-mono text-[8.5px] uppercase tracking-[0.1em] text-hld-muted-text hover:text-hld-cyan"
            >
              <RotateCcw size={11} /> Reset to default
            </button>
          )
        ) : (
          <button
            type="button"
            onClick={() => remove(active.id)}
            className="flex items-center gap-1 font-mono text-[8.5px] uppercase tracking-[0.1em] text-hld-muted-text hover:text-hld-yellow"
          >
            <Trash2 size={11} /> Delete
          </button>
        )}
      </div>
    </div>
  );
}
