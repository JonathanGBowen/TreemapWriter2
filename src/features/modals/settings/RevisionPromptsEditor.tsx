import { ExternalLink, RotateCcw } from 'lucide-react';
import { useStore } from '../../../store';
import { DEFAULT_PROMPTS_CONFIG, PROMPT_REGISTRY, getPromptText } from '../../../services/prompts';

const LOCKED_REVISION_PROMPTS = PROMPT_REGISTRY.filter(
  (e) => e.category === 'revision-engine' && e.editability === 'locked',
);

/**
 * The prompts surface of the Revision settings: edit the one user-editable engine
 * prompt (project scope, auto-saved on blur), view the locked engine internals
 * read-only, and jump to the full Prompt Map for global scope / other prompts.
 * Reuses the store's sparse-diff save path (`setPromptsConfig`) — no duplication.
 */
export function RevisionPromptsEditor() {
  const promptsConfig = useStore((s) => s.promptsConfig);
  const setPromptsConfig = useStore((s) => s.setPromptsConfig);
  const saveCurrentState = useStore((s) => s.saveCurrentState);
  const setShowPromptsGraphModal = useStore((s) => s.setShowPromptsGraphModal);
  const setShowRevisionSettingsModal = useStore((s) => s.setShowRevisionSettingsModal);

  const setEnginePrompt = (text: string) =>
    setPromptsConfig({ ...promptsConfig, generateRevisionsPrompt: text });
  const isDefault =
    promptsConfig.generateRevisionsPrompt === DEFAULT_PROMPTS_CONFIG.generateRevisionsPrompt;

  return (
    <div className="flex flex-col gap-2 pt-1">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-hld-muted-text">
          Revision engine (editable · this project)
        </span>
        {!isDefault && (
          <button
            type="button"
            onClick={() => {
              setEnginePrompt(DEFAULT_PROMPTS_CONFIG.generateRevisionsPrompt);
              void saveCurrentState();
            }}
            className="flex items-center gap-1 font-mono text-[8.5px] uppercase tracking-[0.1em] text-hld-muted-text hover:text-hld-cyan"
          >
            <RotateCcw size={11} /> Reset
          </button>
        )}
      </div>
      <textarea
        value={promptsConfig.generateRevisionsPrompt}
        onChange={(e) => setEnginePrompt(e.target.value)}
        onBlur={() => void saveCurrentState()}
        rows={6}
        spellCheck={false}
        className="w-full bg-hld-bg border border-hld-border focus:border-hld-cyan outline-none text-hld-text font-mono text-[11px] px-2.5 py-2 resize-none leading-[1.5]"
      />

      <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-hld-muted-text mt-1">
        Engine internals (read-only)
      </div>
      <div className="flex flex-wrap gap-1.5">
        {LOCKED_REVISION_PROMPTS.map((e) => (
          <span
            key={e.key}
            title={getPromptText(e.key).slice(0, 400)}
            className="px-2 py-1 border border-hld-border text-hld-muted-text font-mono text-[8.5px] tracking-[0.04em]"
          >
            {e.label}
          </span>
        ))}
      </div>
      <button
        type="button"
        onClick={() => {
          setShowRevisionSettingsModal(false);
          setShowPromptsGraphModal(true);
        }}
        className="self-start flex items-center gap-1.5 mt-1 font-mono text-[9px] uppercase tracking-[0.1em] text-hld-muted-text hover:text-hld-cyan transition-colors"
      >
        <ExternalLink size={11} /> Open the full Prompt Map
      </button>
    </div>
  );
}
