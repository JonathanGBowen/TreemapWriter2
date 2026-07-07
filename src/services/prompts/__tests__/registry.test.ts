import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROMPTS_CONFIG,
  resolvePromptsConfig,
  normalizePromptsConfig,
  diffPromptsConfig,
  promptSource,
  interpolate,
  renderPrompt,
  PROMPT_REGISTRY,
  getPromptText,
} from '..';
import type { PromptsConfig } from '../../../types';

// The historical, persisted editable keys. If this set ever changes, old
// project files (keyed by these names) silently fall back to defaults — so any
// rename must be a deliberate, reviewed migration, not an accident.
const HISTORICAL_KEYS = [
  'analysisPrompt',
  'coachPrompt',
  'compareVersionsPrompt',
  // Spec-anchored A/B whole-test — part-level + whole-level editable prompts.
  'specTestPrompt',
  'specTestWholePrompt',
  'dependenciesPrompt',
  'diagnosticInstruction',
  'dialoguePrompt',
  'directiveDialoguePrompt',
  'generatePersonasPrompt',
  'generateRevisionsPrompt',
  // Parallel Editor (reverse-outline revision) — two new editable flows.
  'generateReverseOutlinePrompt',
  'regenerateParagraphPrompt',
  // Gestalt whole/part ops (Phase 2) — Beethoven test + recentering.
  'reconstructWholePrompt',
  'recenterPrompt',
  // Gist Editor — the two generation stages (analysis + composition).
  'gistAnalysisPrompt',
  'gistCompositionPrompt',
  'generateSprintPlanPrompt',
  // Sprint coach start protocol (2026-06-21) — conversational goal-setting + Goblin breakdown.
  'sprintCoachPrompt',
  'decomposeStepPrompt',
  'l1TaskInstruction',
  'refactorAnalysisPrompt',
  'refineSpecPrompt',
  // Generate-Specs workspace (collaborative per-level co-development) — 2026-06-22.
  'developSpecPrompt',
  // Gestalt segmentation / Articulation (2026-06-29) — four editable prompts.
  'segmentSystemInstruction',
  'segmentLevelTask',
  'segmentCritiqueTask',
  'segmentSummaryTask',
  // StructuralPart discovery (2026-07-01) — the whole-document sibling of Articulation.
  'discoverStructuralPartsPrompt',
  'rootTaskInstruction',
  'subTaskInstruction',
  'suggestContentPrompt',
  'systemInstruction',
  // Climate Artist suite (2026-06-18) — atmospheric analysis instruments.
  'weatherReportPrompt',
  'radarScanPrompt',
  'stormSpotterPrompt',
  'forecastPrompt',
].sort();

// Locked engine internals — catalogued but never persisted / user-editable.
const LOCKED_KEYS = [
  'revisionAssemblySystem',
  'revisionTask',
  'revisionAssemblyVerbatimTask',
  'revisionAssemblyWovenTask',
  'revisionTaskSourceless',
  'revisionInstructionDefault',
  'citationsSystem',
  'citationsTask',
  'suggestDirectivesTemplate',
  // Parallel Editor — the shipped default voice instruction (locked).
  'regenerateVoiceDefault',
  // Gist Editor — single-span refresh + re-fit (engine internals, locked).
  'gistRefreshSpanPrompt',
  'gistRefitPrompt',
];

describe('DEFAULT_PROMPTS_CONFIG (derived from the registry)', () => {
  it('has exactly the historical editable keys (guards against key drift)', () => {
    expect(Object.keys(DEFAULT_PROMPTS_CONFIG).sort()).toEqual(HISTORICAL_KEYS);
  });

  it('excludes every locked engine-internal prompt', () => {
    for (const key of LOCKED_KEYS) {
      expect(key in DEFAULT_PROMPTS_CONFIG).toBe(false);
    }
  });

  it('mirrors each editable entry default, with no trailing newline', () => {
    for (const entry of PROMPT_REGISTRY) {
      if (entry.editability !== 'editable') continue;
      const value = (DEFAULT_PROMPTS_CONFIG as Record<string, string>)[entry.key];
      expect(value).toBe(entry.defaultText);
      expect(value).not.toMatch(/\n$/);
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it('exposes locked prompt text via getPromptText', () => {
    for (const key of LOCKED_KEYS) {
      expect(getPromptText(key).length).toBeGreaterThan(0);
    }
    expect(() => getPromptText('nope')).toThrow(/Unknown prompt key/);
  });
});

describe('three-tier resolution', () => {
  it('layers project over global over built-in defaults', () => {
    const global: Partial<PromptsConfig> = {
      coachPrompt: 'GLOBAL_COACH',
      analysisPrompt: 'GLOBAL_ANALYSIS',
    };
    const project: Partial<PromptsConfig> = { coachPrompt: 'PROJECT_COACH' };
    const resolved = resolvePromptsConfig(project, global);

    expect(resolved.coachPrompt).toBe('PROJECT_COACH'); // project wins
    expect(resolved.analysisPrompt).toBe('GLOBAL_ANALYSIS'); // global shows through
    expect(resolved.systemInstruction).toBe(DEFAULT_PROMPTS_CONFIG.systemInstruction); // default
  });

  it('normalizePromptsConfig is the two-tier (defaults <- raw) special case', () => {
    expect(normalizePromptsConfig({ coachPrompt: 'X' }).coachPrompt).toBe('X');
    expect(normalizePromptsConfig(undefined)).toEqual(DEFAULT_PROMPTS_CONFIG);
  });

  it('round-trips a full legacy blob through diff (uncustomized collapses to {})', () => {
    // A legacy full blob equal to defaults yields an empty override...
    expect(diffPromptsConfig({ ...DEFAULT_PROMPTS_CONFIG }, DEFAULT_PROMPTS_CONFIG)).toEqual({});
    // ...while a genuinely customized field is preserved.
    const legacy = { ...DEFAULT_PROMPTS_CONFIG, coachPrompt: 'CUSTOM' };
    expect(diffPromptsConfig(legacy, DEFAULT_PROMPTS_CONFIG)).toEqual({ coachPrompt: 'CUSTOM' });
  });
});

describe('promptSource (badge provenance)', () => {
  it('reports project over global over default', () => {
    const global = { coachPrompt: 'G', analysisPrompt: 'G' };
    const project = { coachPrompt: 'P' };
    expect(promptSource('coachPrompt', project, global)).toBe('project');
    expect(promptSource('analysisPrompt', project, global)).toBe('global');
    expect(promptSource('systemInstruction', project, global)).toBe('default');
  });

  it('treats a missing/empty tier as not owning the value', () => {
    expect(promptSource('coachPrompt', {}, {})).toBe('default');
    expect(promptSource('coachPrompt', null, { coachPrompt: 'G' })).toBe('global');
    // In global-editing scope the project tier is passed as undefined.
    expect(promptSource('coachPrompt', undefined, { coachPrompt: 'G' })).toBe('global');
  });
});

describe('interpolation', () => {
  it('replaces every occurrence of a token', () => {
    expect(interpolate('{{A}} {{A}} {{B}}', { A: 'x', B: 'y' })).toBe('x x y');
  });

  it('throws when a referenced token has no value', () => {
    expect(() => interpolate('{{A}}', {})).toThrow(/no value supplied/);
  });

  it('renderPrompt validates required variables against the registry', () => {
    expect(() =>
      renderPrompt('suggestDirectivesTemplate', { PERSONA_NAME: 'x' }),
    ).toThrow(/missing required variable/);

    const out = renderPrompt('suggestDirectivesTemplate', {
      PERSONA_NAME: 'Reviewer',
      PERSONA_DESCRIPTION: 'A careful reader.',
      SOURCE_CONTEXT_INSTRUCTION: 'No sources.',
    });
    expect(out).toContain('Reviewer');
    expect(out).not.toMatch(/\{\{[A-Z_]+\}\}/); // no leftover tokens
  });
});
