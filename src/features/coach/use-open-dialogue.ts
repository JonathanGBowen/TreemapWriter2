import { useCallback } from 'react';
import { useStore } from '../../state';
import { repository as repo } from '../../services/repository-registry';
import { buildActivityBrief } from '../../lib/activity-brief';
import { buildCoachPlanOpening, buildUnstickOpening } from '../../lib/dialogue-openings';
import { buildStructuralSurround, formatStructuralSurround } from '../../lib/diagnostic-helpers';
import { buildSpecMap } from '../../lib/strain-metrics';
import { findSectionById } from '../../lib/utils';
import type { Section } from '../../types';

/** Flat {id,title} index in reading order + the id that follows a given section. */
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

/** Compact per-section structure summary (mirrors the coach's own structureData). */
function structureSummary(sections: Section[], testSuite: ReturnType<typeof useStore.getState>['testSuite']): string {
  const rows = sections.map((sec) => {
    const t = testSuite[sec.id];
    return {
      title: sec.title,
      status: t?.status,
      missing: t?.lastDiagnostic?.moveResults?.filter((m) => m.status === 'missing' || m.status === 'unclear').length ?? 0,
    };
  });
  return JSON.stringify(rows, null, 2);
}

/**
 * Opens the coach-plan opening — contest the streamed plan. Assembled from the
 * plan verbatim + the structure summary + the recent-activity record.
 */
export function useCoachPlanOpening(): (plan: string) => Promise<void> {
  const openDialogueOpening = useStore((s) => s.openDialogueOpening);
  const setTestsPanelTab = useStore((s) => s.setTestsPanelTab);
  const setShowCoachModal = useStore((s) => s.setShowCoachModal);

  return useCallback(
    async (plan: string) => {
      const { sections, testSuite } = useStore.getState();
      const [sessions, snapshots] = await Promise.all([
        repo.listSessions().catch(() => []),
        repo.listSnapshotMeta(30).catch(() => []),
      ]);
      openDialogueOpening(
        buildCoachPlanOpening({
          plan,
          structureSummary: structureSummary(sections, testSuite),
          activityBrief: buildActivityBrief({ sessions, snapshots, now: Date.now() }),
          sections: flatIndex(sections),
        }),
      );
      setShowCoachModal(false);
      setTestsPanelTab('dialogue');
    },
    [openDialogueOpening, setTestsPanelTab, setShowCoachModal],
  );
}

/**
 * Opens the unstick opening for a section — the repointed 90 s stall. Section
 * text + structural surround + the held claim + the last demand + the active
 * sprint step; converges on a next action here, a recentering, or permission to
 * stop. All from in-memory state (no async, so a stall escalates instantly).
 */
export function useUnstickOpening(): (sectionId: string) => void {
  const openDialogueOpening = useStore((s) => s.openDialogueOpening);
  const setTestsPanelTab = useStore((s) => s.setTestsPanelTab);

  return useCallback(
    (sectionId: string) => {
      const { sections, testSuite, activeSession } = useStore.getState();
      const section = findSectionById(sections, sectionId);
      if (!section) return;

      const specs = buildSpecMap(testSuite);
      const surround = formatStructuralSurround(buildStructuralSurround(sectionId, sections, specs)) || null;
      const entry = testSuite[sectionId];
      const index = flatIndex(sections);
      const pos = index.findIndex((s) => s.id === sectionId);
      const nextSectionId = pos >= 0 && pos < index.length - 1 ? index[pos + 1].id : null;
      const activeStep = activeSession?.steps.find((st) => !st.completed)?.description ?? null;

      openDialogueOpening(
        buildUnstickOpening({
          section: { id: section.id, title: section.title, content: section.fullContent },
          surround,
          mainClaim: entry?.spec?.mainClaim ?? entry?.mainClaim ?? null,
          nextAction: entry?.lastDiagnostic?.nextAction ?? null,
          nextPriority: entry?.lastDiagnostic?.nextPriority ?? null,
          activeStep,
          nextSectionId,
        }),
      );
      setTestsPanelTab('dialogue');
    },
    [openDialogueOpening, setTestsPanelTab],
  );
}
