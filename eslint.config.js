import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // agent-sidecar is a standalone Node package (its own deps, its own runtime);
    // it is linted/typechecked separately, not by the webview's config.
    ignores: ['dist', 'node_modules', 'src-tauri/target', 'coverage', 'agent-sidecar'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      // The cognitive-budget rule. Files at or beyond this length should split.
      // Warn (not error) until existing files have been decomposed in Phase 1.
      'max-lines': ['warn', { max: 300, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['warn', { max: 80, skipBlankLines: true, skipComments: true }],
      complexity: ['warn', 12],

      // TypeScript ergonomics for a single-author project. Loosen later if
      // the team grows.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
  {
    // Design-system guardrail (the audit's "keep it honest" item): flag NEW
    // hard-coded hex colours so they can't re-drift past the token system —
    // use a `--color-hld-*` token (see src/index.css `@theme`) instead. Warn
    // (not error), matching the `max-lines` convention; the existing warnings
    // double as the remaining hex→token migration worklist. Pure white/black are
    // allowed (not palette inflation).
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/*.test.{ts,tsx}', 'src/**/__tests__/**'],
    rules: {
      'no-restricted-syntax': [
        'warn',
        {
          selector: 'Literal[value=/#(?!ffffff|000000)[0-9a-fA-F]{6}/]',
          message: 'Hard-coded hex colour — use a --color-hld-* design token (src/index.css @theme).',
        },
        {
          selector: 'TemplateElement[value.cooked=/#(?!ffffff|000000)[0-9a-fA-F]{6}/]',
          message: 'Hard-coded hex colour — use a --color-hld-* design token (src/index.css @theme).',
        },
      ],
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/__tests__/**'],
    rules: {
      'max-lines-per-function': 'off',
    },
  },
);
