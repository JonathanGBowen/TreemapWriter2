import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Default to the fast `node` env. DOM-needing tests opt in per-file with a
    // `// @vitest-environment jsdom` pragma so the bulk of the suite stays quick.
    environment: 'node',
    include: [
      'src/**/__tests__/**/*.test.ts',
      'src/**/__tests__/**/*.test.tsx',
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
    ],
    reporters: 'default',
    coverage: {
      provider: 'v8',
      reporters: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**'],
      exclude: [
        'src/**/__tests__/**',
        'src/**/*.test.{ts,tsx}',
        'src/**/*.d.ts',
        // Type-only module: no executable logic to cover.
        'src/types/**',
      ],
      // Floor thresholds: set at/below the measured baseline so the gate can
      // only ratchet up. Raise these as coverage grows.
      thresholds: {
        lines: 17,
        functions: 14,
        statements: 17,
        branches: 15,
      },
    },
  },
});
