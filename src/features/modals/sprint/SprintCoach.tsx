// Living Sprints — the coach start protocol host. Owns the two persisted
// selectors (coach style + goal model, via useCoachPrefs — last-selected
// default) and renders the active style: guided micro-wizard, conversational
// chat, or hybrid (guided with a "talk it through" escape hatch). Produces a
// SprintGoalFraming (+ optional transcript) and hands it to the plan phase.

import { useEffect, useState } from 'react';
import { ModalShell } from '../ModalShell';
import { ModelPicker } from '../ModelPicker';
import { SegControl } from '../SegControl';
import { useModelChoice } from '../use-model-choice';
import { useCoachPrefs } from './use-coach-prefs';
import { CoachGuided } from './CoachGuided';
import { CoachChat } from './CoachChat';
import type { PromptsConfig, SectionSpec, SprintGoalFraming } from '../../../types';
import type { SprintCoachStyle, SprintGoalModelPref } from '../../../services/preferences';

interface SprintCoachProps {
  sectionTitle: string;
  spec?: SectionSpec;
  config: PromptsConfig;
  onReady: (framing: SprintGoalFraming, transcript?: string) => void;
  onBack: () => void;
  onClose: () => void;
}

const STYLES: SprintCoachStyle[] = ['guided', 'chat', 'hybrid'];
const GOALS: SprintGoalModelPref[] = ['woop', 'plain'];

export function SprintCoach({ sectionTitle, spec, config, onReady, onBack, onClose }: SprintCoachProps) {
  const { style, goalModel, setStyle, setGoalModel } = useCoachPrefs();
  const [choice, setChoice] = useModelChoice('coachSprintTurn', true);
  const [talking, setTalking] = useState(false);

  // Reset the hybrid escape hatch whenever the style changes.
  useEffect(() => setTalking(false), [style]);

  const usesChat = style === 'chat' || (style === 'hybrid' && talking);

  return (
    <ModalShell
      eyebrow="New Sprint — Coach"
      title="Define the goal"
      sub={sectionTitle}
      onClose={onClose}
      widthClass="max-w-xl"
    >
      <div className="flex flex-col gap-[16px]">
        <button
          type="button"
          onClick={onBack}
          className="self-start bg-transparent border border-hld-border text-hld-muted-text hover:text-hld-text font-mono text-[9px] tracking-[0.12em] uppercase px-[12px] py-[7px] transition-colors"
        >
          ← Setup
        </button>

        {/* Persisted selectors. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[12px]">
          <div>
            <div className="font-mono text-[9px] tracking-[0.16em] uppercase text-hld-muted-text mb-[6px]">
              Coach style
            </div>
            <SegControl
              ariaLabel="Coach style"
              value={STYLES.indexOf(style)}
              onChange={(i) => setStyle(STYLES[i])}
              options={[
                { glyph: '▸', label: 'Guided' },
                { glyph: '💬', label: 'Chat' },
                { glyph: '⚯', label: 'Hybrid' },
              ]}
            />
          </div>
          <div>
            <div className="font-mono text-[9px] tracking-[0.16em] uppercase text-hld-muted-text mb-[6px]">
              Goal model
            </div>
            <SegControl
              ariaLabel="Goal model"
              value={GOALS.indexOf(goalModel)}
              onChange={(i) => setGoalModel(GOALS[i])}
              options={[
                { glyph: '◎', label: 'WOOP', fine: 'obstacle + if-then' },
                { glyph: '○', label: 'Plain', fine: 'goal only' },
              ]}
            />
          </div>
        </div>

        {usesChat && (
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[9px] tracking-[0.14em] uppercase text-hld-muted-text">Coach depth</span>
            <ModelPicker
              value={choice}
              onChange={(c) => c && setChoice(c)}
              className="bg-hld-bg border border-hld-border text-[10px] font-mono uppercase tracking-widest text-hld-text px-2 py-1 outline-none focus:border-hld-cyan"
            />
          </div>
        )}

        <div className="border-t border-hld-border pt-[14px]">
          {usesChat ? (
            <CoachChat
              goalModel={goalModel}
              sectionTitle={sectionTitle}
              spec={spec}
              modelChoice={choice}
              config={config}
              onReady={onReady}
              onBack={style === 'hybrid' ? () => setTalking(false) : undefined}
            />
          ) : (
            <CoachGuided
              goalModel={goalModel}
              onReady={onReady}
              secondaryAction={
                style === 'hybrid'
                  ? { label: 'Talk it through first →', onClick: () => setTalking(true) }
                  : undefined
              }
            />
          )}
        </div>
      </div>
    </ModalShell>
  );
}
