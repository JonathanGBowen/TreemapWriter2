import type { ReactNode } from 'react';
import { ExternalLink, RotateCcw } from 'lucide-react';
import { useStore } from '../../state';
import { DEFAULT_PROMPTS_CONFIG } from '../../services/prompts';
import type { AICallKind, ModelChoice } from '../../services/ai/model-types';
import { ModalShell } from './ModalShell';
import { Disclosure } from '../shared/Disclosure';
import { ModelPicker } from './ModelPicker';

const EYEBROW = 'font-mono uppercase tracking-[0.14em] text-[9px] text-hld-muted-text mb-2';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className={EYEBROW}>{title}</div>
      {children}
    </div>
  );
}

const MODEL_KINDS: { kind: AICallKind; label: string }[] = [
  { kind: 'generateReverseOutline', label: 'Reverse outline' },
  { kind: 'regenerateParagraph', label: 'Paragraph regenerator' },
];

type ParallelPromptKey = 'generateReverseOutlinePrompt' | 'regenerateParagraphPrompt';

/** An editable engine prompt (project scope, sparse-diff save path, reset-to-default). */
function PromptField({ promptKey, label }: { promptKey: ParallelPromptKey; label: string }) {
  const promptsConfig = useStore((s) => s.promptsConfig);
  const setPromptsConfig = useStore((s) => s.setPromptsConfig);
  const saveCurrentState = useStore((s) => s.saveCurrentState);
  const value = promptsConfig[promptKey];
  const isDefault = value === DEFAULT_PROMPTS_CONFIG[promptKey];
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
            className="flex items-center gap-1 font-mono text-[8.5px] uppercase tracking-[0.1em] text-hld-muted-text hover:text-hld-green"
          >
            <RotateCcw size={11} /> Reset
          </button>
        )}
      </div>
      <textarea
        value={value}
        onChange={(e) => setPromptsConfig({ ...promptsConfig, [promptKey]: e.target.value })}
        onBlur={() => void saveCurrentState()}
        rows={5}
        spellCheck={false}
        className="w-full bg-hld-bg border border-hld-border focus:border-hld-green outline-none text-hld-text font-mono text-[11px] px-2.5 py-2 resize-none leading-[1.5]"
      />
    </div>
  );
}

/**
 * Parallel Editor settings (self-mounting per AGENTS.md). The model for each of the
 * two flows + the two editable prompts (distillation voice + the analogical-rewrite
 * contract). Everything auto-saves; the footer's "Done" just closes.
 */
export function ParallelSettingsModal() {
  const isOpen = useStore((s) => s.showParallelSettingsModal);
  const setShow = useStore((s) => s.setShowParallelSettingsModal);
  const modelConfig = useStore((s) => s.modelConfig);
  const setModelConfig = useStore((s) => s.setModelConfig);
  const saveCurrentState = useStore((s) => s.saveCurrentState);
  const setShowPromptsGraphModal = useStore((s) => s.setShowPromptsGraphModal);

  if (!isOpen) return null;
  const onClose = () => setShow(false);

  const setKindOverride = (kind: AICallKind, choice: ModelChoice | null) => {
    const next = { ...modelConfig };
    if (choice) next[kind] = choice;
    else delete next[kind];
    setModelConfig(next);
    void saveCurrentState();
  };

  return (
    <ModalShell
      accent="cyan"
      eyebrow="Parallel"
      title="Parallel settings"
      sub="Reverse-outline voice · model · prompts"
      onClose={onClose}
      onPrimary={onClose}
      primaryLabel="Done"
      widthClass="max-w-lg"
    >
      <div className="flex flex-col gap-5">
        <Section title="Model">
          <div className="flex flex-col gap-2.5">
            {MODEL_KINDS.map(({ kind, label }) => (
              <div key={kind} className="flex items-center justify-between gap-3">
                <span className="font-mono text-[11px] text-hld-muted-text">{label}</span>
                <ModelPicker
                  value={modelConfig[kind] ?? null}
                  onChange={(c) => setKindOverride(kind, c)}
                  inheritLabel="Recommended"
                  className="bg-hld-bg border border-hld-border px-2 py-1.5 text-[11px] font-mono text-hld-text outline-none focus:border-hld-green max-w-[220px]"
                />
              </div>
            ))}
          </div>
        </Section>

        <div>
          <Disclosure label="Reverse-outline prompt">
            <PromptField promptKey="generateReverseOutlinePrompt" label="Distillation" />
          </Disclosure>
          <Disclosure label="Regenerate prompt">
            <PromptField promptKey="regenerateParagraphPrompt" label="Analogical rewrite" />
          </Disclosure>
        </div>

        <button
          type="button"
          onClick={() => {
            setShow(false);
            setShowPromptsGraphModal(true);
          }}
          className="self-start flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-hld-muted-text hover:text-hld-green transition-colors"
        >
          <ExternalLink size={11} /> Open the full Prompt Map
        </button>
      </div>
    </ModalShell>
  );
}
