// Climate Artist: atmospheric analysis of a draft (or a single passage). Provider-
// agnostic — it selects the instrument's editable prompt, frames the text with
// line numbers for location references, and returns the model's prose verdict.
// Split out of ai-provider.impl.ts to keep it small, mirroring ai-provider.compare.ts.
//
// Returns PROSE (markdown), not JSON: the four instruments (Weather Report, Radar
// Scan, Storm Spotter, Forecast) produce essayistic "weather reports" the UI
// renders with react-markdown. Like getCoachAdvice, this is a plain text call —
// no structured-output schema, no normalizer.

import type { AnalyzeAtmosphereInput } from '../ai-provider';
import type { AtmosphericInstrument } from '../../types';
import type { EditablePromptKey } from '../prompts/registry';
import type { LLMClient } from './clients';

const MAX_OUTPUT_TOKENS = 16000;
// Generous backstop on the fed text. Typical drafts are far smaller; this only
// guards a pathological payload (cf. ai-provider.compare.ts SIDE_CAP).
const INPUT_CAP = 120000;

/** Which editable prompt drives each instrument. */
const PROMPT_KEY: Record<AtmosphericInstrument, EditablePromptKey> = {
  weatherReport: 'weatherReportPrompt',
  radarScan: 'radarScanPrompt',
  stormSpotter: 'stormSpotterPrompt',
  forecast: 'forecastPrompt',
};

/** Prefix each line with "N | " so the model can cite locations by line number. */
const withLineNumbers = (text: string): string =>
  text
    .split('\n')
    .map((line, i) => `${String(i + 1).padStart(4, ' ')} | ${line}`)
    .join('\n');

const buildAtmospherePrompt = (input: AnalyzeAtmosphereInput): string => {
  const instruction = input.config[PROMPT_KEY[input.instrument]];
  const header =
    input.target === 'document'
      ? '### THE DRAFT (a work in progress) — each line is prefixed "N | " for reference ###'
      : `### PASSAGE: "${input.sectionTitle ?? 'Untitled'}" — each line is prefixed "N | " for reference ###`;
  return [
    instruction,
    '',
    header,
    withLineNumbers(input.text.slice(0, INPUT_CAP)),
    '',
    'Analyze the text above and respond in markdown, following the output format described. Ground your reading in specific passages — quote directly, and cite locations by section heading and line number where useful. The "N | " prefixes are line markers for your reference only; never include them inside quoted text.',
  ].join('\n');
};

export async function analyzeAtmosphere(
  client: LLMClient,
  model: string,
  thinkingBudget: number | undefined,
  input: AnalyzeAtmosphereInput,
): Promise<string> {
  const text = await client.generateText({
    model,
    prompt: buildAtmospherePrompt(input),
    thinkingBudget,
    maxTokens: MAX_OUTPUT_TOKENS,
  });
  return (text || '').trim();
}
