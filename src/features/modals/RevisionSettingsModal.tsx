import type { ReactNode } from 'react';
import { useStore } from '../../store';
import type { AICallKind, ModelChoice } from '../../services/ai/model-types';
import { ModalShell } from './ModalShell';
import { Disclosure } from '../shared/Disclosure';
import { ModelPicker } from './ModelPicker';
import { RevisionInstructionEditor } from './RevisionInstructionEditor';
import { RevisionTokenPreview } from './RevisionTokenPreview';
import { RevisionPromptsEditor } from './RevisionPromptsEditor';

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
  { kind: 'generateRevisions', label: 'Revision engine' },
  { kind: 'suggestDirectives', label: 'Directive suggester' },
];

/**
 * Revision feature settings (self-mounting per AGENTS.md). One ADHD-calm surface:
 * the grounding Instruction + a live token preview up top (primary), with the
 * model and prompt knobs folded into Disclosures below. Everything auto-saves —
 * the footer's "Done" just closes.
 */
export function RevisionSettingsModal() {
  const isOpen = useStore((s) => s.showRevisionSettingsModal);
  const setShow = useStore((s) => s.setShowRevisionSettingsModal);
  const modelConfig = useStore((s) => s.modelConfig);
  const setModelConfig = useStore((s) => s.setModelConfig);
  const saveCurrentState = useStore((s) => s.saveCurrentState);

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
      eyebrow="Glass Box"
      title="Revision settings"
      sub="Sourceless grounding · model · token preview · prompts"
      onClose={onClose}
      onPrimary={onClose}
      primaryLabel="Done"
      widthClass="max-w-lg"
    >
      <div className="flex flex-col gap-5">
        <Section title="Grounding instruction · used when no sources">
          <RevisionInstructionEditor />
        </Section>

        <Section title="Token preview">
          <RevisionTokenPreview />
        </Section>

        <div>
          <Disclosure label="Model">
            <div className="flex flex-col gap-2.5 pt-1">
              {MODEL_KINDS.map(({ kind, label }) => (
                <div key={kind} className="flex items-center justify-between gap-3">
                  <span className="font-mono text-[11px] text-hld-muted-text">{label}</span>
                  <ModelPicker
                    value={modelConfig[kind] ?? null}
                    onChange={(c) => setKindOverride(kind, c)}
                    inheritLabel="Recommended"
                    className="bg-hld-bg border border-hld-border px-2 py-1.5 text-[11px] font-mono text-hld-text outline-none focus:border-hld-cyan max-w-[220px]"
                  />
                </div>
              ))}
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
