import { describe, expect, it } from 'vitest';
import {
  inferGenre,
  baseLevelFor,
  minSpanWordsFor,
  spansForDepth,
  buildSegmentPrompt,
  parseSegmentResponse,
  segmentSpan,
  type SegmentPromptArgs,
} from '../ai-provider.segment';
import { parseMarkdown } from '../../../lib/utils';
import { segmentParagraphs, anchorFor } from '../../../lib/paragraph-helpers';
import { DEFAULT_PROMPTS_CONFIG } from '../../prompts';
import type { LLMClient, LLMRequest } from '../clients';

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

const longPara = (n: number): string => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');

const argsFor = (over: Partial<SegmentPromptArgs>): SegmentPromptArgs => ({
  blocks: [],
  headingPath: [],
  targetLevel: 2,
  mode: 'conservative',
  granularity: 'medium',
  genre: 'article',
  config: DEFAULT_PROMPTS_CONFIG,
  ...over,
});

describe('genre / scale heuristics', () => {
  it('infers genre from size with wide zones of indifference', () => {
    expect(inferGenre(2000)).toBe('article');
    expect(inferGenre(20000)).toBe('monograph');
    expect(inferGenre(80000)).toBe('compilation');
  });

  it('anchors baseLevel to existing structure, else the genre idiom', () => {
    expect(baseLevelFor('article', [])).toBe(2);
    expect(baseLevelFor('monograph', [])).toBe(1);
    const sections = parseMarkdown('## A\n\nbody\n\n## B\n\nbody');
    expect(baseLevelFor('article', sections)).toBe(2);
    const h1 = parseMarkdown('# A\n\nbody');
    expect(baseLevelFor('article', h1)).toBe(1); // existing structure wins
  });

  it('scales the shard-floor by genre', () => {
    expect(minSpanWordsFor('article')).toBeLessThan(minSpanWordsFor('monograph'));
    expect(minSpanWordsFor('monograph')).toBeLessThan(minSpanWordsFor('compilation'));
  });
});

describe('spansForDepth', () => {
  const md = ['# Chapter One', '', longPara(130), '', longPara(130), '', '# Chapter Two', '', longPara(130)].join('\n');
  const sections = parseMarkdown(md);
  const blocks = segmentParagraphs(md);

  it('depth 0 is the whole document', () => {
    const spans = spansForDepth(sections, blocks, 0, 1, 'article');
    expect(spans).toHaveLength(1);
    expect(spans[0]).toMatchObject({ depth: 0, blockStart: 0, blockEnd: blocks.length, targetLevel: 1, headingPath: [] });
  });

  it('depth 1 is the body of each parent section, heading excluded', () => {
    const spans = spansForDepth(sections, blocks, 1, 1, 'article');
    expect(spans).toHaveLength(2);
    expect(spans[0].headingPath).toEqual(['Chapter One']);
    expect(spans[1].headingPath).toEqual(['Chapter Two']);
    // The parent's own heading block is not part of its body span.
    const firstSpanBlocks = blocks.slice(spans[0].blockStart, spans[0].blockEnd);
    expect(firstSpanBlocks.every((b) => b.kind !== 'heading')).toBe(true);
  });

  it('drops a tiny span with nothing to critique (the shard-floor guard)', () => {
    const tiny = parseMarkdown('# A\n\nshort body\n\n# B\n\nshort');
    const tb = segmentParagraphs('# A\n\nshort body\n\n# B\n\nshort');
    expect(spansForDepth(tiny, tb, 1, 1, 'monograph')).toHaveLength(0);
  });

  it('stops at level > 6', () => {
    expect(spansForDepth(sections, blocks, 6, 1, 'article')).toHaveLength(0);
  });
});

describe('buildSegmentPrompt', () => {
  it('uses the level task (with the granularity bias) when no target heading exists', () => {
    const prompt = buildSegmentPrompt(
      argsFor({ blocks: [{ index: 0, text: 'Some prose.', kind: 'prose' }], granularity: 'fine' }),
    );
    expect(prompt).toContain('("fine")');
    expect(prompt).not.toContain('Critically evaluate the present structure');
  });

  it('uses the critique task when a target-level heading is present', () => {
    const prompt = buildSegmentPrompt(
      argsFor({
        blocks: [
          { index: 0, text: '## Background', kind: 'heading' },
          { index: 1, text: 'body', kind: 'prose' },
        ],
      }),
    );
    expect(prompt).toContain('Critically evaluate the present structure');
  });

  it('exploratory mode ignores existing headings (always the level task)', () => {
    const prompt = buildSegmentPrompt(
      argsFor({
        mode: 'exploratory',
        blocks: [
          { index: 0, text: '## Background', kind: 'heading' },
          { index: 1, text: 'body', kind: 'prose' },
        ],
      }),
    );
    expect(prompt).not.toContain('Critically evaluate the present structure');
  });
});

describe('parseSegmentResponse — level pass', () => {
  const blocks = [
    { index: 0, text: 'Alpha opening text here.', kind: 'prose' as const },
    { index: 1, text: 'Beta begins a clearly new topic.', kind: 'prose' as const },
  ];
  const args = argsFor({ blocks });

  it('turns seams into anchored insert edits', () => {
    const raw = JSON.stringify({ indivisible: false, seams: [{ blockIndex: 1, title: 'Beta', confidence: 0.9, rationale: 'shift' }] });
    const res = parseSegmentResponse(args, raw);
    expect(res.indivisible).toBe(false);
    expect(res.edits).toHaveLength(1);
    expect(res.edits[0]).toMatchObject({ kind: 'insert', level: 2, title: 'Beta', confidence: 0.9 });
    expect(res.edits[0].anchor).toBe(anchorFor('Beta begins a clearly new topic.'));
  });

  it('honors indivisible and emits no edits', () => {
    const res = parseSegmentResponse(args, JSON.stringify({ indivisible: true, seams: [] }));
    expect(res.indivisible).toBe(true);
    expect(res.edits).toHaveLength(0);
  });

  it('drops a seam with an out-of-range blockIndex', () => {
    const res = parseSegmentResponse(args, JSON.stringify({ seams: [{ blockIndex: 9, title: 'X', confidence: 1 }] }));
    expect(res.edits).toHaveLength(0);
  });

  it('collects reverse-outline summaries in summaries mode', () => {
    const res = parseSegmentResponse(
      argsFor({ blocks, mode: 'summaries' }),
      JSON.stringify({ seams: [{ blockIndex: 0, title: 'Alpha', summary: 'It frames the problem.', confidence: 1 }] }),
    );
    expect(res.summaries).toEqual([{ title: 'Alpha', sentence: 'It frames the problem.' }]);
    expect(res.edits[0]).toMatchObject({ title: 'Alpha', summary: 'It frames the problem.' });
  });
});

describe('parseSegmentResponse — critique pass', () => {
  const blocks = [
    { index: 0, text: '## Background', kind: 'heading' as const },
    { index: 1, text: 'body', kind: 'prose' as const },
  ];
  const args = argsFor({ blocks });

  it('parses the full edit union and drops invalid kinds', () => {
    const raw = JSON.stringify({
      edits: [
        { kind: 'retitle', anchor: '## Background', title: 'Prior work', confidence: 0.9, rationale: 'vague' },
        { kind: 'merge', anchor: '## Background', confidence: 0.85, rationale: 'shard' },
        { kind: 'nonsense', anchor: '## Background', confidence: 1 },
      ],
    });
    const res = parseSegmentResponse(args, raw);
    expect(res.edits).toHaveLength(2);
    const retitle = res.edits.find((e) => e.kind === 'retitle');
    expect(retitle).toMatchObject({ anchor: '## Background', title: 'Prior work' });
    const merge = res.edits.find((e) => e.kind === 'merge');
    expect(merge).toMatchObject({ anchor: '## Background' });
  });
});

describe('segmentSpan', () => {
  it('builds a JSON request and returns the parsed result', async () => {
    const reqs: LLMRequest[] = [];
    const client = mockClient(
      [JSON.stringify({ indivisible: false, seams: [{ blockIndex: 0, title: 'X', confidence: 1, rationale: '' }] })],
      reqs,
    );
    const res = await segmentSpan(client, 'm', 0, argsFor({ blocks: [{ index: 0, text: 'Prose here.', kind: 'prose' }] }));
    expect(reqs[0].json).toBe(true);
    expect(res.edits[0]).toMatchObject({ kind: 'insert', title: 'X' });
  });
});
