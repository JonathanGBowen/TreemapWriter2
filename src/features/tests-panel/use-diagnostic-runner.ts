import { useCallback } from 'react';
import { toast } from 'sonner';
import { useStore } from '../../state';
import { parseMarkdown, buildRootSection } from '../../lib/utils';
import { selectSpecMap } from '../../lib/spec-map';
import { diagnosticToStatus, specFromLegacyGoals } from '../../lib/diagnostic-helpers';
import { guardContextFit } from '../shared/context-guard';
import { notifyAiError } from '../shared/ai-error';
import { aiProvider } from '../../services/ai-provider-registry';
import type { Section, Dependency, ReadingMode, Persona } from '../../types';
import type { ModelChoice } from '../../services/ai/model-types';

const findSection = (nodes: Section[], id: string): Section | null => {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findSection(node.children, id);
      if (found) return found;
    }
  }
  return null;
};

export function useDiagnosticRunner(
  currentSection: Section | null,
  activePersona: Persona,
) {
  const sections = useStore((s) => s.sections);
  const testSuite = useStore((s) => s.testSuite);
  const projectName = useStore((s) => s.projectName);
  const promptsConfig = useStore((s) => s.promptsConfig);
  const setTestSuite = useStore((s) => s.setTestSuite);
  const setIsProcessing = useStore((s) => s.setIsProcessing);
  const setShowRunModal = useStore((s) => s.setShowRunModal);
  const createSnapshot = useStore((s) => s.createSnapshot);

  const runDiagnostic = useCallback(
    async (
      scope: 'segment' | 'parent' | 'full',
      choice: ModelChoice,
      instruction: string,
      mode: ReadingMode,
    ) => {
      setShowRunModal(false);
      if (!currentSection) return;

      const testId = currentSection.id;

      const liveDoc = useStore.getState().localContent;
      const liveSections = parseMarkdown(liveDoc, sections);
      const liveSection =
        testId === 'root'
          ? buildRootSection(liveDoc, liveSections, projectName?.trim() || 'Whole Document')
          : findSection(liveSections, testId);
      if (!liveSection) {
        toast.error("Couldn't locate that section — it may have just been renamed.");
        return;
      }

      let effectiveScope: 'segment' | 'parent' | 'full' = scope;
      if (testId === 'root') effectiveScope = 'full';

      let diagContent = liveSection.fullContent;
      if (effectiveScope === 'full') {
        diagContent = liveDoc;
      } else if (effectiveScope === 'parent' && liveSection.parentId) {
        const parent = findSection(liveSections, liveSection.parentId);
        if (parent) diagContent = parent.fullContent;
      }
      if (
        !guardContextFit({
          catalog: useStore.getState().modelCatalog,
          choice,
          text: diagContent,
          what: testId === 'root' ? 'The whole document' : 'This section',
          setting: 'Run diagnostic',
        })
      ) {
        return;
      }

      let diagOpId: string | null = null;
      try {
        await createSnapshot('pre-ai-write', { sectionIds: [testId] });

        const entry = testSuite[testId];
        let spec = entry?.spec;
        if (!spec) {
          const goals =
            entry?.goals || 'Is this section written clearly and does it advance the argument?';
          spec = specFromLegacyGoals(goals, entry?.mainClaim);
        }

        if (spec.requiredMoves.length === 0) {
          toast.error(
            "This section has no required moves defined. Run 'Interpolate Tasks' first, or add moves manually.",
          );
          return;
        }

        setTestSuite((prev) => ({
          ...prev,
          [testId]: { ...prev[testId], goals: prev[testId]?.goals || '', status: 'running' },
        }));
        setIsProcessing(true);
        diagOpId = useStore.getState().beginOp({ label: 'Running diagnostic…' });

        const specs = selectSpecMap(testSuite);

        const diagnostic = await aiProvider.runDiagnostic({
          section: liveSection,
          spec,
          scope: effectiveScope,
          modelChoice: choice,
          persona: activePersona,
          customInstruction: instruction,
          fullDocument: liveDoc,
          sections: liveSections,
          config: promptsConfig,
          findSection,
          specs,
          mode,
        });

        const derivedStatus = diagnosticToStatus(diagnostic);

        setTestSuite((prev) => ({
          ...prev,
          [testId]: {
            ...prev[testId],
            status: derivedStatus,
            lastDiagnostic: diagnostic,
            lastResult: {
              passed: derivedStatus === 'success',
              critique: diagnostic.nextPriority,
              suggestions: diagnostic.coherenceNotes,
            },
          },
        }));
      } catch (e: any) {
        console.error('Diagnostic evaluation failed:', e);
        notifyAiError(e, `Analysis failed: ${e?.message || 'Try again.'}`);
        setTestSuite((prev) => ({
          ...prev,
          [testId]: { ...prev[testId], status: 'fail' },
        }));
      } finally {
        setIsProcessing(false);
        if (diagOpId) useStore.getState().endOp(diagOpId);
      }
    },
    [
      currentSection, sections, testSuite, projectName, promptsConfig,
      activePersona, setTestSuite, setIsProcessing, setShowRunModal, createSnapshot,
    ],
  );

  const estimateDependencies = useCallback(async () => {
    const opId = useStore.getState().beginOp({ label: 'Estimating dependencies…' });
    try {
      toast.info('Estimating dependencies...', { id: 'est-deps' });
      const depsMap = await aiProvider.estimateDependencies({
        sections,
        testSuite,
        structuralParts: useStore.getState().structuralParts,
        config: promptsConfig,
      });

      setTestSuite((prev) => {
        const next = { ...prev };
        let hasChanges = false;

        for (const [id, deps] of Object.entries(depsMap)) {
          const entry = next[id] || { goals: '', status: 'idle', history: [] };
          const existingDeps = entry.dependencies || [];
          const newDeps = deps.filter((d) => !existingDeps.some((ed) => ed.id === d.id));
          if (newDeps.length > 0) {
            next[id] = { ...entry, dependencies: [...existingDeps, ...newDeps] };
            hasChanges = true;
          }
        }
        return hasChanges ? next : prev;
      });
      toast.success('Dependencies estimated and updated.', { id: 'est-deps' });
    } catch (e) {
      console.error(e);
      toast.dismiss('est-deps');
      notifyAiError(e, 'Failed to estimate dependencies.');
    } finally {
      useStore.getState().endOp(opId);
    }
  }, [sections, testSuite, promptsConfig, setTestSuite]);

  const updateDependencies = useCallback(
    (id: string, deps: Dependency[]) => {
      setTestSuite((prev) => {
        const entry = prev[id] || { goals: '', status: 'idle', history: [] };
        return { ...prev, [id]: { ...entry, dependencies: deps } };
      });
    },
    [setTestSuite],
  );

  const getParentGoals = useCallback(() => {
    if (!currentSection || !currentSection.parentId) return undefined;
    return testSuite[currentSection.parentId]?.goals;
  }, [currentSection, testSuite]);

  return { runDiagnostic, estimateDependencies, updateDependencies, getParentGoals } as const;
}
