import { useCallback } from 'react';
import { useStore } from '../../state';
import { repository as repo } from '../../services/repository-registry';
import { buildActivityBrief } from '../../lib/activity-brief';
import { buildReentryOpening } from '../../lib/dialogue-openings';
import { computeAllStrain } from '../../lib/strain-metrics';
import type { Section } from '../../types';

/** Flatten the section tree to a {id,title} index in reading order. */
function flatIndex(sections: Section[]): Array<{ id: string; title: string }> {
  const out: Array<{ id: string; title: string }> = [];
  const walk = (nodes: Section[]) =>
    nodes.forEach((n) => {
      out.push({ id: n.id, title: n.title });
      walk(n.children);
    });
  walk(sections);
  return out;
}

/**
 * Assembles and opens the re-entry dialogue: a deterministic activity/structure
 * record (git snapshots + session records + top strain + the current section's
 * demand) taken to the Dialogue tab. No AI on assembly — the record is computed
 * fresh from canonical sources (docs/dialogue-design.md §III). The optional AI
 * layer is the interlocutor turn the DialogueTab drives once open.
 */
export function useReentryOpening(): () => Promise<void> {
  const openDialogueOpening = useStore((s) => s.openDialogueOpening);
  const setTestsPanelTab = useStore((s) => s.setTestsPanelTab);

  return useCallback(async () => {
    const { sections, testSuite, selectedId, dismissedStrainIds } = useStore.getState();

    // Deterministic record — read the canonical sources directly.
    const [sessions, snapshots] = await Promise.all([
      repo.listSessions().catch(() => []),
      repo.listSnapshotMeta(30).catch(() => []),
    ]);
    const activityBrief = buildActivityBrief({ sessions, snapshots, now: Date.now() });

    const { strained } = computeAllStrain(sections, testSuite);
    const topStrain = strained.filter((s) => !dismissedStrainIds.includes(s.sectionId))[0];
    const strainHeadline = topStrain
      ? `${topStrain.title}: ${topStrain.signals[0]?.detail ?? 'under structural tension'}`
      : null;

    const index = flatIndex(sections);
    const current = selectedId ? index.find((s) => s.id === selectedId) ?? null : null;
    const nextAction = selectedId ? testSuite[selectedId]?.lastDiagnostic?.nextAction ?? null : null;

    openDialogueOpening(
      buildReentryOpening({
        activityBrief,
        strainHeadline,
        currentSection: current,
        nextAction,
        sections: index,
      }),
    );
    setTestsPanelTab('dialogue');
  }, [openDialogueOpening, setTestsPanelTab]);
}
