// Characterization tests for the Climate Artist atmosphere flow. Pins the per-
// instrument editable-prompt selection, the line-numbered framing, the document vs
// section header, and that it returns trimmed prose (no JSON, no schema).

import { describe, expect, it } from 'vitest';
import { analyzeAtmosphere } from '../ai-provider.atmosphere';
import { DEFAULT_PROMPTS_CONFIG } from '../../prompts';
import type { LLMClient, LLMRequest } from '../clients';
import type { AnalyzeAtmosphereInput } from '../../ai-provider';

const mockClient = (responses: string[], reqs: LLMRequest[]): LLMClient => {
  let i = 0;
  return {
    generateText: async (req) => {
      reqs.push(req);
      return responses[i++] ?? '';
    },
    streamText: async function* () {},
  };
};

const config = { ...DEFAULT_PROMPTS_CONFIG, weatherReportPrompt: 'WX-SYS', radarScanPrompt: 'RADAR-SYS' };

describe('analyzeAtmosphere', () => {
  it('selects the instrument prompt, line-numbers the draft, and returns trimmed prose', async () => {
    const reqs: LLMRequest[] = [];
    const input: AnalyzeAtmosphereInput = {
      instrument: 'weatherReport',
      target: 'document',
      text: 'Line one.\nLine two.',
      config,
    };

    const out = await analyzeAtmosphere(mockClient(['  A calm forecast.  '], reqs), 'model', 0, input);

    // No structured-output path: prose call, no system instruction, no json flag.
    expect(reqs[0].systemInstruction).toBeUndefined();
    expect(reqs[0].json).toBeUndefined();
    expect(reqs[0].prompt).toContain('WX-SYS');
    expect(reqs[0].prompt).toContain('### THE DRAFT');
    expect(reqs[0].prompt).toContain('| Line one.');
    expect(reqs[0].prompt).toContain('| Line two.');
    expect(out).toBe('A calm forecast.');
  });

  it('uses the radar prompt and a section header when targeting a section', async () => {
    const reqs: LLMRequest[] = [];
    const input: AnalyzeAtmosphereInput = {
      instrument: 'radarScan',
      target: 'section',
      sectionTitle: 'Sec',
      text: 'x',
      config,
    };
    await analyzeAtmosphere(mockClient(['ok'], reqs), 'model', 0, input);
    expect(reqs[0].prompt).toContain('RADAR-SYS');
    expect(reqs[0].prompt).toContain('PASSAGE: "Sec"');
  });
});
