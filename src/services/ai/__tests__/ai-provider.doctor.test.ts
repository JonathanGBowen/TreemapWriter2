import { describe, expect, it } from 'vitest';
import { DEFAULT_PROMPTS_CONFIG } from '../../prompts';
import { distillThesis, runDoctorOutline, runDoctorParagraph, runDoctorReport } from '../ai-provider.doctor';
import { generateDoctorChecklist, proposeRoadmaps } from '../ai-provider.doctor-wizard';
import type { LLMClient, LLMRequest } from '../clients';
import type { RoadmapOption } from '../../../types';

/** A canned client that records the request and replays one scripted response. */
const mockClient = (response: string, requests: LLMRequest[]): LLMClient => ({
  generateText: async (req) => {
    requests.push(req);
    return response;
  },
  // eslint-disable-next-line require-yield
  streamText: async function* () {
    throw new Error('not used');
  },
});

const config = DEFAULT_PROMPTS_CONFIG;

const blocks = [
  { index: 0, text: '## Intro', kind: 'heading' as const },
  { index: 1, text: 'Paragraph one.', kind: 'prose' as const },
];

describe('runDoctorOutline', () => {
  it('sends the Logician persona as system instruction, numbers blocks 1-based, and re-aligns rows', async () => {
    const requests: LLMRequest[] = [];
    const result = await runDoctorOutline(
      mockClient(JSON.stringify({ rows: [{ index: 2, claim: 'Claim one.' }] }), requests),
      'test-model',
      undefined,
      { instrument: 'claims', scopeTitle: 'Whole draft', thesis: 'T', blocks, config },
    );
    expect(requests[0].systemInstruction).toBe(config.doctorSystemPrompt);
    expect(requests[0].json).toBe(true);
    // The instrument's editable prompt leads the user prompt; blocks are 1-based.
    expect(requests[0].prompt).toContain(config.doctorOutlinePrompt);
    expect(requests[0].prompt).toContain('[1] (heading — echo verbatim, no verdict)');
    expect(requests[0].prompt).toContain('[2] (prose)');
    expect(requests[0].prompt).toContain('### THESIS ###');
    if (result.instrument !== 'claims') throw new Error('wrong instrument');
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].claim).toBe('## Intro'); // heading echoed, model ignored
    expect(result.rows[1].claim).toBe('Claim one.');
  });

  it('selects the instrument prompt (thesisCheck) and coerces its verdicts', async () => {
    const requests: LLMRequest[] = [];
    const result = await runDoctorOutline(
      mockClient(
        JSON.stringify({ rows: [{ index: 2, claim: 'C', verdict: 'Weakly', justification: 'j' }] }),
        requests,
      ),
      'test-model',
      undefined,
      { instrument: 'thesisCheck', scopeTitle: 'Whole draft', thesis: 'T', blocks, config },
    );
    expect(requests[0].prompt).toContain(config.doctorThesisCheckPrompt);
    if (result.instrument !== 'thesisCheck') throw new Error('wrong instrument');
    expect(result.rows[1]).toMatchObject({ claim: 'C', verdict: 'weakly', justification: 'j' });
  });

  it('survives a fenced-JSON response (tolerant parse) and a junk response (blank rows)', async () => {
    const fenced = '```json\n{"rows":[{"index":2,"claim":"F"}]}\n```';
    const ok = await runDoctorOutline(mockClient(fenced, []), 'm', undefined, {
      instrument: 'claims',
      scopeTitle: 's',
      thesis: 't',
      blocks,
      config,
    });
    if (ok.instrument !== 'claims') throw new Error('wrong instrument');
    expect(ok.rows[1].claim).toBe('F');

    const junk = await runDoctorOutline(mockClient('sorry, no', []), 'm', undefined, {
      instrument: 'claims',
      scopeTitle: 's',
      thesis: 't',
      blocks,
      config,
    });
    if (junk.instrument !== 'claims') throw new Error('wrong instrument');
    expect(junk.rows).toHaveLength(2); // never dropped
    expect(junk.rows[1].claim).toBe('');
  });
});

describe('runDoctorParagraph', () => {
  it('returns the diagnosis and null on junk', async () => {
    const requests: LLMRequest[] = [];
    const diag = await runDoctorParagraph(
      mockClient(JSON.stringify({ says: 'S', does: 'D', coherence: 'aligned' }), requests),
      'm',
      undefined,
      { paragraph: 'One paragraph.', config },
    );
    expect(requests[0].systemInstruction).toBe(config.doctorSystemPrompt);
    expect(requests[0].prompt).toContain('One paragraph.');
    expect(diag).toEqual({ says: 'S', does: 'D', coherence: 'aligned' });

    expect(await runDoctorParagraph(mockClient('nope', []), 'm', undefined, { paragraph: 'p', config })).toBeNull();
  });
});

describe('distillThesis', () => {
  it('normalizes the three options', async () => {
    const out = await distillThesis(
      mockClient(
        JSON.stringify({
          options: [
            { type: 'mirror', description: 'd', thesis: 't1' },
            { type: 'pivot', description: 'd', thesis: 't2' },
            { type: 'risk', description: 'd', thesis: 't3' },
          ],
        }),
        [],
      ),
      'm',
      undefined,
      { text: 'discovery draft', config },
    );
    expect(out.map((o) => o.type)).toEqual(['mirror', 'pivot', 'risk']);
  });
});

describe('runDoctorReport', () => {
  it('feeds the reverse outline (not raw prose) under the instrument prompt', async () => {
    const requests: LLMRequest[] = [];
    const report = await runDoctorReport(mockClient('  ## Summary of Flow Issues\n- x  ', requests), 'm', undefined, {
      instrument: 'flow',
      scopeTitle: 'Whole draft',
      thesis: 'T',
      outlineMarkdown: '- [1] Claim A',
      config,
    });
    expect(requests[0].prompt).toContain(config.doctorFlowPrompt);
    expect(requests[0].prompt).toContain('### REVERSE OUTLINE ###');
    expect(requests[0].prompt).toContain('- [1] Claim A');
    expect(requests[0].json).toBeUndefined();
    expect(report).toBe('## Summary of Flow Issues\n- x');
  });
});

describe('proposeRoadmaps', () => {
  it('interpolates {{CRITICAL_ISSUE}} into the editable prompt (all occurrences)', async () => {
    const requests: LLMRequest[] = [];
    await proposeRoadmaps(
      mockClient(JSON.stringify({ roadmaps: [{ title: 'A', summary: 's', outline: ['x'] }] }), requests),
      'm',
      undefined,
      { criticalIssue: 'THE-ISSUE', outlineData: '| table |', config },
    );
    expect(requests[0].prompt).toContain('THE-ISSUE');
    expect(requests[0].prompt).not.toContain('{{CRITICAL_ISSUE}}');
    expect(requests[0].prompt).toContain('### ORIGINAL OUTLINE ###');
    expect(requests[0].systemInstruction).toBe(config.doctorSystemPrompt);
  });
});

describe('generateDoctorChecklist', () => {
  it('frames the chosen roadmap + outline and derives task anchors from blocks', async () => {
    const requests: LLMRequest[] = [];
    const roadmap: RoadmapOption = { title: 'Front-load', summary: 's', outline: ['step'] };
    const tasks = await generateDoctorChecklist(
      mockClient(JSON.stringify({ tasks: [{ text: 'Rework ¶2.', paragraphNumbers: [2] }] }), requests),
      'm',
      undefined,
      { chosenRoadmap: roadmap, outlineData: '| table |', blocks, config },
    );
    expect(requests[0].prompt).toContain('### CHOSEN ROADMAP ###');
    expect(requests[0].prompt).toContain('Front-load');
    expect(tasks).toHaveLength(1);
    expect(tasks[0].paragraphNumbers).toEqual([2]);
    expect(tasks[0].anchors[0]).toBe('Paragraph one.');
  });
});
