import { ExternalLink } from 'lucide-react';
import { useStore } from '../../state';
import type { AICallKind } from '../../services/ai/model-types';
import { ModalShell } from './ModalShell';
import { Disclosure } from '../shared/Disclosure';
import { SettingsSection, SettingsPromptField, ModelKindRows } from './FeatureSettingsShell';

const MODEL_KINDS: { kind: AICallKind; label: string }[] = [
  { kind: 'analyzeGist', label: 'Analysis (Stage A)' },
  { kind: 'composeGist', label: 'Composition (Stage B)' },
];

/**
 * Gist Editor settings (self-mounting per AGENTS.md). The model for each of the two
 * generation stages + the two editable prompts (analysis and composition — the
 * composition exemplar is the single highest-leverage knob). Auto-saves; "Done"
 * closes. Shared controls live in FeatureSettingsShell.
 */
export function GistSettingsModal() {
  const isOpen = useStore((s) => s.showGistSettingsModal);
  const setShow = useStore((s) => s.setShowGistSettingsModal);
  const setShowPromptsGraphModal = useStore((s) => s.setShowPromptsGraphModal);

  if (!isOpen) return null;
  const onClose = () => setShow(false);

  return (
    <ModalShell
      accent="cyan"
      eyebrow="Gist"
      title="Gist settings"
      sub="Model depth · prompts"
      onClose={onClose}
      onPrimary={onClose}
      primaryLabel="Done"
      widthClass="max-w-lg"
    >
      <div className="flex flex-col gap-5">
        <SettingsSection title="Model">
          <ModelKindRows kinds={MODEL_KINDS} />
        </SettingsSection>

        <div>
          <Disclosure label="Analysis prompt">
            <SettingsPromptField promptKey="gistAnalysisPrompt" label="Stage A — analysis" />
          </Disclosure>
          <Disclosure label="Composition prompt">
            <SettingsPromptField promptKey="gistCompositionPrompt" label="Stage B — composition" />
          </Disclosure>
        </div>

        <button
          type="button"
          onClick={() => {
            setShow(false);
            setShowPromptsGraphModal(true);
          }}
          className="self-start flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-hld-muted-text hover:text-hld-cyan transition-colors"
        >
          <ExternalLink size={11} /> Open the full Prompt Map
        </button>
      </div>
    </ModalShell>
  );
}
