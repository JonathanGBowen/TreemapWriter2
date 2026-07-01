import React, { useEffect, useState } from 'react';
import { X, Network, Save, RotateCcw, Lock } from 'lucide-react';
import {
  DEFAULT_PROMPTS_CONFIG,
  resolvePromptsConfig,
  diffPromptsConfig,
  promptSource,
  PROMPT_REGISTRY,
  getPromptEntry,
} from '../../services/prompts';
import type { PromptCategory, PromptEntry, EditablePromptKey } from '../../services/prompts';
import type { PromptsConfig } from '../../types';
import { ConfirmModal } from './ConfirmModal';
import { useStore } from '../../store';

type Scope = 'project' | 'global';

// Column order + styling for the map. The *inventory* (which prompts, their
// labels/descriptions/grouping) lives in the registry; only presentation lives
// here. Tailwind v4 cannot see dynamically-built class names, so every accent is
// a literal string.
const CATEGORY_ORDER: PromptCategory[] = [
  'spec-generation',
  'segmentation',
  'diagnostics-coaching',
  'generation',
  'analysis-dialogue',
  'revision-engine',
  'sprints',
  'comparison',
  'climate',
];

const CATEGORY_PRESENTATION: Record<
  PromptCategory,
  { title: string; eyebrow: string; selected: string }
> = {
  'spec-generation': {
    title: 'Spec Generation',
    eyebrow: 'text-emerald-500/70 border-emerald-500/30',
    selected: 'bg-emerald-500/20 border-emerald-400 text-emerald-300',
  },
  segmentation: {
    title: 'Articulation',
    eyebrow: 'text-teal-500/70 border-teal-500/30',
    selected: 'bg-teal-500/20 border-teal-400 text-teal-300',
  },
  'diagnostics-coaching': {
    title: 'Diagnostics & Coaching',
    eyebrow: 'text-amber-500/70 border-amber-500/30',
    selected: 'bg-amber-500/20 border-amber-400 text-amber-300',
  },
  generation: {
    title: 'Generation',
    eyebrow: 'text-purple-500/70 border-purple-500/30',
    selected: 'bg-purple-500/20 border-purple-400 text-purple-300',
  },
  'analysis-dialogue': {
    title: 'Analysis & Dialogue',
    eyebrow: 'text-cyan-500/70 border-cyan-500/30',
    selected: 'bg-cyan-500/20 border-cyan-400 text-cyan-300',
  },
  'revision-engine': {
    title: 'Revision Engine',
    eyebrow: 'text-rose-500/70 border-rose-500/30',
    selected: 'bg-rose-500/20 border-rose-400 text-rose-300',
  },
  sprints: {
    title: 'Living Sprints',
    eyebrow: 'text-yellow-500/70 border-yellow-500/30',
    selected: 'bg-yellow-500/20 border-yellow-400 text-yellow-300',
  },
  comparison: {
    title: 'Version Compare',
    eyebrow: 'text-sky-500/70 border-sky-500/30',
    selected: 'bg-sky-500/20 border-sky-400 text-sky-300',
  },
  climate: {
    title: 'Climate Artist',
    eyebrow: 'text-teal-500/70 border-teal-500/30',
    selected: 'bg-teal-500/20 border-teal-400 text-teal-300',
  },
};

const TIER_BADGE: Record<'default' | 'global' | 'project', { label: string; className: string }> = {
  project: { label: 'Project', className: 'text-hld-cyan border-hld-cyan/40' },
  global: { label: 'Global', className: 'text-amber-300 border-amber-400/40' },
  default: { label: 'Default', className: 'text-slate-400 border-slate-600' },
};

export const PromptsGraphModal: React.FC = () => {
  const isOpen = useStore((s) => s.showPromptsGraphModal);
  const setShow = useStore((s) => s.setShowPromptsGraphModal);
  const globalPromptsConfig = useStore((s) => s.globalPromptsConfig);
  const projectPromptsOverride = useStore((s) => s.projectPromptsOverride);
  const setPromptsConfig = useStore((s) => s.setPromptsConfig);
  const setGlobalPromptsConfig = useStore((s) => s.setGlobalPromptsConfig);
  const saveCurrentState = useStore((s) => s.saveCurrentState);

  const [scope, setScope] = useState<Scope>('project');
  const [localValues, setLocalValues] = useState<PromptsConfig>(DEFAULT_PROMPTS_CONFIG);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, message: '', onConfirm: () => {} });

  // The editable baseline for a scope: 'project' shows the effective config
  // (default ◁ global ◁ project); 'global' shows default ◁ global (no project
  // tier), so editing + saving Global never bakes in project-specific values.
  const baseFor = (s: Scope): PromptsConfig =>
    s === 'project'
      ? resolvePromptsConfig(projectPromptsOverride, globalPromptsConfig)
      : resolvePromptsConfig(undefined, globalPromptsConfig);

  // Re-seed the working buffer when the modal opens or the scope changes.
  // (Intentionally keyed only on open/scope, not the override layers.)
  useEffect(() => {
    if (isOpen) setLocalValues(baseFor(scope));
  }, [isOpen, scope]);

  if (!isOpen) return null;

  const onClose = () => setShow(false);

  const handleSave = () => {
    if (scope === 'project') {
      setPromptsConfig(localValues);
      void saveCurrentState();
    } else {
      setGlobalPromptsConfig(diffPromptsConfig(localValues, DEFAULT_PROMPTS_CONFIG));
    }
    onClose();
  };

  const handleReset = () => {
    setConfirmState({
      isOpen: true,
      message:
        scope === 'project'
          ? "Reset this project's prompts to the inherited defaults? This clears the project's overrides (you still inherit any global defaults)."
          : 'Reset the global prompt defaults back to the built-in defaults?',
      onConfirm: () => {
        setLocalValues(
          scope === 'project' ? resolvePromptsConfig(undefined, globalPromptsConfig) : DEFAULT_PROMPTS_CONFIG,
        );
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const groups = CATEGORY_ORDER.map((cat) => ({
    cat,
    entries: PROMPT_REGISTRY.filter((e) => e.category === cat),
  })).filter((g) => g.entries.length > 0);

  const selectedEntry = selectedKey ? getPromptEntry(selectedKey) : null;
  const selectedLocked = selectedEntry?.editability === 'locked';

  const Node = ({ entry }: { entry: PromptEntry }) => {
    const isSelected = selectedKey === entry.key;
    const locked = entry.editability === 'locked';
    const selectedClass = CATEGORY_PRESENTATION[entry.category].selected;
    return (
      <button
        onClick={() => setSelectedKey(entry.key)}
        className={`relative cursor-pointer transition-all duration-200 p-3 flex items-center justify-center gap-1.5 border-2 font-mono text-[10px] uppercase tracking-widest w-full text-center ${
          isSelected ? selectedClass : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'
        }`}
      >
        {locked && <Lock size={10} className="opacity-70 shrink-0" />}
        <span className={isSelected ? 'font-bold' : ''}>{entry.label}</span>
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex bg-black/90 backdrop-blur-sm shadow-2xl p-6 font-sans">
      <div className="flex w-full h-full border-2 border-hld-border bg-hld-bg relative overflow-hidden">
        {/* Graph Area */}
        <div className="flex-1 relative flex flex-col p-8 overflow-y-auto bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-hld-surface-3 to-black">
          {/* Background grid */}
          <div
            className="absolute inset-0 z-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage:
                'linear-gradient(var(--color-hld-cyan) 1px, transparent 1px), linear-gradient(90deg, var(--color-hld-cyan) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />

          <div className="z-10 flex items-center gap-3 mb-8">
            <Network className="text-hld-cyan" size={24} />
            <h2 className="text-xl font-bold text-slate-100 font-mono tracking-widest uppercase text-shadow-hld">
              Prompt Map
            </h2>
          </div>

          {/* Input banner */}
          <div className="z-10 w-full max-w-3xl mx-auto py-4 mb-8 border-2 border-slate-700 flex items-center justify-center bg-slate-900 text-slate-400 font-mono text-sm tracking-widest shadow-[0_0_20px_rgba(0,0,0,0.5)]">
            YOUR DOCUMENT
          </div>

          {/* Category columns (registry-driven) */}
          <div className="z-10 flex flex-wrap gap-6 justify-center items-start">
            {groups.map(({ cat, entries }) => {
              const pres = CATEGORY_PRESENTATION[cat];
              return (
                <div key={cat} className="flex flex-col gap-4 w-44">
                  <div
                    className={`text-center font-mono text-[10px] uppercase tracking-widest pb-2 border-b ${pres.eyebrow}`}
                  >
                    {pres.title}
                  </div>
                  {entries.map((entry) => (
                    <Node key={entry.key} entry={entry} />
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* Editor Sidebar */}
        <div className="w-[480px] bg-slate-900 border-l border-hld-border flex flex-col z-20 shadow-[-10px_0_30px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between p-4 border-b border-hld-border bg-slate-800">
            <h3 className="text-hld-text font-mono text-[12px] uppercase tracking-widest">Prompt Editor</h3>
            <div className="flex items-center gap-2">
              <button onClick={handleReset} className="text-hld-muted hover:text-amber-400" title="Reset to Defaults">
                <RotateCcw size={16} />
              </button>
              <button onClick={handleSave} className="text-hld-cyan hover:text-white" title="Save Configuration">
                <Save size={16} />
              </button>
              <button onClick={onClose} className="text-hld-muted hover:text-hld-magenta ml-2">
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Scope toggle — which tier the edits + Save target */}
          <div className="p-4 border-b border-hld-border bg-slate-800/50">
            <div className="text-[9px] font-mono uppercase tracking-widest text-hld-muted mb-2">Editing scope</div>
            <div className="flex bg-hld-surface-3 p-1 rounded border border-hld-border">
              {(['project', 'global'] as Scope[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setScope(s)}
                  className={`flex-1 py-1.5 rounded text-[10px] font-mono uppercase tracking-widest transition-colors ${
                    scope === s ? 'bg-hld-cyan/20 text-hld-cyan font-bold border border-hld-cyan/40' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {s === 'project' ? 'This project' : 'Global defaults'}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-hld-muted mt-2 font-sans leading-relaxed">
              {scope === 'project'
                ? 'Edits apply to the current project only (overrides the global default).'
                : 'Edits become your default across all projects (a project can still override).'}
            </p>
          </div>

          <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto">
            {!selectedEntry ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 font-mono text-[12px] uppercase tracking-widest text-center">
                <Network className="w-12 h-12 mb-4 opacity-50 text-slate-600" />
                Select a node from the map <br />
                to edit its prompt.
              </div>
            ) : (
              <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center justify-between mb-2 gap-2">
                  <h4 className="text-slate-100 font-mono text-sm tracking-widest uppercase">{selectedEntry.label}</h4>
                  {selectedLocked ? (
                    <span className="text-[10px] px-2 py-1 bg-black text-slate-400 font-mono border border-slate-600 rounded flex items-center gap-1">
                      <Lock size={10} /> LOCKED
                    </span>
                  ) : (
                    (() => {
                      const tier = promptSource(
                        selectedEntry.key as EditablePromptKey,
                        scope === 'project' ? projectPromptsOverride : undefined,
                        globalPromptsConfig,
                      );
                      const badge = TIER_BADGE[tier];
                      return (
                        <span
                          className={`text-[10px] px-2 py-1 bg-black font-mono border rounded ${badge.className}`}
                          title="Where this prompt's current value comes from"
                        >
                          {badge.label}
                        </span>
                      );
                    })()
                  )}
                </div>
                <div className="text-[11px] text-slate-400 mb-4 font-sans leading-relaxed">
                  {selectedEntry.description}
                </div>
                {selectedLocked ? (
                  <>
                    <div className="text-[10px] text-slate-500 mb-2 font-mono uppercase tracking-widest">
                      Engine internal — read only
                    </div>
                    <textarea
                      value={selectedEntry.defaultText}
                      readOnly
                      className="flex-1 w-full bg-hld-bg text-slate-400 font-mono text-[13px] p-4 border border-hld-border resize-none rounded-sm leading-relaxed shadow-inner cursor-not-allowed"
                      spellCheck={false}
                    />
                  </>
                ) : (
                  <textarea
                    value={localValues[selectedEntry.key as EditablePromptKey]}
                    onChange={(e) =>
                      setLocalValues((prev) => ({ ...prev, [selectedEntry.key]: e.target.value }))
                    }
                    className="flex-1 w-full bg-hld-bg text-hld-cyan font-mono text-[13px] p-4 border border-hld-border focus:border-hld-cyan focus:outline-none focus:ring-1 focus:ring-hld-cyan focus:shadow-[0_0_15px_rgba(0,232,245,0.2)] resize-none rounded-sm selection:bg-hld-cyan selection:text-black leading-relaxed shadow-inner"
                    spellCheck={false}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <ConfirmModal
        isOpen={confirmState.isOpen}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
