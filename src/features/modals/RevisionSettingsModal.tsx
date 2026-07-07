import { useStore } from '../../store';
import type { AICallKind } from '../../services/ai/model-types';
import { ModalShell } from './ModalShell';
import { Disclosure } from '../shared/Disclosure';
import { RevisionInstructionEditor } from './RevisionInstructionEditor';
import { RevisionTokenPreview } from '../shared/RevisionTokenPreview';
import { RevisionPromptsEditor } from './RevisionPromptsEditor';
import { SettingsSection, ModelKindRows } from './FeatureSettingsShell';

const MODEL_KINDS: { kind: AICallKind; label: string }[] = [
  { kind: 'generateRevisions', label: 'Revision engine' },
  { kind: 'suggestDirectives', label: 'Directive suggester' },
  { kind: 'directiveDialogueTurn', label: 'Directive dialogue' },
  { kind: 'exegeteSource', label: 'Source exegesis' },
];

/**
 * Revision feature settings (self-mounting per AGENTS.md). One ADHD-calm surface:
 * the grounding Instruction + a live token preview up top (primary), with the
 * model and prompt knobs folded into Disclosures below. Everything auto-saves —
 * the footer's "Done" just closes. The shared controls live in FeatureSettingsShell.
 */
export function RevisionSettingsModal() {
  const isOpen = useStore((s) => s.showRevisionSettingsModal);
  const setShow = useStore((s) => s.setShowRevisionSettingsModal);

  if (!isOpen) return null;
  const onClose = () => setShow(false);

  return (
    <ModalShell
      accent="cyan"
      eyebrow="Glass Box"
      title="Revision settings"
      sub="Sourceless grounding · model · token preview · prompts"
      onClose={onClose}
      onPrimary={onClose}
      primaryLabel="Done"
      widthClass="max-w-lg"
    >
      <div className="flex flex-col gap-5">
        <SettingsSection title="Grounding instruction · used when no sources">
          <RevisionInstructionEditor />
        </SettingsSection>

        <SettingsSection title="Token preview">
          <RevisionTokenPreview />
        </SettingsSection>

        <div>
          <Disclosure label="Model">
            <div className="pt-1">
              <ModelKindRows kinds={MODEL_KINDS} />
            </div>
          </Disclosure>

          <Disclosure label="Prompts">
            <RevisionPromptsEditor />
          </Disclosure>
        </div>
      </div>
    </ModalShell>
  );
}
