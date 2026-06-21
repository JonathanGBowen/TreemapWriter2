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
    files: ['**/*.test.ts', '**/*.test.tsx', '**/__tests__/**'],
    rules: {
      'max-lines-per-function': 'off',
    },
  },
);
