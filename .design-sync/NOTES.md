# design-sync NOTES — treemap-writer

Repo-specific gotchas for future syncs. Append as you learn more.

## What this repo is
- **An application** (Tauri + Vite + React 19 + Tailwind v4), NOT a packaged component
  library. `private: true`, no `main`/`module`/`exports`, no shipped `.d.ts`, no Storybook.
  → **package (non-storybook) shape**, run via a **curated barrel entry** (see below),
  NOT plain synth-entry.
- Distinctive embedded design system: the **"HLD"** layer — Tailwind v4 `@theme` tokens
  (`--color-hld-*`, `--text-ui-*`), a custom component-class layer in `src/index.css`
  (`hld-lit`, `hld-pip`, `hld-scanline`, `bracketed`, `hld-glow-*`, scrollbars…), Inter +
  JetBrains Mono fonts (`@fontsource/*`).

## Why we use a curated barrel entry (not synth `export *`)
- Plain synth-entry (`export *` from every `.tsx`) bundles the WHOLE app graph as one IIFE
  and **fails hard** — `@anthropic-ai/sdk` uses `node:fs`/`node:path` (Node-only), and
  `src/services/prompts/registry.ts` uses vite-only `*.md?raw` imports. esbuild
  (platform:browser, no `.md` loader, no `?raw` handling) cannot resolve either. The trial
  produced **70 errors**.
- The two real build-breakers, both on the store/state chain:
  1. `?raw`: `lib/constants.ts → services/prompts/index.ts → services/prompts/registry.ts → *.md?raw`
  2. AI SDKs: `state/ai-state.ts → services/ai/clients/* → @google/genai` (and `@anthropic-ai/sdk`)
  `store/index.ts` and `state/index.ts` pull BOTH, so ~85 of 127 components are tainted.
  NOTE: `types/index.ts` imports registry as **`import type`** (elided by esbuild) — that
  edge does NOT taint; only value-import chains do.
- The converter's `lib/bundle.mjs` esbuild config exposes no knob for loaders/externals,
  and the skill forbids forking `bundle.mjs`. So coupled screens are OUT OF SCOPE — and they
  would render blank anyway (they read live `useStore()` state, empty in an isolated preview).
- **Mechanism**: `cfg.entry` points at a generated barrel
  `.design-sync/.cache/ds-entry.tsx` that `export *`s only the clean component files;
  `cfg.componentSrcMap` lists those components by name (discovery has no `.d.ts` to read).
  PKG_DIR resolves to the repo root via the entry walk-up (a self-symlink
  `node_modules/treemap-writer → repo root` also exists from early synth experiments; the
  barrel-entry path makes it unnecessary but it is harmless).
- Regenerate the clean set + barrel + componentSrcMap with
  `scratchpad/analyze.mjs` (transitive import-graph taint analysis, type-only imports
  elided). Build-breakers = `@anthropic-ai/sdk`, `@google/genai`, any `node:*`, any `?raw`.

## Scope / size
- 127 PascalCase exports total → **42 clean (browser-bundlable)** → **39 shipped** after
  dropping 3 heavy bespoke visualizations that blow the 5 MB upload cap:
  - `SprintEditor` (mermaid + codemirror + katex, ~11 MB)
  - `Treemap` (plotly, ~5 MB)
  - `WordsOverTimeChart` (plotly, ~5 MB)
  These are app-specific viz, not reusable DS parts — correct to exclude on both axes.
- Trimmed 39-component bundle = **382 KB** (14 inlined npm pkgs). Full set was 17.9 MB.
- topo components (`TopoMap`, `TopoLand`, `Inspector`, glyphs) are tiny custom SVG (~0.04 MB) — kept.
- **`Treemap` IS shipped** (the namesake viz; user-requested) via a partial-plotly alias —
  total bundle **3.14 MB**, 40 components. See plotly alias below.

## Partial-plotly alias (how Treemap fits under 5 MB)
- `Treemap.tsx` does `import Plotly from 'plotly.js-dist-min'` (full ~4.8 MB dist) but only
  uses `type: "treemap"`. We alias `plotly.js-dist-min` → `.design-sync/.cache/plotly-treemap.mjs`
  (a core+treemap partial build, ~1.3 MB) via `cfg.tsconfig` =
  `.design-sync/.cache/tsconfig.ds.json` (paths: `@/*` + `plotly.js-dist-min`). The
  converter's own tsconfig-paths esbuild plugin honors it — **no fork of lib/bundle.mjs**.
  `plotly.js` (full source, with `lib/core.js`+`lib/treemap.js`) is installed as a transitive
  dep, which is what makes the partial build possible.
- RE-SYNC RISK: if `plotly.js` is ever uninstalled, or Treemap starts using other plotly
  trace types, the partial shim breaks/under-renders. Re-check `plotly-treemap.mjs` then.
- The custom tsconfig also carries the `@/*` alias (the plugin does NOT follow `extends`), so
  it must stay in sync with the repo tsconfig's `@` → repo-root mapping.

## Build
- Install: `npm ci` (lockfile = package-lock.json). Node 22.
- **`global` polyfill (required):** plotly's source (via the partial shim) references a bare
  Node `global`, so the browser IIFE throws "global is not defined" and every preview renders
  blank. Fix: `.design-sync/.cache/global-polyfill.js` (`globalThis.global = globalThis`) is
  imported as the FIRST line of the generated barrel (eval order = source order, so it runs
  before plotly). Any barrel regeneration MUST keep the polyfill import first.

## Render check
- Chromium is pre-installed at `/opt/pw-browsers/chromium-1194`; install only the npm wrapper
  `playwright@1.56.1` into `.ds-sync/` (it matches build 1194) with
  `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`, and run validate with
  `DS_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome` (validate honors that env var).
- **Known render warns** (triaged legitimate, not new failures): `[RENDER_BLANK]` on the small
  topo glyph icons (`NetworkGlyph`, `RefreshGlyph`, `SpineGlyph`, `WandGlyph`, and the other
  glyphs) — they are ~16px SVGs whose floor card is genuinely tiny (<5KB PNG). Authoring their
  previews (render larger / in a labeled row) resolves the warn.
- Converter deps staged in `.ds-sync/` (esbuild, ts-morph, @types/react).
- No providers needed: app uses a global Zustand store (no React Context Provider).
  Clean components are props-driven and don't touch the store.

## Re-sync risks
- The clean/shipped set is computed by a static taint analysis (`scratchpad/analyze.mjs`,
  NOT committed — it lives in session scratch). If the repo adds components or changes the
  import graph, RE-RUN that analysis (or recreate it) before trusting `componentSrcMap`.
  A new component that value-imports the store/AI/prompts layer will break the barrel build
  if added blindly.
- `cfg.componentSrcMap` is hand-pinned to specific paths; a file move silently drops a
  component. 
- CSS comes from a compiled Tailwind v4 stylesheet (see cssEntry once wired) — Tailwind
  generates utilities from scanned source, so the compiled CSS must be regenerated when
  component class usage changes.
