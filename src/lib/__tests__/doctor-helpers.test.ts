import { describe, expect, it } from 'vitest';
import {
  checklistToMarkdown,
  coerceVerdict,
  extractCriticalIssue,
  formatOutlineData,
  formatOutlineMarkdown,
  normalizeClaimRows,
  normalizeCoherenceRows,
  normalizeDoctorTasks,
  normalizeParagraphDiagnosis,
  normalizeRoadmaps,
  normalizeSaysDoesRows,
  normalizeThesisOptions,
} from '../doctor-helpers';
import { anchorFor } from '../paragraph-helpers';
import type { DoctorChecklist } from '../../types';

const blocks = [
  { index: 0, text: '## Introduction', kind: 'heading' as const },
  { index: 1, text: 'First prose paragraph making claim A.', kind: 'prose' as const },
  { index: 2, text: 'Second prose paragraph making claim B.', kind: 'prose' as const },
];

describe('normalizeClaimRows', () => {
  it('re-aligns by 1-based number, echoes non-prose, blanks a miss — never drops', () => {
    const rows = normalizeClaimRows(
      { rows: [{ index: 2, claim: 'Claim A distilled' }] }, // [3] missing, [1] is the heading
      blocks,
    );
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({ index: 0, kind: 'heading', claim: '## Introduction' });
    expect(rows[1].claim).toBe('Claim A distilled');
    expect(rows[2].claim).toBe(''); // missed → blank, flagged by the UI
  });

  it('tolerates a bare array and alternate field names, ignoring junk', () => {
    const rows = normalizeClaimRows(
      [{ n: 2, sentence: 'A' }, { index: 3, claim: 'B' }, 'garbage', { index: 99, claim: 'out of range is kept in the map but no block asks for it' }],
      blocks,
    );
    expect(rows[1].claim).toBe('A');
    expect(rows[2].claim).toBe('B');
  });
});

describe('normalizeSaysDoesRows', () => {
  it('maps says/does per prose block and echoes non-prose as says', () => {
    const rows = normalizeSaysDoesRows(
      { rows: [{ index: 2, says: 'Says A', does: 'Introduces A' }, { index: 3, says: 'Says B', does: 'Supports A' }] },
      blocks,
    );
    expect(rows[0]).toEqual({ index: 0, kind: 'heading', says: '## Introduction', does: '' });
    expect(rows[1]).toMatchObject({ says: 'Says A', does: 'Introduces A' });
    expect(rows[2]).toMatchObject({ says: 'Says B', does: 'Supports A' });
  });
});

describe('normalizeCoherenceRows / coerceVerdict', () => {
  it('coerces verdict case variants and junk', () => {
    expect(coerceVerdict('Yes')).toBe('yes');
    expect(coerceVerdict('WEAKLY')).toBe('weakly');
    expect(coerceVerdict('kinda')).toBeUndefined();
  });

  it('gives non-prose rows no verdict and a missed prose row neither claim nor verdict', () => {
    const rows = normalizeCoherenceRows(
      { rows: [{ index: 2, claim: 'A', verdict: 'No', justification: 'contradicts thesis' }] },
      blocks,
    );
    expect(rows[0].verdict).toBeUndefined();
    expect(rows[0].claim).toBe('## Introduction');
    expect(rows[1]).toMatchObject({ claim: 'A', verdict: 'no', justification: 'contradicts thesis' });
    expect(rows[2].claim).toBe('');
    expect(rows[2].verdict).toBeUndefined();
  });
});

describe('normalizeParagraphDiagnosis', () => {
  it('keeps a usable diagnosis and returns null on junk', () => {
    expect(normalizeParagraphDiagnosis({ says: 'S', does: 'D', coherence: 'aligned' })).toEqual({
      says: 'S',
      does: 'D',
      coherence: 'aligned',
    });
    expect(normalizeParagraphDiagnosis({})).toBeNull();
    expect(normalizeParagraphDiagnosis('nope')).toBeNull();
    expect(normalizeParagraphDiagnosis(null)).toBeNull();
  });
});

describe('normalizeThesisOptions', () => {
  it('maps "The Mirror" style labels onto the enum and caps at three', () => {
    const out = normalizeThesisOptions({
      options: [
        { type: 'The Mirror', description: 'd1', thesis: 't1' },
        { type: 'THE PIVOT', description: 'd2', thesis: 't2' },
        { type: 'Risk', description: 'd3', thesis: 't3' },
        { type: 'mirror', description: 'd4', thesis: 't4' },
      ],
    });
    expect(out.map((o) => o.type)).toEqual(['mirror', 'pivot', 'risk']);
  });

  it('assigns positional types when labels are junk and drops thesis-less options', () => {
    const out = normalizeThesisOptions([
      { type: '??', thesis: 'a' },
      { type: '??', thesis: 'b' },
      { type: '??', description: 'no thesis' },
    ]);
    expect(out.map((o) => o.type)).toEqual(['mirror', 'pivot']);
  });
});

describe('normalizeRoadmaps', () => {
  it('accepts outline as an array or a bulleted blob and titles untitled roadmaps', () => {
    const out = normalizeRoadmaps({
      roadmaps: [
        { title: 'Front-load the thesis', summary: 's1', outline: ['move ¶4 first', 'cut ¶7'] },
        { summary: 's2', outline: '- step one\n- step two' },
      ],
    });
    expect(out[0].outline).toEqual(['move ¶4 first', 'cut ¶7']);
    expect(out[1].title).toBe('Roadmap 2');
    expect(out[1].outline).toEqual(['step one', 'step two']);
  });
});

describe('normalizeDoctorTasks', () => {
  it('keeps every task, clamps out-of-range ¶ numbers, and derives anchors', () => {
    const out = normalizeDoctorTasks(
      {
        tasks: [
          { text: 'Combine paragraphs 2 and 3.', paragraphNumbers: [2, 3, 99] },
          { text: 'Write a new conclusion.', paragraphNumbers: [] },
          'Bare string task survives too.',
        ],
      },
      blocks,
    );
    expect(out).toHaveLength(3);
    expect(out[0].paragraphNumbers).toEqual([2, 3]); // 99 discarded, task kept
    expect(out[0].anchors).toEqual([anchorFor(blocks[1].text), anchorFor(blocks[2].text)]);
    expect(out[1].paragraphNumbers).toEqual([]);
    expect(out[2].text).toBe('Bare string task survives too.');
    expect(out.map((t) => t.id)).toEqual(['task-0', 'task-1', 'task-2']);
    expect(out.every((t) => t.done === false)).toBe(true);
  });
});

describe('extractCriticalIssue', () => {
  it('pulls the last "The most critical issue is…" run', () => {
    const prose = [
      'Thinking step by step…',
      'The most critical issue is a red herring early on.',
      '',
      'On reflection, weighing the table again:',
      'The most critical issue is that the argument veers off-topic after paragraph 4.',
    ].join('\n');
    expect(extractCriticalIssue(prose)).toBe(
      'The most critical issue is that the argument veers off-topic after paragraph 4.',
    );
  });

  it('falls back to the last non-empty line when the contract sentence is absent', () => {
    expect(extractCriticalIssue('some analysis\n\nfinal verdict line\n\n')).toBe('final verdict line');
    expect(extractCriticalIssue('')).toBe('');
  });
});

describe('formatOutlineData', () => {
  it('renders a deterministic markdown table with 1-based numbers and — for headings', () => {
    const table = formatOutlineData([
      { index: 0, kind: 'heading', claim: '## Introduction', justification: '' },
      { index: 1, kind: 'prose', claim: 'A | with pipe', verdict: 'weakly', justification: 'thin' },
    ]);
    expect(table).toContain('| Paragraph # | Claim | Supports Thesis? | Justification |');
    expect(table).toContain('| 1 | ## Introduction *(heading)* | — | |');
    expect(table).toContain('| 2 | A \\| with pipe | Weakly | thin |');
  });
});

describe('formatOutlineMarkdown', () => {
  it('leads with the thesis and cites bullets by [n]', () => {
    const md = formatOutlineMarkdown(
      [
        { index: 0, kind: 'heading', claim: '## Introduction' },
        { index: 1, kind: 'prose', claim: 'Claim A' },
        { index: 2, kind: 'prose', claim: '' },
      ],
      'The thesis.',
    );
    expect(md.startsWith('Thesis: The thesis.')).toBe(true);
    expect(md).toContain('- [2] Claim A');
    expect(md).toContain('- [3] (no distillation)');
  });
});

describe('checklistToMarkdown', () => {
  it('renders header, roadmap, and checkbox states', () => {
    const checklist: DoctorChecklist = {
      scopeKey: 'root',
      thesis: 'T',
      criticalIssue: 'The most critical issue is X.',
      roadmapTitle: 'Front-load the thesis',
      roadmapOutline: ['step one'],
      tasks: [
        { id: 'task-0', text: 'Do A', done: true, paragraphNumbers: [2], anchors: ['a'] },
        { id: 'task-1', text: 'Do B', done: false, paragraphNumbers: [], anchors: [] },
      ],
      createdAt: 0,
      sourceHash: 'h',
    };
    const md = checklistToMarkdown(checklist);
    expect(md).toContain('# Revision checklist');
    expect(md).toContain('Roadmap: Front-load the thesis');
    expect(md).toContain('- [x] Do A *(¶ 2)*');
    expect(md).toContain('- [ ] Do B');
  });
});
