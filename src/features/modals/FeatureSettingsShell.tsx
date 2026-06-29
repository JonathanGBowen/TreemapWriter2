import type { ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { useStore } from '../../state';
import { DEFAULT_PROMPTS_CONFIG } from '../../services/prompts';
import type { PromptsConfig } from '../../types';
import type { AICallKind, ModelChoice } from '../../services/ai/model-types';
import { ModelPicker } from './ModelPicker';

/**
 * Shared pieces for the per-feature settings modals (Revision · Gist · Parallel).
 * These three were byte-identical apart from their accent and their kind/prompt
 * lists; the common surface lives here so a tweak lands once. Each modal still
 * self-mounts on its own `showXSettingsModal` flag and frames its own ModalShell
 * (per the AGENTS.md modal convention) — only the inner controls are shared.
 */

export const EYEBROW = 'font-mono uppercase tracking-[0.14em] text-[9px] text-hld-muted-text mb-2';

type Accent = 'cyan' | 'green';

export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className={EYEBROW}>{title}</div>
      {children}
    </div>
  );
}

/** Editable prompt keys are exactly the string-valued fields of PromptsConfig. */
type StringPromptKey = {
  [K in keyof PromptsConfig]: PromptsConfig[K] extends string ? K : never;
}[keyof PromptsConfig];

/**
 * An editable engine prompt (project scope, sparse-diff save path, reset-to-default).
 * Accent tracks the owning workspace (cyan for Glass Box/Gist, green for Parallel).
 */
export function SettingsPromptField({
  promptKey,
  label,
  accent = 'cyan',
  rows = 6,
}: {
  promptKey: StringPromptKey;
  label: string;
  accent?: Accent;
  rows?: number;
}) {
  const promptsConfig = useStore((s) => s.promptsConfig);
  const setPromptsConfig = useStore((s) => s.setPromptsConfig);
  const saveCurrentState = useStore((s) => s.saveCurrentState);
  const value = promptsConfig[promptKey];
  const isDefault = value === DEFAULT_PROMPTS_CONFIG[promptKey];
  const resetHover = accent === 'green' ? 'hover:text-hld-green' : 'hover:text-hld-cyan';
  const focusBorder = accent === 'green' ? 'focus:border-hld-green' : 'focus:border-hld-cyan';
  return (
    <div className="flex flex-col gap-1.5 pt-1">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-hld-muted-text">
          {label} (editable · this project)
        </span>
        {!isDefault && (
          <button
            type="button"
            onClick={() => {
              setPromptsConfig({ ...promptsConfig, [promptKey]: DEFAULT_PROMPTS_CONFIG[promptKey] });
              void saveCurrentState();
            }}
            className={`flex items-center gap-1 font-mono text-[8.5px] uppercase tracking-[0.1em] text-hld-muted-text ${resetHover}`}
          >
            <RotateCcw size={11} /> Reset
          </button>
        )}
      </div>
      <textarea
        value={value}
        onChange={(e) => setPromptsConfig({ ...promptsConfig, [promptKey]: e.target.value })}
        onBlur={() => void saveCurrentState()}
        rows={rows}
        spellCheck={false}
        className={`w-full bg-hld-bg border border-hld-border ${focusBorder} outline-none text-hld-text font-mono text-[11px] px-2.5 py-2 resize-none leading-[1.5]`}
      />
    </div>
  );
}

/**
 * The per-call-kind model override rows (label + ModelPicker), bound to the live
 * `modelConfig`. Writing a choice sets a sparse override; clearing it falls back to
 * the recommended per-task default. Auto-saves.
 */
export function ModelKindRows({
  kinds,
  accent = 'cyan',
}: {
  kinds: { kind: AICallKind; label: string }[];
  accent?: Accent;
}) {
  const modelConfig = useStore((s) => s.modelConfig);
  const setModelConfig = useStore((s) => s.setModelConfig);
  const saveCurrentState = useStore((s) => s.saveCurrentState);
  const focusBorder = accent === 'green' ? 'focus:border-hld-green' : 'focus:border-hld-cyan';

  const setKindOverride = (kind: AICallKind, choice: ModelChoice | null) => {
    const next = { ...modelConfig };
    if (choice) next[kind] = choice;
    else delete next[kind];
    setModelConfig(next);
    void saveCurrentState();
  };

  return (
    <div className="flex flex-col gap-2.5">
      {kinds.map(({ kind, label }) => (
        <div key={kind} className="flex items-center justify-between gap-3">
          <span className="font-mono text-[11px] text-hld-muted-text">{label}</span>
          <ModelPicker
            value={modelConfig[kind] ?? null}
            onChange={(c) => setKindOverride(kind, c)}
            inheritLabel="Recommended"
            className={`bg-hld-bg border border-hld-border px-2 py-1.5 text-[11px] font-mono text-hld-text outline-none ${focusBorder} max-w-[220px]`}
          />
        </div>
      ))}
    </div>
  );
}
