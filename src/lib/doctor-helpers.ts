// Pure helpers for the Reverse Outline Doctor's AI flows. No React, no store, no
// SDK — the AIProvider impls lean on these so they stay thin and testable.
// Mirrors lib/parallel-helpers.ts, whose contract these normalizers share: the
// model speaks in 1-based paragraph numbers ([1]…[N], the numbering the ported
// Prosthetic Logician prompts and the checklist tasks use), blocks are 0-based
// ParagraphBlock indices, and a row is NEVER dropped — a missed prose block comes
// back blank for the UI to flag, a non-prose block is echoed verbatim (it is its
// own distillation; never trust the model to restate a heading).

import type {
  CoherenceRow,
  DoctorChecklist,
  DoctorOutlineRow,
  DoctorTask,
  DoctorVerdict,
  FunctionalOutlineRow,
  ParagraphDiagnosis,
  RoadmapOption,
  ThesisOption,
} from '../types';
import type { ParagraphBlock } from './paragraph-helpers';
import { anchorFor } from './paragraph-helpers';

type Blockish = Pick<ParagraphBlock, 'index' | 'text' | 'kind'>;

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

const pickRaw = (o: Record<string, unknown>, keys: string[]): unknown => {
  for (const k of keys) if (o[k] != null) return o[k];
  return undefined;
};
const pickStr = (o: Record<string, unknown>, keys: string[]): string => str(pickRaw(o, keys)).trim();

/** Pull the result array out of whatever envelope the model returned. */
const extractArray = (raw: unknown, keys: string[]): unknown[] | null => {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    for (const key of keys) if (Array.isArray(o[key])) return o[key] as unknown[];
  }
  return null;
};

/** Index model rows by their 1-based paragraph number ("para"/"index"/"n"). */
const rowsByNumber = (raw: unknown, envelopeKeys: string[]): Map<number, Record<string, unknown>> => {
  const arr = extractArray(raw, envelopeKeys) ?? [];
  const byNum = new Map<number, Record<string, unknown>>();
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const n = Number(pickRaw(o, ['para', 'index', 'paragraph', 'n', 'i']));
    if (Number.isInteger(n) && n >= 1 && !byNum.has(n)) byNum.set(n, o);
  }
  return byNum;
};

/** Reverse outline (claims): one ≤70-char claim per prose block; non-prose echoed. */
export const normalizeClaimRows = (raw: unknown, blocks: Blockish[]): DoctorOutlineRow[] => {
  const byNum = rowsByNumber(raw, ['rows', 'claims', 'outline', 'bullets']);
  return blocks.map((b) => ({
    index: b.index,
    kind: b.kind,
    claim:
      b.kind === 'prose'
        ? pickStr(byNum.get(b.index + 1) ?? {}, ['claim', 'summary', 'sentence', 'text'])
        : b.text.trim(),
  }));
};

/** Functional Reverse Outline: Says/Does per prose block; non-prose echoed as Says. */
export const normalizeSaysDoesRows = (raw: unknown, blocks: Blockish[]): FunctionalOutlineRow[] => {
  const byNum = rowsByNumber(raw, ['rows', 'outline', 'table']);
  return blocks.map((b) => {
    if (b.kind !== 'prose') return { index: b.index, kind: b.kind, says: b.text.trim(), does: '' };
    const o = byNum.get(b.index + 1) ?? {};
    return {
      index: b.index,
      kind: b.kind,
      says: pickStr(o, ['says', 'say', 'content', 'summary']),
      does: pickStr(o, ['does', 'do', 'function', 'role']),
    };
  });
};

const VERDICTS: DoctorVerdict[] = ['yes', 'no', 'weakly'];

/** Coerce a model verdict string ("Yes", "WEAKLY", junk…) to the enum, or undefined. */
export const coerceVerdict = (v: unknown): DoctorVerdict | undefined => {
  const s = str(v).trim().toLowerCase();
  return (VERDICTS as string[]).includes(s) ? (s as DoctorVerdict) : undefined;
};

/** Thesis Coherence Check: claim + verdict + justification per prose block. */
export const normalizeCoherenceRows = (raw: unknown, blocks: Blockish[]): CoherenceRow[] => {
  const byNum = rowsByNumber(raw, ['rows', 'checks', 'claims', 'table']);
  return blocks.map((b) => {
    if (b.kind !== 'prose')
      return { index: b.index, kind: b.kind, claim: b.text.trim(), justification: '' };
    const o = byNum.get(b.index + 1) ?? {};
    const claim = pickStr(o, ['claim', 'summary', 'text']);
    return {
      index: b.index,
      kind: b.kind,
      claim,
      // A missed row keeps verdict undefined alongside its '' claim — flagged, not judged.
      verdict: claim ? coerceVerdict(pickRaw(o, ['verdict', 'supports', 'supportsThesis'])) : undefined,
      justification: pickStr(o, ['justification', 'reason', 'why']),
    };
  });
};

/** Single-paragraph Saying-vs-Doing. Null ⇒ unusable (caller toasts, never blanks). */
export const normalizeParagraphDiagnosis = (raw: unknown): ParagraphDiagnosis | null => {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!o) return null;
  const says = pickStr(o, ['says', 'say', 'content']);
  const does = pickStr(o, ['does', 'do', 'function']);
  if (!says && !does) return null;
  return { says, does, coherence: pickStr(o, ['coherence', 'coherenceCheck', 'check']) };
};

const THESIS_TYPES = ['mirror', 'pivot', 'risk'] as const;

/** Thesis Distiller: tolerate 1–3 options; "The Mirror"/"MIRROR"/… map to the enum. */
export const normalizeThesisOptions = (raw: unknown): ThesisOption[] => {
  const arr = extractArray(raw, ['options', 'theses', 'candidates']) ?? [];
  const out: ThesisOption[] = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const thesis = pickStr(o, ['thesis', 'statement', 'text']);
    if (!thesis) continue;
    const label = pickStr(o, ['type', 'label', 'name']).toLowerCase();
    const type = THESIS_TYPES.find((t) => label.includes(t)) ?? THESIS_TYPES[out.length] ?? 'mirror';
    out.push({ type, description: pickStr(o, ['description', 'gloss']), thesis });
    if (out.length === 3) break;
  }
  return out;
};

/** Rescue roadmaps: tolerate 2–3; outline lines may arrive as an array or one blob. */
export const normalizeRoadmaps = (raw: unknown): RoadmapOption[] => {
  const arr = extractArray(raw, ['roadmaps', 'options', 'strategies']) ?? [];
  const out: RoadmapOption[] = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const rawOutline = pickRaw(o, ['outline', 'steps', 'plan']);
    const outline = Array.isArray(rawOutline)
      ? rawOutline.map((l) => str(l).trim()).filter(Boolean)
      : str(rawOutline)
          .split('\n')
          .map((l) => l.replace(/^\s*[-*•]\s*/, '').trim())
          .filter(Boolean);
    const title = pickStr(o, ['title', 'name']);
    const summary = pickStr(o, ['summary', 'strategy', 'description']);
    if (!title && !summary && outline.length === 0) continue;
    out.push({ title: title || `Roadmap ${out.length + 1}`, summary, outline });
    if (out.length === 3) break;
  }
  return out;
};

/**
 * Revision checklist tasks. A task is NEVER dropped: an out-of-range paragraph
 * number is discarded (its anchor with it) but the task text survives. Ids are
 * positional — the checklist is replaced whole on regeneration, never merged.
 */
export const normalizeDoctorTasks = (raw: unknown, blocks: Blockish[]): DoctorTask[] => {
  const arr = extractArray(raw, ['tasks', 'todo', 'todos', 'items']) ?? [];
  const out: DoctorTask[] = [];
  for (const item of arr) {
    let text = '';
    let numbers: number[] = [];
    if (typeof item === 'string') {
      text = item.trim();
    } else if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>;
      text = pickStr(o, ['text', 'task', 'description']);
      const rawNums = pickRaw(o, ['paragraphNumbers', 'paragraphs', 'paras']);
      if (Array.isArray(rawNums)) {
        numbers = rawNums
          .map((n) => Number(n))
          .filter((n) => Number.isInteger(n) && n >= 1 && n <= blocks.length);
      }
    }
    if (!text) continue;
    out.push({
      id: `task-${out.length}`,
      text,
      done: false,
      paragraphNumbers: numbers,
      anchors: numbers.map((n) => anchorFor(blocks[n - 1].text)),
    });
  }
  return out;
};

/**
 * Pull the diagnosed critical issue out of the streamed step-3 prose: the last
 * sentence beginning "The most critical issue is…" (the prompt's contract), else
 * the last non-empty line. Heuristic on purpose — the field is user-editable.
 */
export const extractCriticalIssue = (prose: string): string => {
  const matches = prose.match(/The most critical issue is[^]*?(?=\n\s*\n|$)/gi);
  if (matches && matches.length > 0) return matches[matches.length - 1].trim();
  const lines = prose
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  return lines[lines.length - 1] ?? '';
};

const verdictCell = (v: DoctorVerdict | undefined): string =>
  v ? v.charAt(0).toUpperCase() + v.slice(1) : '—';

const tableCell = (s: string): string => s.replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim();

/**
 * The wizard's threaded `outlineData`: the coherence table as deterministic
 * markdown, re-fed at every downstream step exactly as the legacy chain did.
 */
export const formatOutlineData = (rows: CoherenceRow[]): string => {
  const lines = [
    '| Paragraph # | Claim | Supports Thesis? | Justification |',
    '|---|---|---|---|',
  ];
  for (const r of rows) {
    if (r.kind !== 'prose') {
      lines.push(`| ${r.index + 1} | ${tableCell(r.claim)} *(${r.kind})* | — | |`);
      continue;
    }
    lines.push(
      `| ${r.index + 1} | ${tableCell(r.claim)} | ${verdictCell(r.verdict)} | ${tableCell(r.justification)} |`,
    );
  }
  return lines.join('\n');
};

/** The reverse outline as markdown — the input the report instruments read. */
export const formatOutlineMarkdown = (rows: DoctorOutlineRow[], thesis: string): string => {
  const lines: string[] = [];
  if (thesis.trim()) lines.push(`Thesis: ${thesis.trim()}`, '');
  for (const r of rows) {
    if (r.kind === 'heading') lines.push('', r.claim, '');
    else lines.push(`- [${r.index + 1}] ${r.claim || '(no distillation)'}`);
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};

/** The checklist as downloadable markdown (`- [ ]` / `- [x]`). */
export const checklistToMarkdown = (checklist: DoctorChecklist): string => {
  const lines = [
    '# Revision checklist',
    '',
    `Thesis: ${checklist.thesis}`,
    '',
    `Critical issue: ${checklist.criticalIssue}`,
    '',
    `Roadmap: ${checklist.roadmapTitle}`,
    ...checklist.roadmapOutline.map((l) => `- ${l}`),
    '',
    '## Tasks',
    '',
    ...checklist.tasks.map((t) => {
      const paras = t.paragraphNumbers.length ? ` *(¶ ${t.paragraphNumbers.join(', ')})*` : '';
      return `- [${t.done ? 'x' : ' '}] ${t.text}${paras}`;
    }),
    '',
  ];
  return lines.join('\n');
};
