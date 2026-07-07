// Characterization tests for the per-source citation audit — the batch audit's
// unit call. Pins the contract: the locked citations system + audit task, the
// single-source SOURCE_DOCUMENTS block, the strict receipt schema, empty-array-
// is-valid, the guarded single-source fallback attribution, and throw-on-junk.

import { describe, expect, it } from 'vitest';
import { auditSourceUsage } from '../ai-provider.audit';
import { getPromptText } from '../../prompts';
import type { LLMClient, LLMRequest } from '../clients';
import type { AuditSourceUsageInput } from '../../ai-provider';
import type { SourceDocument } from '../../../types';

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

const source: SourceDocument = {
  id: 'src_9',
  role: 'reference',
  kind: 'Reference',
  label: 'Dewey (1922)',
  glyph: '❡',
  content: 'Habit is the mainspring of human action.',
};

const input = (over: Partial<AuditSourceUsageInput> = {}): AuditSourceUsageInput => ({
  documentTitle: 'Document Root',
  documentText: 'The draft cites Dewey loosely here.',
  source,
  directive: '',
  ...over,
});

const proposal = {
  section: 'Document Root',
  revision_type: 'Citation',
  original_text: 'cites Dewey loosely',
  proposed_text: 'cites Dewey precisely (Dewey, 1922)',
  rationale: 'Loose citation.',
  source_id: 'src_9',
  verbatim_source_quote: 'Habit is the mainspring of human action.',
  confidence_score: 4.6,
};

describe('auditSourceUsage', () => {
  it('sends the citations doctrine + the audit task over exactly one source, strict receipts', async () => {
    const reqs: LLMRequest[] = [];
    const client = mockClient([JSON.stringify({ proposals: [proposal] })], reqs);
    const out = await auditSourceUsage(client, 'm', undefined, input());

    expect(out).toHaveLength(1);
    expect(out[0].source_id).toBe('src_9');

    const req = reqs[0];
    expect(req.systemInstruction).toBe(getPromptText('citationsSystem'));
    expect(req.prompt).toContain(getPromptText('citationsAuditTask'));
    expect(req.prompt).toContain('### MASTER_DOCUMENT ###');
    expect(req.prompt).toContain('[Source ID: src_9] Dewey (1922) — role: reference');
    // Exactly one source block — the audit is per-source by contract.
    expect(req.prompt.match(/\[Source ID:/g)).toHaveLength(1);
    // Strict receipt schema: the receipt fields are required.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const required = (req.responseJsonSchema as any).properties.proposals.items.required;
    expect(required).toContain('source_id');
    expect(required).toContain('verbatim_source_quote');
  });

  it('passes the directive through, and defaults the header when absent', async () => {
    const reqs: LLMRequest[] = [];
    const client = mockClient(['{"proposals":[]}', '{"proposals":[]}'], reqs);
    await auditSourceUsage(client, 'm', undefined, input({ directive: 'Only the quotes.' }));
    await auditSourceUsage(client, 'm', undefined, input());
    expect(reqs[0].prompt).toContain('Only the quotes.');
    expect(reqs[1].prompt).toContain('(No explicit directive');
  });

  it('treats an empty proposals array as a valid good outcome', async () => {
    const client = mockClient(['{"proposals":[]}'], []);
    await expect(auditSourceUsage(client, 'm', undefined, input())).resolves.toEqual([]);
  });

  it('attributes a receipted proposal missing source_id to the one audited source', async () => {
    const client = mockClient(
      [JSON.stringify({ proposals: [{ ...proposal, source_id: '' }] })],
      [],
    );
    const out = await auditSourceUsage(client, 'm', undefined, input());
    expect(out[0].source_id).toBe('src_9');
  });

  it('drops an unreceipted proposal (strict mode) rather than surfacing it', async () => {
    const client = mockClient(
      [JSON.stringify({ proposals: [{ ...proposal, verbatim_source_quote: '' }] })],
      [],
    );
    await expect(auditSourceUsage(client, 'm', undefined, input())).resolves.toEqual([]);
  });

  it('throws on an unparseable response, naming the source', async () => {
    const client = mockClient(['not json at all'], []);
    await expect(auditSourceUsage(client, 'm', undefined, input())).rejects.toThrow(
      /Dewey \(1922\)/,
    );
  });
});
