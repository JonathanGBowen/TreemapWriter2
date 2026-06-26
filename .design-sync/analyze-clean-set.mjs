#!/usr/bin/env node
// Transitive import-graph taint analysis: which src component files can be bundled
// for the browser (no node:* / AI-SDK / vite `?raw` in their transitive closure).
// Run when the repo's components change, to recompute config.componentSrcMap.
//
//   node .design-sync/analyze-clean-set.mjs
//
// Prints CLEAN vs TAINTED components and writes .design-sync/.cache/clean-map.json
// (a {Name: srcPath} map ready to paste into config.json "componentSrcMap").
// NOTE: it excludes the 3 heavy bespoke-viz components (SprintEditor/WordsOverTimeChart
// blow the 5MB cap; Treemap is kept via the partial-plotly alias) — review HEAVY below.
import { readFileSync, existsSync, statSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const BAD_PKGS = new Set(['@anthropic-ai/sdk', '@google/genai']); // Node-targeted; use node:*
const HEAVY = new Set(['SprintEditor', 'WordsOverTimeChart']);    // drop: > 5MB upload cap

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== '__tests__' && e.name !== 'node_modules') out.push(...walk(p)); }
    else if (/\.(tsx?|jsx?)$/.test(e.name) && !/\.(test|spec|stories)\./.test(e.name)) out.push(p);
  }
  return out;
}
const files = walk(SRC);
const EXTS = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];
function resolveSpec(spec, from) {
  let base;
  if (spec.startsWith('@/')) base = join(ROOT, spec.slice(2));
  else if (spec.startsWith('./') || spec.startsWith('../')) base = resolve(dirname(from), spec);
  else return { kind: 'pkg', name: spec };
  for (const ext of EXTS) if (existsSync(base + ext) && statSync(base + ext).isFile()) return { kind: 'file', path: base + ext };
  return { kind: 'missing' };
}
// type-only imports (`import type …` / `export type …`) are elided by esbuild — skip them
const importRx = /(?:import|export)\s+([\s\S]*?)\s+from\s*['"]([^'"]+)['"]/g;
const dynRx = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
const graph = new Map(), breaker = new Map();
for (const f of files) {
  const txt = readFileSync(f, 'utf8'); const deps = new Set(); let reason = null; const specs = [];
  let m; importRx.lastIndex = 0;
  while ((m = importRx.exec(txt))) { const c = m[1].trimStart(); if (c === 'type' || c.startsWith('type ') || c.startsWith('type{')) continue; specs.push(m[2]); }
  dynRx.lastIndex = 0; while ((m = dynRx.exec(txt))) specs.push(m[1]);
  for (const mm of txt.matchAll(/import\s+['"]([^'"]+)['"]/g)) specs.push(mm[1]);
  for (const spec of specs) {
    if (/\?raw$/.test(spec)) { reason ??= `?raw (${spec.split('/').pop()})`; continue; }
    if (/^node:/.test(spec)) { reason ??= spec; continue; }
    const r = resolveSpec(spec, f);
    if (r.kind === 'file') deps.add(r.path);
    else if (r.kind === 'pkg') { const top = r.name.startsWith('@') ? r.name.split('/').slice(0, 2).join('/') : r.name.split('/')[0]; if (BAD_PKGS.has(top)) reason ??= top; }
  }
  graph.set(f, deps); breaker.set(f, reason);
}
const taint = new Map();
function tainted(f, stack = new Set()) {
  if (taint.has(f)) return taint.get(f);
  if (breaker.get(f)) { taint.set(f, breaker.get(f)); return breaker.get(f); }
  if (stack.has(f)) return null;
  stack.add(f); let why = null;
  for (const d of graph.get(f) || []) { const t = tainted(d, stack); if (t) { why = `${relative(SRC, d)} :: ${t}`; break; } }
  stack.delete(f); taint.set(f, why); return why;
}
for (const f of files) tainted(f);
const exportRx = /export\s+(?:async\s+)?(?:const|let|var|function|class)\s+([A-Z][A-Za-z0-9]*)/g;
const comps = [];
for (const f of files) { if (!/\.(tsx|jsx)$/.test(f)) continue; const txt = readFileSync(f, 'utf8'); for (const mm of txt.matchAll(exportRx)) comps.push({ name: mm[1], file: f }); }
const clean = comps.filter((c) => !taint.get(c.file) && !HEAVY.has(c.name));
const map = {};
for (const c of clean) map[c.name] = relative(ROOT, c.file);
mkdirSync(join(ROOT, '.design-sync/.cache'), { recursive: true });
writeFileSync(join(ROOT, '.design-sync/.cache/clean-map.json'), JSON.stringify(map, null, 2) + '\n');
console.log(`components: ${comps.length} | clean (shippable): ${Object.keys(map).length} | tainted: ${comps.length - clean.length}`);
console.log(`HEAVY excluded (review — Treemap is re-included via the partial-plotly alias): ${[...HEAVY].join(', ')}`);
console.log('wrote .design-sync/.cache/clean-map.json (paste into config.json componentSrcMap)');
