// The local agent's bounded tool set.
//
// `buildToolRegistry` returns tools already bound to their deps (the Repository,
// the AIProvider, and a snapshot of the live document), so the loop only calls
// `tool.run(args)`. Three families:
//   * in-memory prose — read the whole document / a section / the outline. These
//     back the whole-text default; the model never needs to "search" for them.
//   * reach-beyond — files, AI-generated artifacts, manuscript search, and git
//     history. Per the Gestalt rule these are for going PAST the working text,
//     not for trimming it.
//   * routines — the app's existing structured-output methods (analyze_section,
//     run_diagnostic) exposed as tools that delegate to the AIProvider (their own
//     call kinds, so the loop can't recurse into itself).
//
// Filesystem-backed tools are included only on desktop (`enableFsTools`), so in
// the browser the model is never told about tools that can't work.

import type { Persona, Section, SectionSpec, PromptsConfig } from '../../../types';
import type { Repository } from '../../repository';
import type { AIProvider } from '../../ai-provider';
import { buildStructuralSurround, formatStructuralSurround } from '../../../lib/diagnostic-helpers';
import type { AgentTool } from './agent-types';

export interface ToolRegistryDeps {
  repository: Repository;
  aiProvider: AIProvider;
  /** Live document snapshot for the duration of one run. */
  sections: Section[];
  markdown: string;
  /** sectionId → spec (with `'root'` = the document spec). */
  specs: Record<string, SectionSpec | undefined>;
  config: PromptsConfig;
  /** Include filesystem + FTS tools (desktop only). */
  enableFsTools: boolean;
}

/** Cap on a single tool result, so one call can't blow the context window. */
const MAX_RESULT_CHARS = 20_000;

const clamp = (s: string): string =>
  s.length > MAX_RESULT_CHARS ? `${s.slice(0, MAX_RESULT_CHARS)}\n…(truncated)` : s;

function findById(nodes: Section[], id: string): Section | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const hit = findById(n.children, id);
    if (hit) return hit;
  }
  return null;
}

/** Resolve a section by id or, failing that, by exact/loose title match. */
function resolveSection(deps: ToolRegistryDeps, ref: unknown): Section | null {
  if (typeof ref !== 'string' || !ref) return null;
  const byId = findById(deps.sections, ref);
  if (byId) return byId;
  const wanted = ref.trim().toLowerCase();
  let found: Section | null = null;
  const walk = (nodes: Section[]) => {
    for (const n of nodes) {
      if (n.title.trim().toLowerCase() === wanted) found ??= n;
      walk(n.children);
    }
  };
  walk(deps.sections);
  return found;
}

const argString = (args: Record<string, unknown>, ...keys: string[]): string | undefined => {
  for (const k of keys) {
    const v = args[k];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return undefined;
};

/** A neutral persona for routine tools run by the agent (no human persona in scope). */
const AGENT_PERSONA: Persona = {
  id: 'agent',
  name: 'Agent',
  role: 'analyst',
  instruction: '',
};

export function buildToolRegistry(deps: ToolRegistryDeps): AgentTool[] {
  const tools: AgentTool[] = [];

  // --- in-memory prose (whole-text first) ---

  tools.push({
    name: 'read_document',
    description: 'Return the whole document (project.md) as markdown.',
    run: async () => clamp(deps.markdown),
  });

  tools.push({
    name: 'list_sections',
    description: 'List the document outline: each section id, title, level, and word count.',
    run: async () => {
      const rows: { id: string; title: string; level: number; wordCount: number }[] = [];
      const walk = (nodes: Section[]) => {
        for (const n of nodes) {
          rows.push({ id: n.id, title: n.title, level: n.level, wordCount: n.wordCount });
          walk(n.children);
        }
      };
      walk(deps.sections);
      return JSON.stringify(rows, null, 2);
    },
  });

  tools.push({
    name: 'read_section',
    description:
      "Read one section's full text (including its subsections) together with its structural surround — the part in its whole.",
    argsHint: '{ "sectionId": "<id or exact title>" }',
    run: async (args) => {
      const section = resolveSection(deps, argString(args, 'sectionId', 'id', 'title'));
      if (!section) return 'No section matched that id/title. Call list_sections to see valid ids.';
      const surround = formatStructuralSurround(
        buildStructuralSurround(section.id, deps.sections, deps.specs),
      );
      return clamp([`# ${section.title}`, section.fullContent, surround].filter(Boolean).join('\n\n'));
    },
  });

  // --- git history (works in both desktop + browser) ---

  tools.push({
    name: 'list_snapshots',
    description: 'List recent version-history snapshots (git commits), newest first.',
    argsHint: '{ "limit": <number, optional> }',
    run: async (args) => {
      const limit = typeof args.limit === 'number' ? args.limit : 20;
      const metas = await deps.repository.listSnapshotMeta(limit);
      const rows = metas.map((m) => ({
        id: m.id,
        timestamp: m.timestamp,
        trigger: m.trigger,
        message: m.message,
      }));
      return JSON.stringify(rows, null, 2);
    },
  });

  tools.push({
    name: 'read_snapshot',
    description: 'Read one snapshot by id (from list_snapshots): returns its full markdown.',
    argsHint: '{ "id": "<snapshot id>" }',
    run: async (args) => {
      const id = argString(args, 'id', 'snapshotId');
      if (!id) return 'Provide a snapshot id (see list_snapshots).';
      const snap = await deps.repository.readSnapshot(id);
      if (!snap) return `Snapshot ${id} not found or unreadable.`;
      return clamp(snap.markdown);
    },
  });

  // --- reach-beyond: filesystem + manuscript search (desktop only) ---

  if (deps.enableFsTools) {
    tools.push({
      name: 'search_manuscript',
      description:
        'Full-text search across the manuscript to LOCATE where something is discussed (not to assemble the working text, which you already have). Returns ranked hits.',
      argsHint: '{ "query": "<terms>", "limit": <number, optional> }',
      run: async (args) => {
        const query = argString(args, 'query', 'q') ?? '';
        if (!query) return 'Provide a search query.';
        const limit = typeof args.limit === 'number' ? args.limit : 10;
        const hits = await deps.repository.searchSections(query, limit);
        return JSON.stringify(hits, null, 2);
      },
    });

    tools.push({
      name: 'list_files',
      description:
        'List readable project files (paths relative to the project root), including AI-generated artifacts under .twriter/.',
      argsHint: '{ "subdir": "<relative dir, optional>" }',
      run: async (args) => {
        const subdir = argString(args, 'subdir', 'dir');
        const entries = await deps.repository.agentListFiles(subdir);
        return JSON.stringify(entries, null, 2);
      },
    });

    tools.push({
      name: 'repo_read',
      description:
        'Read one text file anywhere under the project root (e.g. an artifact in .twriter/agent-output or a spec sidecar).',
      argsHint: '{ "path": "<relative path>" }',
      run: async (args) => {
        const path = argString(args, 'path', 'file');
        if (!path) return 'Provide a relative file path.';
        return clamp(await deps.repository.agentReadFile(path));
      },
    });

    tools.push({
      name: 'write_output',
      description:
        'Write a file to the agent scratch area (.twriter/agent-output/). This is the ONLY place you can write; you cannot modify project.md or specs. Returns the path written.',
      argsHint: '{ "name": "<filename>", "contents": "<text>" }',
      run: async (args) => {
        const name = argString(args, 'name', 'filename', 'path');
        const contents = typeof args.contents === 'string' ? args.contents : argString(args, 'content', 'text');
        if (!name) return 'Provide a filename.';
        if (typeof contents !== 'string') return 'Provide string contents to write.';
        const written = await deps.repository.agentWriteOutput(name, contents);
        return `Wrote ${written}`;
      },
    });
  }

  // --- routines: existing structured-output methods, exposed as tools ---

  tools.push({
    name: 'analyze_section',
    description:
      "Produce a structured exegetical reconstruction of a section (thesis, key concepts, argument premises/conclusion, objections), reading it in its structural surround.",
    argsHint: '{ "sectionId": "<id or exact title>" }',
    run: async (args) => {
      const section = resolveSection(deps, argString(args, 'sectionId', 'id', 'title'));
      if (!section) return 'No section matched that id/title. Call list_sections to see valid ids.';
      const structuralSurround = formatStructuralSurround(
        buildStructuralSurround(section.id, deps.sections, deps.specs),
      );
      const analysis = await deps.aiProvider.analyzeSection({
        sectionTitle: section.title,
        sectionText: section.fullContent,
        structuralSurround: structuralSurround || undefined,
        config: deps.config,
      });
      return JSON.stringify(analysis, null, 2);
    },
  });

  tools.push({
    name: 'run_diagnostic',
    description:
      "Diagnose a section against its spec: which required moves are present/partial/missing, coherence notes, and the next action. Requires the section to have a spec.",
    argsHint: '{ "sectionId": "<id or exact title>" }',
    run: async (args) => {
      const section = resolveSection(deps, argString(args, 'sectionId', 'id', 'title'));
      if (!section) return 'No section matched that id/title. Call list_sections to see valid ids.';
      const spec = deps.specs[section.id];
      if (!spec) return `Section "${section.title}" has no spec yet; cannot run a diagnostic.`;
      const result = await deps.aiProvider.runDiagnostic({
        section,
        spec,
        scope: 'segment',
        persona: AGENT_PERSONA,
        customInstruction: '',
        fullDocument: deps.markdown,
        sections: deps.sections,
        config: deps.config,
        findSection: findById,
        specs: deps.specs,
      });
      return JSON.stringify(result, null, 2);
    },
  });

  return tools;
}
