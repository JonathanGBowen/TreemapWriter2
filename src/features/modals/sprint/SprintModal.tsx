// Living Sprints — the orchestrator. Evolves the original Goal/Content sprint
// modal: instead of marching every section, a sprint targets ONE section (the
// active selection) and runs an ordered sequence of timed *moves*. It reads its
// own openness from ui-state by `mode`, owns the phase (setup → brief → running)
// and the in-flight plan (ephemeral — never persisted; the prose is saved
// continuously via the existing onSaveContent/onSaveGoal path), and resolves the
// reinstatement + backlog context the inner screens need. Each phase renders its
// own overlay, so only one is mounted at a time. Public name/props unchanged so
// App.tsx wiring is a one-line import swap.

import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../../store';
import type {
  ArgumentShape,
  PromptsConfig,
  Section,
  SessionGoal,
  SessionStep,
  SprintGoalFraming,
  SprintPlan,
  TestSuite,
} from '../../../types';
import type { SprintBacklog } from '../../../services/ai-provider';
import { buildReinstatement } from '../../../lib/reinstate';
import { goalPlan, planFromShape } from '../../../lib/sprintPlan';
import { SprintSetup } from './SprintSetup';
import { SprintCoach } from './SprintCoach';
import { SprintPlanReview } from './SprintPlanReview';
import { SprintRunner } from './SprintRunner';

export interface SprintModalProps {
  sections: Section[];
  testSuite: TestSuite;
  mode: 'goal' | 'content';
  onSaveContent?: (id: string, content: string) => void;
  onSaveGoal?: (id: string, goal: string, type: 'manual') => void;
  promptsConfig: PromptsConfig;
}

type Phase = 'setup' | 'coach' | 'plan' | 'running';

interface GoalContext {
  framing: SprintGoalFraming;
  transcript?: string;
}

function findById(nodes: Section[], id: string | null): Section | null {
  if (!id) return null;
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findById(n.children, id);
    if (found) return found;
  }
  return null;
}

function daysSince(ts: number | undefined): number | null {
  if (!ts) return null;
  return Math.max(0, Math.round((Date.now() - ts) / 86_400_000));
}

export function SprintModal({
  sections,
  testSuite,
  mode,
  onSaveContent,
  onSaveGoal,
  promptsConfig,
}: SprintModalProps) {
  const showGoal = useStore((s) => s.showGoalSprintModal);
  const setShowGoal = useStore((s) => s.setShowGoalSprintModal);
  const showContent = useStore((s) => s.showContentSprintModal);
  const setShowContent = useStore((s) => s.setShowContentSprintModal);
  const selectedId = useStore((s) => s.selectedId);
  const startSession = useStore((s) => s.startSession);
  const endSession = useStore((s) => s.endSession);
  const sessionActive = useStore((s) => s.activeSession !== null);

  const isOpen = mode === 'goal' ? showGoal : showContent;

  const [phase, setPhase] = useState<Phase>('setup');
  const [plan, setPlan] = useState<SprintPlan | null>(null);
  const [goalCtx, setGoalCtx] = useState<GoalContext | null>(null);
  // True when THIS sprint started the active session (so it should close it).
  // If a standalone session is already running, the sprint's work just counts
  // toward it and we leave it open.
  const [ownsSession, setOwnsSession] = useState(false);
  const [briefSeed, setBriefSeed] = useState<{ shape: ArgumentShape | null; totalMin: number }>({
    shape: null,
    totalMin: mode === 'content' ? 35 : 10,
  });

  // Target = the active section, falling back to the first.
  const section = useMemo(
    () => findById(sections, selectedId) ?? sections[0] ?? null,
    [sections, selectedId],
  );
  const entry = section ? testSuite[section.id] : undefined;

  const reinstatement = useMemo(() => buildReinstatement(section, entry), [section, entry]);
  const lastTouchedDays = daysSince(entry?.history?.[entry.history.length - 1]?.timestamp);
  const backlog: SprintBacklog = {
    unfinishedCount: entry?.spec?.requiredMoves?.length ?? 0,
    lastTouchedDays,
    fragmentCount: reinstatement.fragments.length,
  };

  useEffect(() => {
    if (isOpen) {
      setPhase('setup');
      setPlan(null);
      setGoalCtx(null);
      setOwnsSession(false);
    }
  }, [isOpen]);

  if (!isOpen || !section) return null;

  const onClose = () => {
    // A sprint that opened its own session checks out as that session ends —
    // the same tags + semantic commit + record as a standalone session. Mark
    // nothing as completed (we don't track per-move done state); the word delta
    // and duration carry the evidence.
    if (ownsSession) {
      void endSession({ completedStepIds: [], carryForward: [], reflection: null });
      setOwnsSession(false);
    }
    if (mode === 'goal') setShowGoal(false);
    else setShowContent(false);
    setPhase('setup');
    setPlan(null);
    setGoalCtx(null);
  };

  const initialText =
    mode === 'content' ? section.content : entry?.goals || entry?.spec?.mainClaim || '';

  const onSave = (text: string) => {
    if (mode === 'content') onSaveContent?.(section.id, text);
    else onSaveGoal?.(section.id, text, 'manual');
  };

  const startWithPlan = (p: SprintPlan) => {
    setPlan(p);
    setPhase('running');
    // Bracket the sprint as a recorded session — but only if one isn't already
    // running (then the sprint just contributes to the open session).
    if (!sessionActive) {
      const framing = p.goal;
      const goal: SessionGoal = {
        wish: framing?.wish?.trim() || `Sprint — ${section.title}`,
        outcome: null,
        obstacle: framing?.obstacle ?? null,
        plan: framing?.ifThen ?? null,
      };
      const steps: SessionStep[] = p.moves.map((m) => ({
        id: m.id,
        description: m.title,
        estimatedMinutes: Math.round(m.durationSec / 60) || null,
        completed: false,
        implementationIntention: null,
      }));
      setOwnsSession(true);
      void startSession({ goal, steps, source: 'sprint' });
    }
  };

  const onStartSetup = (shape: ArgumentShape | null, totalMin: number) => {
    const next =
      mode === 'content' && shape
        ? planFromShape(shape, { totalMin, targetSectionId: section.id })
        : goalPlan(section.id, totalMin);
    startWithPlan(next);
  };

  if (phase === 'running' && plan) {
    return (
      <SprintRunner
        plan={plan}
        mode={mode}
        section={section}
        reinstatement={reinstatement}
        lastTouchedDays={lastTouchedDays}
        initialText={initialText}
        onSave={onSave}
        onClose={onClose}
      />
    );
  }

  if (phase === 'plan' && goalCtx) {
    return (
      <SprintPlanReview
        sectionTitle={section.title}
        targetSectionId={section.id}
        spec={entry?.spec}
        shape={briefSeed.shape}
        totalMin={briefSeed.totalMin}
        backlog={backlog}
        framing={goalCtx.framing}
        transcript={goalCtx.transcript}
        config={promptsConfig}
        onStart={startWithPlan}
        onBack={() => setPhase('coach')}
        onClose={onClose}
      />
    );
  }

  if (phase === 'coach') {
    return (
      <SprintCoach
        sectionTitle={section.title}
        spec={entry?.spec}
        config={promptsConfig}
        onReady={(framing, transcript) => {
          setGoalCtx({ framing, transcript });
          setPhase('plan');
        }}
        onBack={() => setPhase('setup')}
        onClose={onClose}
      />
    );
  }

  return (
    <SprintSetup
      mode={mode}
      sectionTitle={section.title}
      onStart={onStartSetup}
      onCoach={(shape, totalMin) => {
        setBriefSeed({ shape, totalMin });
        setPhase('coach');
      }}
      onClose={onClose}
    />
  );
}
