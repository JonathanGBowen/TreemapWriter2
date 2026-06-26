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

## Per-component preview notes (folded from wave learnings)
Real props come from the SOURCE files — the bundle `.d.ts` are generic
(`[key: string]: unknown`). Token gotcha throughout: the deep canvas token is
**`hld-bgDeep`** (camelCase → `--color-hld-bgDeep`), there is NO `hld-bg-deep`.
All in-flow previews use the dark `Frame` (margin:-24/padding:24 over
`bg-hld-bg text-hld-text`); overlay components (ModalShell, ConfirmModal,
SprintSetup, Tutorial) render their own fixed surface and take NO Frame.

- **Glyphs** (`src/features/modals/topo/icons.tsx`): most take a literal hex `c`
  prop (NOT currentColor); `CloseGlyph` is the exception (currentColor + `size`).
  Small 13px glyphs (Wand/Refresh/Atlas/Spine) have no size prop — scale them up
  (`transform: scale(2–2.6)`) or they grade blank.
- **LegendKey / topo (Inspector, TopoMap, TopoLand)**: `position:absolute` — need
  a sized `relative` stage (640×460 maps, 348×620 Inspector) on `bg-hld-bgDeep`.
  `deriveTopo` is NOT exported from the bundle, so the previews build a `TopoModel`
  by hand inline (esbuild erases types; cast `as never`). usePanZoom fits
  synchronously on mount → renders fitted with no interaction; pass
  `organizeNonce={0}`, `reduced` for a static shot.
- **Treemap** (the namesake): plotly `branchvalues:"total"` means every parent
  section's `wordCount` MUST equal the sum of its children's, or plotly silently
  renders ZERO slices (hard blank, no error). The preview data satisfies this —
  keep that invariant on any edit. Sizes to its container (a fixed-size div is fine).
- **DependencyChips**: wraps its whole body in a `Disclosure` hardcoded closed and
  forwards no `defaultOpen`. The preview opens it on mount via an `OpenOnMount`
  wrapper (a ref `useEffect` that clicks `button[aria-expanded="false"]`) — no
  source edit, no harness change.
- **StructuredJsonEditor** uses hardcoded slate/emerald/cyan/purple colors (not HLD
  tokens) — the dark Frame is mandatory or it renders invisibly.
- **SprintSetup** wraps ModalShell and stacks all 5 argument shapes → very tall;
  needs `overrides.SprintSetup = {cardMode:'single', viewport:'640x900'}`.
- **Tutorial** (react-joyride): first step targets `body`/center, so `run={true}`
  renders a complete centered welcome tooltip — renders fine, NOT skipped.

## Known render warns (triaged legitimate — recorded so re-syncs don't flag as new)
- `[RENDER_BLANK]` on small topo glyph icons at native size — they are ~13–16px
  SVGs; previews scale them up, but the floor-card check may still note them.
- **ResizeHandle is transparent at rest** (cyan only on `:hover`) — a static shot
  shows no visible bar by design; graded on panel/placement context, not a bar.
- **ConfirmModal** with a short message centers high and can clip its header at the
  card's top edge — not a defect; prefer 2–3 line messages.

## Benign validate warnings (confirmed via rendered previews — record so re-syncs don't chase)
- `[RENDER_THIN] ConfirmModal` — its `fixed inset-0` overlay leaves `#root` with a
  measured height of 0; the modal itself renders fine (portal/fixed false-positive).
- `[TOKENS_MISSING] --tw-colors-hld-{green,magenta,yellow,cyan}` — referenced via
  runtime inline styles by some components; renders verify clean (40/40). Expected absent.
- `[FONT_MISSING] "Cambria"` — an incidental system serif referenced by the compiled
  CSS (NOT an HLD brand font; HLD is Inter + JetBrains Mono). System substitute is fine.

## Card layout
- All non-overlay components use `cfg.overrides.<Name> = {cardMode:"column"}` (full card
  width per story) — the dark full-bleed Frame otherwise trips `[GRID_OVERFLOW]` width
  checks. Overlays (ModalShell, ConfirmModal, SprintSetup) use `{cardMode:"single", viewport}`.
- ModalShell/SprintSetup (tall overlays, cardMode:single): the modal's top eyebrow/title can
  crop above the card screenshot (the modal renders whole; it's a capture-framing quirk, not a
  defect). Verified good by independent review.

## Re-sync setup (fresh clone / re-run) — make the gitignored build aids first
The committed config points `entry`/`tsconfig`/`cssEntry` at `.design-sync/.cache/`
(gitignored). Regenerate them deterministically from config before building:
```sh
npm ci                                   # repo deps
mkdir -p .ds-sync && cp -r <skill>/package-*.mjs <skill>/resync.mjs <skill>/lib <skill>/storybook .ds-sync/
(cd .ds-sync && npm i esbuild ts-morph @types/react)
(cd .ds-sync && PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i playwright@1.56.1)   # chromium pre-installed
node .design-sync/regen.mjs               # → .cache/{ds-entry.tsx,global-polyfill.js,plotly-treemap.mjs,tsconfig.ds.json,compiled.css}
# then the normal driver/build (validate with DS_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome)
```
If the repo's components changed, first re-run `node .design-sync/analyze-clean-set.mjs`
and update `componentSrcMap` from `.cache/clean-map.json` (review the HEAVY exclusions).
