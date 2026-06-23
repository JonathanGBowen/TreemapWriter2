import { describe, expect, it } from 'vitest';
import { buildProjectExport } from '../projectExport';

describe('buildProjectExport', () => {
  it('emits the sparse per-project prompts override, not the resolved config', () => {
    // The override is the delta the user actually changed on this project; the
    // resolved config additionally folds in this machine's global tier and must
    // NOT be what gets written, or a re-import could never inherit a different
    // machine's globals.
    const override = { interpolationPrompt: 'custom only here' };

    const out = buildProjectExport({
      projectName: 'P',
      markdown: '# committed',
      localContent: '# live draft',
      testSuite: {},
      hiddenSectionIds: [],
      activePersonaId: 'default',
      customPersonas: [],
      projectPromptsOverride: override,
      modelConfig: { default: 'claude' },
      cachedCoachAdvice: null,
      revisions: [],
    } as unknown as Parameters<typeof buildProjectExport>[0]);

    expect(out.promptsConfig).toBe(override);
    // localDraft mirrors the live buffer; markdown is the committed copy.
    expect(out.localDraft).toBe('# live draft');
    expect(out.markdown).toBe('# committed');
    // modelsConfig is carried for round-trip parity with saveCurrentState.
    expect(out.modelsConfig).toEqual({ default: 'claude' });
  });
});
