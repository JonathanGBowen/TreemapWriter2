/**
 * Lightweight CSL-JSON → source importer for the Glass Box.
 *
 * Zotero exports a collection losslessly as CSL-JSON (right-click → Export →
 * "CSL JSON"); because that is plain JSON we need no parser dependency. Each
 * reference becomes one ephemeral SourceDocument whose `content` is an
 * APA-formatted entry (plus the abstract, when present) — exactly the shape the
 * Citations-mode prompt expects for its `## References` section and its APA
 * audit, which otherwise *infers* Author/Year from the source label (see
 * src/services/prompts/citations-task.md). No network, no keyring, no persistence.
 *
 * Fidelity is deliberately minimal: author / year / title / container or
 * publisher / volume·issue·page / DOI-or-URL. Edge cases beyond that (editions,
 * elaborate n.d. rules, hyphenated-given initials) are out of scope by design.
 */

/** A CSL-JSON name: structured (family/given) or an organisation `literal`. */
interface CslName {
  family?: string;
  given?: string;
  literal?: string;
}

/** The subset of CSL-JSON fields we read. Everything else is ignored. */
interface CslItem {
  author?: CslName[];
  editor?: CslName[];
  issued?: { 'date-parts'?: Array<Array<string | number>> };
  title?: string;
  'container-title'?: string;
  publisher?: string;
  volume?: string | number;
  issue?: string | number;
  page?: string | number;
  DOI?: string;
  URL?: string;
  abstract?: string;
  /** Better-BibTeX CSL exports use this instead of the CSL-standard `abstract`. */
  abstractNote?: string;
}

/** A normalised reference, ready to become a SourceDocument. */
export interface ParsedReference {
  /** In-text citation stem, e.g. "Dewey", "Dewey & Bentley", "Dewey et al.". */
  labelStem: string;
  /** Four-digit year, or "n.d." when absent. */
  year: string;
  /** A single-line APA reference-list entry. */
  apa: string;
  /** The abstract, when the export carried one. */
  abstract?: string;
}

const str = (v: unknown): string => (v == null ? '' : String(v).trim());

/** "John Paul" → "J. P." (APA initials). */
function initials(given: string): string {
  return given
    .split(/[\s.]+/)
    .filter(Boolean)
    .map((part) => `${part[0].toUpperCase()}.`)
    .join(' ');
}

/** One name in APA reference form: "Dewey, J." or an organisation literal. */
function nameApa(n: CslName): string {
  if (n.literal) return str(n.literal);
  const family = str(n.family);
  const given = str(n.given);
  if (!family) return given;
  return given ? `${family}, ${initials(given)}` : family;
}

/** The full author list in APA form: "Dewey, J., & Bentley, A. F.". */
function authorsApa(names: CslName[]): string {
  const parts = names.map(nameApa).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')}, & ${parts[parts.length - 1]}`;
}

/** The in-text stem: one surname, "A & B", or "A et al." for three or more. */
function authorStem(names: CslName[]): string {
  const stems = names.map((n) => str(n.literal) || str(n.family) || str(n.given)).filter(Boolean);
  if (stems.length === 0) return '';
  if (stems.length === 1) return stems[0];
  if (stems.length === 2) return `${stems[0]} & ${stems[1]}`;
  return `${stems[0]} et al.`;
}

function yearOf(item: CslItem): string {
  return str(item.issued?.['date-parts']?.[0]?.[0]) || 'n.d.';
}

/** Assemble one APA reference-list line. Minimal but faithful for the common shapes. */
function formatApa(item: CslItem, names: CslName[], year: string): string {
  const authors = authorsApa(names);
  const title = str(item.title) || 'Untitled';

  // Source segment: a journal (with volume/issue/pages) or a book publisher.
  let source = '';
  const container = str(item['container-title']);
  if (container) {
    source = container;
    if (str(item.volume)) source += `, ${str(item.volume)}`;
    if (str(item.issue)) source += `(${str(item.issue)})`;
    if (str(item.page)) source += `, ${str(item.page)}`;
  } else {
    source = str(item.publisher);
  }

  const doi = str(item.DOI);
  const link = doi
    ? `https://doi.org/${doi.replace(/^https?:\/\/doi\.org\//i, '')}`
    : str(item.URL);

  const head = authors ? `${authors} (${year}). ${title}.` : `${title}. (${year}).`;
  const segments = [head];
  if (source) segments.push(`${source}.`);
  if (link) segments.push(link);
  return segments.join(' ').replace(/\s+/g, ' ').trim();
}

/** Normalise the parsed JSON to a list of candidate items (array, single, or none). */
function toItems(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  return data && typeof data === 'object' ? [data] : [];
}

/** The chip stem: author surname(s), else the first words of the title, else "Untitled". */
function stemOf(item: CslItem, names: CslName[]): string {
  return authorStem(names) || str(item.title).split(/\s+/).slice(0, 3).join(' ') || 'Untitled';
}

/**
 * Parse a CSL-JSON export (an array of items, or a single item) into normalised
 * references. Tolerant by design: invalid JSON yields `[]`, and a malformed item
 * is skipped rather than sinking the whole import.
 */
export function parseCslJson(raw: string): ParsedReference[] {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }

  const refs: ParsedReference[] = [];
  for (const entry of toItems(data)) {
    try {
      if (!entry || typeof entry !== 'object') continue;
      const item = entry as CslItem;
      const names = (item.author?.length ? item.author : item.editor) ?? [];
      const year = yearOf(item);
      refs.push({
        labelStem: stemOf(item, names),
        year,
        apa: formatApa(item, names, year),
        abstract: str(item.abstract) || str(item.abstractNote) || undefined,
      });
    } catch {
      // Skip a malformed item rather than fail the whole import.
    }
  }
  return refs;
}

/** The `content` body for a source chip: the APA line, then the abstract if present. */
export function referenceToSourceContent(ref: ParsedReference): string {
  return ref.abstract ? `${ref.apa}\n\nABSTRACT\n${ref.abstract}` : ref.apa;
}
