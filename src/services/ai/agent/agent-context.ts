// The agent's working context — whole-text first (the Gestalt default).
//
// A part is what it is by its role in the whole (Wertheimer). So the agent is
// given the WHOLE of what it is working on — a selected section's full subtree IN
// its structural surround, or the whole document — never a retrieved subset of the
// working prose. Retrieval tools exist for reaching BEYOND this text (artifacts,
// history), not for trimming it. Only when the whole genuinely overflows a budget
// do we degrade — and then to an OUTLINE of the whole (every heading, each
// section's claim), never to a content subset that would sever part from whole.

import type { Section, SectionSpec } from '../../../types';
import { buildStructuralSurround, formatStructuralSurround } from '../../../lib/diagnostic-helpers';
import { findSectionById } from '../../../lib/utils';

export interface AgentContextInput {
  /** 'section' frames a selected section in its surround; 'document' sends the whole markdown. */
  scope: 'section' | 'document';
  /** The selected section (required for 'section' scope; ignored otherwise). */
  selectedSectionId?: string | null;
  sections: Section[];
  markdown: string;
  /** sectionId → spec (with `'root'` = the document spec), for the structural surround. */
  specs: Record<string, SectionSpec | undefined>;
  /**
   * Optional character budget for the working text. When the whole text exceeds
   * it, degrade to an outline OF THE WHOLE — never a subset of the prose.
   */
  budgetChars?: number;
}

/** A heading-level outline of the WHOLE: every section's title + its claim (or a short head snippet). */
function outlineOfWhole(sections: Section[], specs: Record<string, SectionSpec | undefined>): string {
  const lines: string[] = [];
  const walk = (nodes: Section[]) => {
    for (const n of nodes) {
      const claim = specs[n.id]?.mainClaim?.trim();
      const collapsed = n.content.trim().replace(/\s+/g, ' ');
      const head = collapsed.slice(0, 160);
      const gist = claim ? `claim: ${claim}` : head ? `${head}${collapsed.length > 160 ? '…' : ''}` : '';
      lines.push(`${'#'.repeat(Math.max(1, n.level))} ${n.title}${gist ? ` — ${gist}` : ''}`);
      walk(n.children);
    }
  };
  walk(sections);
  return lines.join('\n');
}

/**
 * Build the agent's working-context block. Whole-text by default; the optional
 * `budgetChars` degrades an over-long whole to an outline of the whole.
 */
export function buildAgentContext(input: AgentContextInput): string {
  const { scope, selectedSectionId, sections, markdown, specs, budgetChars } = input;

  let title: string | null = null;
  let workingText = markdown;
  let surround = '';

  if (scope === 'section' && selectedSectionId) {
    const section = findSectionById(sections, selectedSectionId);
    if (section) {
      title = section.title;
      workingText = section.fullContent;
      surround = formatStructuralSurround(buildStructuralSurround(section.id, sections, specs));
    }
  }

  const overflows = typeof budgetChars === 'number' && workingText.length > budgetChars;
  const body = overflows
    ? [
        '(The whole exceeds the context budget, so this is an OUTLINE of the whole — every section and its claim. Use read tools to pull any section in full.)',
        '',
        outlineOfWhole(sections, specs),
      ].join('\n')
    : workingText;

  // On overflow the body is a document-wide outline, so the header must reflect
  // that even in section scope — otherwise it would claim to be the section's
  // full text while handing over a whole-document outline.
  const header = overflows
    ? 'WORKING TEXT — outline of the whole document (read as a whole; judge its parts in this context):'
    : title
      ? `WORKING TEXT — section "${title}" (read as a whole; judge its parts in this context):`
      : 'WORKING TEXT — the whole document (read as a whole; judge its parts in this context):';

  return [header, body, surround].filter(Boolean).join('\n\n');
}
