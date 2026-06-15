import { useCallback } from 'react';
import { toast } from 'sonner';
import { useStore } from '../../state';
import { aiProvider } from '../../services/ai-provider-registry';
import { DEFAULT_PERSONAS } from '../../lib/defaultPersonas';
import { budgetForModel } from './budget-preflight';
import { useCurrentSection } from '../tests-panel/use-current-section';
import type { DirectiveSuggestion, Persona } from '../../types';

const errMessage = (e: unknown) => (e instanceof Error ? e.message : 'Check API key or try again');

/** The active evaluator persona (built-in or custom), with a safe fallback. */
const resolveActivePersona = (id: string, custom: Persona[]): Persona => {
  const all = [...DEFAULT_PERSONAS, ...custom];
  return (
    all.find((p) => p.id === id) ??
    all[0] ?? { id: 'default', name: 'Academic Advisor', role: 'Editor', instruction: 'A rigorous academic editor.' }
  );
};

/**
 * Persona-flavored directive suggestion for the current section (ported from the
 * engine's SUGGESTION flow). Component -> this hook -> aiProvider; reads live
 * sources/persona via getState() at call time so the callback stays stable.
 */
export const useSuggestDirectives = () => {
  const currentSection = useCurrentSection();
  return useCallback(async (): Promise<DirectiveSuggestion[]> => {
    if (!currentSection) return [];
    const { title: sectionTitle, fullContent: sectionText } = currentSection;
    const { sources: library, selectedSourceIds, activePersonaId, customPersonas } =
      useStore.getState();
    const selected = library.filter((s) => selectedSourceIds.includes(s.id));
    const persona = resolveActivePersona(activePersonaId, customPersonas);
    const budget = budgetForModel('suggestDirectives', sectionText, selected);
    try {
      return await aiProvider.suggestDirectives({
        sectionTitle,
        sectionText: budget.sectionText,
        sources: budget.sources,
        personaName: persona.name,
        personaInstruction: persona.instruction,
      });
    } catch (e) {
      toast.error(`Could not suggest directives: ${errMessage(e)}`);
      return [];
    }
  }, [currentSection]);
};
