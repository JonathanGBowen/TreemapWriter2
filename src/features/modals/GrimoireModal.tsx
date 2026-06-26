import React, { useState, useRef } from "react";
import { BookOpen, Plus, Trash2, Check, X, Wand2, Copy, Pencil, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import type { AnalysisSpell } from "../../types";
import { useStore } from "../../state";
import { DEFAULT_SPELLS } from "../../lib/defaultSpells";

/**
 * The Grimoire: a library of analytical lenses ("spells"). Built-ins ship in
 * code (read-only, but duplicable); custom spells form a global library shared
 * across projects. Selecting a spell sets the active lens for the next Analysis
 * run; "Plain reconstruction" clears it. Mirrors the chrome of PersonaSettingsModal.
 */
export const GrimoireModal: React.FC = () => {
  const isOpen = useStore((s) => s.showGrimoireModal);
  const setShow = useStore((s) => s.setShowGrimoireModal);
  const customSpells = useStore((s) => s.customSpells);
  const setCustomSpells = useStore((s) => s.setCustomSpells);
  const activeSpellId = useStore((s) => s.activeSpellId);
  const setActiveSpellId = useStore((s) => s.setActiveSpellId);

  const onClose = () => setShow(false);
  const [view, setView] = useState<"list" | "edit">("list");
  /** The custom spell being edited; null while creating a brand-new spell. */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [persona, setPersona] = useState("");
  const [lens, setLens] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const startCreate = () => {
    setEditingId(null);
    setName("");
    setPersona("");
    setLens("");
    setView("edit");
  };

  const startEdit = (spell: AnalysisSpell) => {
    setEditingId(spell.id);
    setName(spell.name);
    setPersona(spell.persona);
    setLens(spell.lens);
    setView("edit");
  };

  // Duplicate any spell (built-in or custom) into a fresh, editable draft.
  const startDuplicate = (spell: AnalysisSpell) => {
    setEditingId(null);
    setName(`${spell.name} (copy)`);
    setPersona(spell.persona);
    setLens(spell.lens);
    setView("edit");
  };

  const handleSave = () => {
    if (!name.trim() || !persona.trim() || !lens.trim()) return;
    if (editingId) {
      setCustomSpells((prev) =>
        prev.map((s) => (s.id === editingId ? { ...s, name, persona, lens } : s)),
      );
    } else {
      const id = `custom-${Date.now()}`;
      setCustomSpells((prev) => [...prev, { id, name, persona, lens }]);
      setActiveSpellId(id);
    }
    setView("list");
  };

  const handleDelete = (id: string) => {
    setCustomSpells((prev) => prev.filter((s) => s.id !== id));
    if (activeSpellId === id) setActiveSpellId(null);
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(customSpells, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "spells.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (!Array.isArray(imported)) throw new Error("not an array");
        const added: AnalysisSpell[] = [];
        imported.forEach((raw: Record<string, unknown>) => {
          const sName = typeof raw.name === "string" ? raw.name : "";
          const sPersona = typeof raw.persona === "string" ? raw.persona : "";
          // Tolerant of Scribe's Gambit's shape: `instructions` maps to `lens`.
          const sLens =
            typeof raw.lens === "string"
              ? raw.lens
              : typeof raw.instructions === "string"
                ? raw.instructions
                : "";
          if (sName && sPersona && sLens) {
            added.push({ id: `custom-${Date.now()}-${added.length}`, name: sName, persona: sPersona, lens: sLens });
          }
        });
        if (added.length === 0) {
          toast.error("No valid spells found in that file.");
          return;
        }
        setCustomSpells((prev) => [...prev, ...added]);
        toast.success(`Imported ${added.length} spell${added.length === 1 ? "" : "s"}.`);
      } catch {
        toast.error("Failed to parse spells file.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const SpellCard = ({ spell, builtIn }: { spell: AnalysisSpell; builtIn: boolean }) => {
    const isActive = spell.id === activeSpellId;
    return (
      <div
        onClick={() => setActiveSpellId(spell.id)}
        className={`group relative p-4 rounded-lg border cursor-pointer transition-all ${
          isActive
            ? "border-hld-cyan bg-hld-cyan/10 ring-1 ring-hld-cyan"
            : "border-hld-border hover:border-hld-cyan/50 bg-hld-surface"
        }`}
      >
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${isActive ? "bg-hld-cyan/20 text-hld-cyan" : "bg-hld-surface-2 text-hld-muted"}`}>
              <Wand2 size={18} />
            </div>
            <div>
              <div className="font-bold text-hld-text text-sm font-sans">{spell.name}</div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-hld-muted font-medium">
                {builtIn ? "Built-in lens" : "Custom lens"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isActive && <Check size={18} className="text-hld-cyan shrink-0" />}
            <button
              onClick={(e) => { e.stopPropagation(); startDuplicate(spell); }}
              title="Duplicate to a custom lens"
              className="text-hld-muted hover:text-hld-cyan opacity-0 group-hover:opacity-100 transition-opacity p-1"
            >
              <Copy size={15} />
            </button>
            {!builtIn && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); startEdit(spell); }}
                  title="Edit"
                  className="text-hld-muted hover:text-hld-cyan opacity-0 group-hover:opacity-100 transition-opacity p-1"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(spell.id); }}
                  title="Delete"
                  className="text-hld-muted hover:text-hld-magenta opacity-0 group-hover:opacity-100 transition-opacity p-1"
                >
                  <Trash2 size={15} />
                </button>
              </>
            )}
          </div>
        </div>
        <div className="mt-3 text-xs text-hld-muted bg-hld-bg p-2 rounded font-mono border border-hld-border italic line-clamp-1">
          {spell.persona}
        </div>
        <div className="mt-1.5 text-xs text-hld-muted bg-hld-bg p-2 rounded font-sans border border-hld-border line-clamp-2">
          {spell.lens}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4">
      <div className="bg-hld-surface rounded-xl shadow-2xl w-full max-w-2xl border border-hld-border flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="p-6 border-b border-hld-border flex justify-between items-center bg-hld-surface-2 rounded-t-xl">
          <div>
            <h3 className="text-xl font-bold text-hld-text flex items-center gap-2 font-sans">
              <BookOpen size={20} className="text-hld-cyan" />
              Grimoire of Analysis
            </h3>
            <p className="text-sm text-hld-muted font-sans">Analytical lenses applied to the structural read.</p>
          </div>
          <button onClick={onClose} className="text-hld-muted hover:text-hld-text p-2 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {view === "list" ? (
            <div className="grid gap-3">
              {/* Plain reconstruction — no lens */}
              <div
                onClick={() => setActiveSpellId(null)}
                className={`group relative p-4 rounded-lg border cursor-pointer transition-all ${
                  activeSpellId === null
                    ? "border-hld-cyan bg-hld-cyan/10 ring-1 ring-hld-cyan"
                    : "border-hld-border hover:border-hld-cyan/50 bg-hld-surface"
                }`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-bold text-hld-text text-sm font-sans">Plain reconstruction</div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-hld-muted font-medium">No lens — the base exegetical read</div>
                  </div>
                  {activeSpellId === null && <Check size={18} className="text-hld-cyan" />}
                </div>
              </div>

              {DEFAULT_SPELLS.map((spell) => <SpellCard key={spell.id} spell={spell} builtIn />)}
              {customSpells.map((spell) => <SpellCard key={spell.id} spell={spell} builtIn={false} />)}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-hld-muted mb-1">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2 border border-hld-border rounded bg-transparent text-hld-text focus:border-hld-cyan focus:ring-1 focus:ring-hld-cyan outline-none font-sans"
                  placeholder="e.g. Phenomenological Lens"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-hld-muted mb-1">Persona</label>
                <textarea
                  value={persona}
                  onChange={(e) => setPersona(e.target.value)}
                  className="w-full p-2 border border-hld-border rounded bg-transparent text-hld-text h-20 focus:border-hld-cyan focus:ring-1 focus:ring-hld-cyan outline-none font-sans text-sm"
                  placeholder="The role the model adopts, e.g. A phenomenologist attending to lived experience."
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-hld-muted mb-1">Lens</label>
                <textarea
                  value={lens}
                  onChange={(e) => setLens(e.target.value)}
                  className="w-full p-2 border border-hld-border rounded bg-transparent text-hld-text h-40 focus:border-hld-cyan focus:ring-1 focus:ring-hld-cyan outline-none font-mono text-sm"
                  placeholder="The analytical focus layered onto the base read. Reference the schema fields (keyConcepts, argument, supportingArguments, potentialObjections) to steer the output."
                />
              </div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-hld-muted/70 leading-relaxed">
                The lens is layered on top of the base reconstruction prompt — describe the reading stance, not the JSON schema.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-hld-border bg-hld-surface-2 rounded-b-xl flex justify-between">
          {view === "list" ? (
            <div className="flex items-center gap-4">
              <button
                onClick={startCreate}
                className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest font-semibold text-hld-cyan hover:text-hld-cyan/80 transition-colors"
              >
                <Plus size={16} /> Inscribe Spell
              </button>
              <div className="h-4 w-px bg-hld-border" />
              <button
                onClick={handleExport}
                className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest font-semibold text-hld-muted hover:text-hld-text transition-colors"
              >
                <Download size={16} /> Export
              </button>
              <label className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest font-semibold text-hld-muted hover:text-hld-text cursor-pointer transition-colors">
                <Upload size={16} /> Import
                <input type="file" accept=".json" className="hidden" ref={fileInputRef} onChange={handleImport} />
              </label>
            </div>
          ) : (
            <button
              onClick={() => setView("list")}
              className="text-[10px] font-mono uppercase tracking-widest font-semibold text-hld-muted hover:text-hld-text transition-colors"
            >
              Back to list
            </button>
          )}

          <div className="flex gap-2">
            {view === "edit" && (
              <button
                onClick={handleSave}
                disabled={!name.trim() || !persona.trim() || !lens.trim()}
                className="px-4 py-2 bg-hld-cyan text-hld-bg rounded-md text-[10px] font-mono uppercase tracking-widest font-bold shadow hover:bg-hld-cyan/80 disabled:opacity-40 transition-colors hld-glow-cyan"
              >
                {editingId ? "Save Changes" : "Save Spell"}
              </button>
            )}
            {view === "list" && (
              <button onClick={onClose} className="px-4 py-2 bg-hld-surface border border-hld-border rounded-md text-[10px] font-mono uppercase tracking-widest font-bold shadow-sm hover:bg-hld-border text-hld-text transition-colors">
                Done
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
