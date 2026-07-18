import { ExternalLink } from 'lucide-react';
import { useStore } from '../../../state';
import type { AICallKind } from '../../../services/ai/model-types';
import { ModalShell } from '../shared/ModalShell';
import { Disclosure } from '../../shared/Disclosure';
import { SettingsSection, SettingsPromptField, ModelKindRows } from './FeatureSettingsShell';

const MODEL_KINDS: { kind: AICallKind; label: string }[] = [
  { kind: 'generateReverseOutline', label: 'Reverse outline' },
  { kind: 'regenerateParagraph', label: 'Paragraph regenerator' },
];

/**
 * Parallel Editor settings (self-mounting per AGENTS.md). The model for each of the
 * two flows + the two editable prompts (distillation voice + the analogical-rewrite
 * contract). Everything auto-saves; the footer's "Done" just closes. Shared controls
 * live in FeatureSettingsShell (green accent matches the Parallel workspace).
 */
export function ParallelSettingsModal() {
  const isOpen = useStore((s) => s.showParallelSettingsModal);
  const setShow = useStore((s) => s.setShowParallelSettingsModal);
  const setShowPromptsGraphModal = useStore((s) => s.setShowPromptsGraphModal);

  if (!isOpen) return null;
  const onClose = () => setShow(false);

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
        <SettingsSection title="Model">
          <ModelKindRows kinds={MODEL_KINDS} accent="green" />
        </SettingsSection>

        <div>
          <Disclosure label="Reverse-outline prompt">
            <SettingsPromptField
              promptKey="generateReverseOutlinePrompt"
              label="Distillation"
              accent="green"
              rows={5}
            />
          </Disclosure>
          <Disclosure label="Regenerate prompt">
            <SettingsPromptField
              promptKey="regenerateParagraphPrompt"
              label="Analogical rewrite"
              accent="green"
              rows={5}
            />
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
