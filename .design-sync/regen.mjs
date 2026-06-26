#!/usr/bin/env node
// Regenerates the gitignored build aids the design-sync converter needs, from the
// committed config. Run once after a fresh clone (and whenever componentSrcMap or
// src/index.css changes), BEFORE package-build / resync. See NOTES.md.
//
//   node .design-sync/regen.mjs
//
// Produces under .design-sync/.cache/ (gitignored): ds-entry.tsx (the curated
// barrel), global-polyfill.js, plotly-treemap.mjs, tsconfig.ds.json, compiled.css.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..'); // repo root
const CACHE = resolve(ROOT, '.design-sync/.cache');
mkdirSync(CACHE, { recursive: true });
const cfg = JSON.parse(readFileSync(resolve(ROOT, '.design-sync/config.json'), 'utf8'));

// 1. global polyfill — plotly's source references a bare Node `global`
writeFileSync(resolve(CACHE, 'global-polyfill.js'),
  `// design-sync build aid: define Node's \`global\` for the browser IIFE. Plotly's
// source (pulled by the partial plotly shim) references a bare \`global\`; without
// this the bundle throws "global is not defined" and every preview renders blank.
globalThis.global = globalThis;
`);

// 2. partial plotly (core + treemap trace only) — keeps the namesake Treemap < 5MB
writeFileSync(resolve(CACHE, 'plotly-treemap.mjs'),
  `// design-sync build aid: a partial plotly bundle (core + treemap trace only),
// aliased in for \`plotly.js-dist-min\` so the namesake Treemap component ships
// without the full ~4.8MB plotly dist. Renders treemap traces identically.
import Plotly from 'plotly.js/lib/core';
import treemap from 'plotly.js/lib/treemap';
Plotly.register([treemap]);
export default Plotly;
`);

// 3. standalone tsconfig for the converter: @/ alias + plotly partial alias
writeFileSync(resolve(CACHE, 'tsconfig.ds.json'),
  `{
  "compilerOptions": {
    "baseUrl": "../..",
    "jsx": "react-jsx",
    "paths": {
      "@/*": ["./*"],
      "plotly.js-dist-min": [".design-sync/.cache/plotly-treemap.mjs"]
    }
  }
}
`);

// 4. curated barrel: polyfill imported FIRST (eval order), then export* per file
const files = [...new Set(Object.values(cfg.componentSrcMap))].sort();
const barrel = ['import ' + JSON.stringify(resolve(CACHE, 'global-polyfill.js')) + ';',
  ...files.map((f) => 'export * from ' + JSON.stringify(resolve(ROOT, f)) + ';')].join('\n') + '\n';
writeFileSync(resolve(CACHE, 'ds-entry.tsx'), barrel);

// 5. compiled Tailwind v4 CSS (cfg.cssEntry) — the HLD tokens + classes + utilities
execSync(`npx --yes @tailwindcss/cli@4 -i ${resolve(ROOT, 'src/index.css')} -o ${resolve(CACHE, 'compiled.css')}`,
  { stdio: 'inherit', cwd: ROOT });

console.log(`regenerated build aids in .design-sync/.cache/ from config (${files.length} component files)`);
