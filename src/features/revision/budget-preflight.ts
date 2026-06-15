import { toast } from 'sonner';
import { useStore } from '../../state';
import { resolveModelChoice } from '../../services/ai/resolve-model-choice';
import { findCatalogModel } from '../../services/ai/model-catalog';
import { budgetRevisionInput, type BudgetedInput } from '../../services/ai/source-budget';
import type { AICallKind } from '../../services/ai/model-types';
import type { SourceDocument } from '../../types';

/**
 * Pack the section + selected sources into the configured model's context window
 * (so a verbatim quote is never silently truncated away), warning non-blockingly
 * if anything had to be trimmed. Shared by the revision and suggest-directives
 * flows so the budgeting lives in exactly one place. Reads the live model config
 * via getState() at call time, like the other revision orchestration.
 */
export const budgetForModel = (
  kind: AICallKind,
  sectionText: string,
  sources: SourceDocument[],
): BudgetedInput => {
  const { modelCatalog, modelConfig, globalModelDefault } = useStore.getState();
  const choice = resolveModelChoice(kind, modelConfig, globalModelDefault);
  const contextWindow =
    findCatalogModel(modelCatalog, choice.provider, choice.model)?.contextWindow ?? null;
  const budget = budgetRevisionInput({ sectionText, sources, contextWindow });
  if (budget.trimmed) {
    toast.warning(
      `Sources trimmed to fit ${choice.model}'s context window — deselect some or pick a larger-context model to include everything.`,
    );
  }
  return budget;
};
