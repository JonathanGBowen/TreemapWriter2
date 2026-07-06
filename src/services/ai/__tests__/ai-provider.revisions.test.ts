// Characterization tests for the Glass-Box revision flow. These pin the
// *orchestration* generateRevisions performs around the LLMClient: which system /
// task prompt it selects per mode, what marker blocks the user prompt carries, how
// the structured-output schema's required set flexes for sourceless passes, and
// how the tolerant normalizer shapes (and filters) the result. The normalizer's
// own field-by-field behavior is covered in lib/__tests__/revision-helpers.test.ts;
// here we assert the contract the flow guarantees its callers.

import { describe, expect, it } from 'vitest';
import { generateRevisions } from '../ai-provider.revisions';
import { DEFAULT_PROMPTS_CONFIG, getPromptText } from '../../prompts';
import type { LLMClient, LLMRequest } from '../clients';
import type { GenerateRevisionsInput } from '../../ai-provider';
import type { SourceDocument } from '../../../types';

// A canned client that records each full request and replays scripted JSON.
const mockClient = (responses: string[], reqs: LLMRequest[]): LLMClient => {
  let i = 0;
  return {
    generateText: async (req) => {
      reqs.push(req);
      return responses[i++] ?? '{}';
    },
    streamText: async function* () {},
  };
};

const config = { ...DEFAULT_PROMPTS_CONFIG, generateRevisionsPrompt: 'REV-SYS' };

const source: SourceDocument = {
  id: 's1',
  role: 'reference',
  kind: 'Reference',
  label: 'Smith 2020',
  glyph: '§',
  content: 'The cat sat on the mat.',
};

const baseInput = (over: Partial<GenerateRevisionsInput> = {}): GenerateRevisionsInput => ({
  sectionTitle: 'Intro',
  sectionText: 'The original sentence here.',
  directive: 'Sharpen the claim.',
  mode: 'revision',
  subMode: 'verbatim',
  sources: [source],
  config,
  ...over,
});

/** Pull the proposals item's `required` set out of the structured-output schema. */
const requiredFields = (req: LLMRequest): string[] =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (req.responseJsonSchema as any).properties.proposals.items.required;

describe('generateRevisions — sourced revision mode (mixed pass)', () => {
  it('uses the editable system prompt, sends the SOURCE_DOCUMENTS block with role, and relaxes the receipt per-proposal', async () => {
    const reqs: LLMRequest[] = [];
    const responses = [
      JSON.stringify({
        proposals: [
          {
            section: 'Intro',
            revision_type: 'Rewording',
            original_text: 'The original sentence here.',
            proposed_text: 'A sharper sentence.',
            rationale: 'because',
            source_id: 's1',
            verbatim_source_quote: 'The cat sat on the mat.',
            confidence_score: 4,
          },
        ],
      }),
    ];

    const out = await generateRevisions(mockClient(responses, reqs), 'model', 0, baseInput());

    // The revision SYSTEM instruction is the user-editable one.
    expect(reqs[0].systemInstruction).toBe('REV-SYS');
    expect(reqs[0].json).toBe(true);
    // Sourced pass: the user prompt carries the directive, the master document, and
    // the formatted sources — not the sourceless INSTRUCTION block.
    expect(reqs[0].prompt).toContain('### MASTER_DOCUMENT ###');
    expect(reqs[0].prompt).toContain('Sharpen the claim.');
    expect(reqs[0].prompt).toContain('### SOURCE_DOCUMENTS ###');
    expect(reqs[0].prompt).toContain('Smith 2020');
    // The source's ROLE is surfaced to the model.
    expect(reqs[0].prompt).toContain('role: reference');
    expect(reqs[0].prompt).not.toContain('### INSTRUCTION ###');
    // Revision mode is per-proposal: the receipt fields are NOT in the required set,
    // so intrinsic edits can co-exist with source-derived ones.
    expect(requiredFields(reqs[0])).not.toContain('source_id');
    expect(requiredFields(reqs[0])).not.toContain('verbatim_source_quote');

    // The receipted proposal still round-trips through the normalizer intact.
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      revision_type: 'Rewording',
      original_text: 'The original sentence here.',
      proposed_text: 'A sharper sentence.',
      source_id: 's1',
      confidence_score: 4,
    });
  });

  it('keeps BOTH a source-derived and an intrinsic proposal in one pass', async () => {
    const reqs: LLMRequest[] = [];
    const responses = [
      JSON.stringify({
        proposals: [
          {
            section: 'Intro',
            revision_type: 'Citation',
            original_text: 'The original sentence here.',
            proposed_text: 'A cited sentence (Smith, 2020).',
            rationale: 'draws on the reference',
            source_id: 's1',
            verbatim_source_quote: 'The cat sat on the mat.',
            confidence_score: 4.5,
          },
          {
            // Intrinsic: no receipt. Under the old binary contract this was dropped.
            section: 'Intro',
            revision_type: 'Flow Improvement',
            original_text: 'A sharper sentence.',
            proposed_text: 'A sharper, better-flowing sentence.',
            rationale: 'smooths the transition',
            confidence_score: 3,
          },
        ],
      }),
    ];

    const out = await generateRevisions(mockClient(responses, reqs), 'model', 0, baseInput());

    expect(out).toHaveLength(2);
    // Source-derived proposal carries its receipt.
    expect(out[0]).toMatchObject({ source_id: 's1', verbatim_source_quote: 'The cat sat on the mat.' });
    // Intrinsic proposal survives with empty receipt — NOT mis-attributed to the
    // single source via the fallback.
    expect(out[1].source_id).toBe('');
    expect(out[1].verbatim_source_quote).toBe('');
  });
});

describe('generateRevisions — sourceless revision mode', () => {
  it('sends the INSTRUCTION block, drops the receipt from required, and keeps a receiptless proposal', async () => {
    const reqs: LLMRequest[] = [];
    const responses = [
      JSON.stringify({
        proposals: [
          {
            // No source_id / verbatim_source_quote, and a bad type + out-of-range score.
            revision_type: 'nonsense',
            original_text: 'The original sentence here.',
            proposed_text: 'X',
            rationale: 'r',
            confidence_score: 9,
          },
        ],
      }),
    ];

    const out = await generateRevisions(
      mockClient(responses, reqs),
      'model',
      0,
      baseInput({ sources: [], instruction: 'GROUND-IN-DOC' }),
    );

    expect(reqs[0].prompt).toContain('### INSTRUCTION ###');
    expect(reqs[0].prompt).toContain('GROUND-IN-DOC');
    expect(reqs[0].prompt).not.toContain('### SOURCE_DOCUMENTS ###');
    // Sourceless schema relaxes the receipt — those two fields leave `required`.
    expect(requiredFields(reqs[0])).not.toContain('verbatim_source_quote');
    expect(requiredFields(reqs[0])).not.toContain('source_id');

    // The receiptless proposal survives; the type coerces and the score clamps,
    // and the missing section label falls back to the section title.
    expect(out).toHaveLength(1);
    expect(out[0].revision_type).toBe('Replacement');
    expect(out[0].confidence_score).toBe(5);
    expect(out[0].section).toBe('Intro');
  });
});

describe('generateRevisions — locked prompts for citations + assembly modes', () => {
  it('citations mode pulls the locked citations system prompt and keeps receipts required', async () => {
    const reqs: LLMRequest[] = [];
    await generateRevisions(
      mockClient(['{"proposals":[]}'], reqs),
      'model',
      0,
      baseInput({ mode: 'citations' }),
    );
    expect(reqs[0].systemInstruction).toBe(getPromptText('citationsSystem'));
    // Strict modes keep the glass-box receipt mandatory in the schema.
    expect(requiredFields(reqs[0])).toEqual(
      expect.arrayContaining(['source_id', 'verbatim_source_quote']),
    );
  });

  it('assembly mode pulls the locked assembly system prompt and the sub-mode task', async () => {
    const verbatim: LLMRequest[] = [];
    await generateRevisions(
      mockClient(['{"proposals":[]}'], verbatim),
      'model',
      0,
      baseInput({ mode: 'assembly', subMode: 'verbatim' }),
    );
    expect(verbatim[0].systemInstruction).toBe(getPromptText('revisionAssemblySystem'));
    expect(verbatim[0].prompt).toContain(getPromptText('revisionAssemblyVerbatimTask'));
    // Assembly is strictly receipted too.
    expect(requiredFields(verbatim[0])).toEqual(
      expect.arrayContaining(['source_id', 'verbatim_source_quote']),
    );

    const woven: LLMRequest[] = [];
    await generateRevisions(
      mockClient(['{"proposals":[]}'], woven),
      'model',
      0,
      baseInput({ mode: 'assembly', subMode: 'woven' }),
    );
    expect(woven[0].prompt).toContain(getPromptText('revisionAssemblyWovenTask'));
  });
});

describe('generateRevisions — parse outcomes', () => {
  it('throws when the response has no recoverable array', async () => {
    const reqs: LLMRequest[] = [];
    await expect(
      generateRevisions(mockClient(['totally not json'], reqs), 'model', 0, baseInput()),
    ).rejects.toThrow(/could not be parsed/i);
  });

  it('returns [] for a valid-but-empty proposals array (no edits ≠ error)', async () => {
    const reqs: LLMRequest[] = [];
    const out = await generateRevisions(
      mockClient(['{"proposals":[]}'], reqs),
      'model',
      0,
      baseInput(),
    );
    expect(out).toEqual([]);
  });
});
