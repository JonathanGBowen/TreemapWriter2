import type { SourceDocument } from '../../types';

/**
 * The exact text the revision generate pass sends to the model, for context-fit
 * budgeting. Both the pre-flight (use-revision-actions) and the settings-modal
 * token preview compose the budget through this, so the preview can never
 * disagree with what actually gets sent.
 */
export const revisionBudgetText = (
  sectionText: string,
  instruction: string,
  sources: SourceDocument[],
): string => [sectionText, instruction, ...sources.map((s) => s.content)].join('\n\n');
