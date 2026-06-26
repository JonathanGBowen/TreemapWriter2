# Implementation Brief — HLD Design-System Remediation

**Principle that governs every item: _subtract first._** The system already wrote the
rules (one lit action per surface · one pip status vocabulary · glow = "this is alive" ·
scanline never on reading content · don't invent colours). This brief is mostly *enforcing*
those rules, not inventing new design. Work tier by tier; within a tier, drain
opportunistically (the repo already favours this — see its oscillating-refactor history).

**Primary file:** almost all token + CSS work lands in **`src/index.css`** (the `@theme`
block and the `hld-*` component-class layer). Component-level work is flagged with search
anchors (exact paths vary; grep the anchor to find the file).

**The ADHD throughline:** calm is the feature, not polish. When a choice is ambiguous,
choose the quieter option — less ambient motion, fewer competing marks, clearer labels.

---

## TIER 1 — Foundation (Week 1–2)
*Highest visible win for the least, lowest-risk code. Do these first and in order.*

### 1.1 — Install the rationalised tokens
**File:** `src/index.css` (the `@theme` block).
**Do:** replace the colour section of `@theme` with **`theme.tailwind.css`** from this
bundle (it keeps the existing `--color-hld-*` names, so utilities like `text-hld-cyan`
keep working). Then run the find/replace **migration table** at the bottom of that file to
re-point every retired token, and delete the retired definitions.

Retired → replacement (full list in `theme.tailwind.css`):
`cyan-bright→cyan` · `pink→magenta` · `assembly→yellow` · `amber→yellow` ·
`orange→H5-only` · `border-2 & grid→border-strong` · hard-coded `#22364e/#2a4258→border-strong`.

**Acceptance:**
- `git grep` for each retired token name returns **zero** references outside the deleted defs.
- `@theme` defines **18** colour tokens (5 surface · 2 structure · 5 text/decor · 5 state · 2 feature… counting decor and the two muted as text-family).
- `tsc --noEmit`, `vitest`, `vite build` all green.

### 1.2 — Denoise the canvas by default
**File:** `src/index.css` (foundation layer: the `body` background, `.hld-scanline`, the
`.hld-pip-*` rules, `--bg-wash`).
The audit's lead finding: at rest a screen stacks dot-grid + two radial washes + scanlines
on two columns + a glow on **every** pip. Turn ambient atmosphere **off by default; make it
opt-in.**
**Do:**
- **Background wash:** remove `background-image: var(--bg-wash)` from `body`. Keep `--bg-wash`
  defined but apply it only behind genuinely "void" surfaces (e.g. topo map wells) via an
  explicit `.hld-atmosphere` opt-in class — not globally.
- **Scanline:** stop applying `.hld-scanline` to content-adjacent columns (sidebar, diagnostic).
  Keep the class; restrict it to true chrome wells only. **Never** on reading content.
- **Pip glow:** delete the always-on `box-shadow: 0 0 6px …` from `.hld-pip-green/-cyan/…`.
  Add a single `.hld-pip-live` (and the existing `.hld-pip-pulse`) that carries the glow, so
  glow means "alive," exactly as the effects file already claims.
- **Lit:** audit each surface for **one** `.hld-lit` / `.hld-lit-magenta`. Where two compete
  (e.g. Generate + Discard side by side), demote the secondary to `.hld-btn-ghost`.

**Acceptance:**
- A screenshot of the main workspace at rest shows a **flat** canvas — no grid, no washes,
  scanline only on designated wells.
- Glow appears only on (a) the single lit action and (b) live/pulsing pips.
- Each visible surface has **≤ 1** lit element.

### 1.3 — One canonical status encoder (the Pip)
**Search anchors:** `hld-pip`, `Readiness`, `ReadinessMeter`, the saved-state dot.
The audit found **six** competing status encoders. Consolidate to the **Pip**.
**Do:**
- **ReadinessMeter:** replace the 4-diamond row with **one labelled element** — a single
  4-step bar or a pip + word (`DRAFT · DEVELOPING · NEARLY · SOLID`). It encodes one ordinal
  value; show it once.
- **Saved-dot:** change the lone **circle** to a square pip (honour the square identity).
- **StatusBadge:** keep (the word is good for recognition) but ensure its colour comes from a
  state token, not a one-off.
- Leave the **button family** alone — it is already correctly consolidated and is the model
  to follow.

**Acceptance:** one status component is imported everywhere status is shown; no 4-diamond
meter remains; no circular status indicators remain.

### 1.4 — Critical accessibility
**Files:** `src/index.css` (focus styles) + the editor/heading + tile/row components.
**Do:**
- **Focus visibility (the real gap):** add a single `:focus-visible` cyan ring
  (`outline: 2px solid var(--color-hld-cyan); outline-offset: 2px;`) to `.hld-btn`,
  `.hld-tool`, `.hld-row`, `.hld-disclosure`, and any clickable tile. **Remove** the
  `outline: none` on editor focus (replace with a visible ring). Cyan on canvas is ~13:1, so it
  clears the 3:1 non-text minimum easily.
- **Contrast — fix the four failing pairs** (computed on the real tokens):
  - `#3d5570` used as text (2.6:1) → never as text; use `--muted-text #8aa6c4` (7.9:1). Keep
    `#3d5570` for dividers/idle pips only.
  - `#ff1060` as small body text (~4.4:1 on raised surface) → only at **≥18px / bold**, or as a
    pip; for small magenta text use a lighter tint.
  - Dimmed sibling-tile labels `rgba(255,255,255,.5)` (~3:1) → raise to `opacity .72` or use
    `--muted-text`.
  - Hairline `#172335` as a UI edge (1.3:1) → don't rely on it to signal interactivity; the
    focus ring + hover state carry that.
- **Semantic headings:** the prose "rainbow" headings must be real `<h1>–<h6>` (keep the colour
  as CSS on top), not colour-coded `<div>`s — so assistive tech gets a document outline.
  **Verify first** whether the live CodeMirror editor already emits semantic tags; only change
  if it doesn't. Chrome panel titles should also use heading elements or `role="heading"`.

---

## TIER 2 — Consistency (Week 3–6)
*Migrate everything onto the foundation. Drain file-by-file as you touch features.*

### 2.1 — Migrate components onto the tokens
Replace every hard-coded colour/size with its token. **Search anchors:** hex literals in
`.tsx` (`#00f0ff`, `#ff00`, `rgba(255,255,255,0.5)`, `#16283c`, `#22364e`…), inline
`fontSize`, `padding`/`gap` pixel literals. Once `git grep` for a retired token is clean,
delete its definition.
**Acceptance:** no hard-coded colour hexes remain in component files; no references to
retired tokens.

### 2.2 — Unify state patterns
Pick **one** treatment each for **loading / error / empty** and apply everywhere.
- Loading: the existing pulse/sweep vocabulary, one component.
- Error: in-context, specific, with a recovery action (the diagnostic panel's
  "locate → diagnose → suggest move" is the gold standard — match it; no silent failures,
  no generic "Something went wrong").
- Empty: instructions, not a blank void (the app already does this well — make it consistent).
**Acceptance:** one shared component/pattern per state; an errored AI call surfaces a visible,
specific, in-context message.

### 2.3 — Accessibility, round two
- **Target size:** raise `--hit-target` from **28px → 44px** for touch/primary controls (keep a
  dense ≥24px desktop-only variant *only* where the input is mouse-only). Enlarge the glyph
  tools (~25px) and chevrons (~10–12px).
- **Label the eight glyph tools:** icon **+** text label (preferred), or labels on first run that
  collapse once learned, or reveal-on-`⌥`-hold. Put the keyboard shortcut on the tooltip.
- **Semantic interactivity:** treemap tiles & list rows that are `div` click-handlers get
  `role="button"`, tab order, and Enter/Space. The sidebar name field needs a visible edit
  affordance.
- **Pips need a text equivalent:** pair each status pip with a label or `aria-label` — colour
  must never be the only channel.
**Acceptance:** primary targets ≥44px; every tool has a visible or first-run label; tiles/rows
are keyboard-operable; every pip has a non-colour equivalent.

### 2.4 — Snap off-grid type & spacing
Replace the **9 off-grid spacing values** (3, 5, 9, 11, 13, 14, 21, 36, 120) with the nearest
step on `2·4·8·12·16·24·32·48·64`. Replace the **four rem prose headings**
(1.05 / 1.25 / 1.6 / 2.1rem) with `--text-h-md/lg/xl` by depth, and **delete the sub-floor**
7.5px/8.5px text (floor is 9px). Collapse the three identical 9px tokens (`label/meta/eyebrow`)
to one.
**Acceptance:** `git grep` finds no off-grid spacing literals or rem heading sizes; no font-size
below 9px.

---

## TIER 3 — Polish (Ongoing)
*Refine, then keep it honest so drift can't return.*

- **Motion & interaction consistency:** one easing (`--ease-out`), the documented durations;
  keep the `prefers-reduced-motion` gate (already correct); no decorative loops.
- **Power-user efficiency:** surface keyboard shortcuts **beside** their actions (not only in
  `⌘K`); add batch operations where a daily workflow repeats.
- **Help / onboarding continuity:** first-run tool labels; keep empty states instructive.
- **Recurring "noise budget" review:** periodically screenshot the main surface at rest and
  count competing marks/glows — the cheap ritual that stops re-drift. Consider a lint rule that
  flags new hard-coded hexes or a second `.hld-lit` on one surface.

---

## Scorecard — what "done" looks like across the tiers

| Dimension | Now | Target | Where |
|---|---|---|---|
| Colour values | 29 | **18** | Tier 1.1 / 2.1 |
| Saturated accents | 11 | **5 state + 2 feature** | Tier 1.1 |
| Type sizes rendered | 14 | **7** | Tier 2.4 |
| Spacing values | 23 | **9** | Tier 2.4 |
| Status encoders | 6 | **1 (Pip)** | Tier 1.3 |
| Ambient layers at rest | 6 | **0 (opt-in)** | Tier 1.2 |
| Contrast fails | 4 | **0** | Tier 1.4 |
| Keyboard focus rings | partial | **all interactives** | Tier 1.4 |
| Min target size | 28px | **44px** | Tier 2.3 |
| Heading outline | flat / divs | **semantic h1–h6** | Tier 1.4 |

**Sequencing note:** Tier 1 alone delivers most of the *felt* improvement (a calm canvas, one
clear action, visible focus) for the least risk — ship it as one or two small PRs, update
`migration-log.md` + `STATUS.md`, and let the CI gate confirm nothing regressed before moving on.

