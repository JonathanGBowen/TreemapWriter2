# TreemapWriter "HLD" design system — how to build with it

A **dark heads-up-display** system: a near-black canvas, light blue-grey text, neon
accents, and a strict mono / uppercase UI voice with hairline borders and small
diamond status glyphs. Components are plain React + Tailwind v4 — **there is no theme
provider and no context.** Everything comes from CSS: the `@theme` tokens and the
`hld-*` class layer in `styles.css`. Read `styles.css` (and its `@import`s) before
styling; read each `<Name>.d.ts` for the props API and `<Name>.prompt.md` for usage.

## Setup — the dark canvas (required)
Every screen sits on the HLD canvas. Wrap your root so the tokens and fonts apply:

```tsx
<div className="bg-hld-bg text-hld-text font-sans min-h-screen">
  {/* your composition */}
</div>
```

Without `bg-hld-bg` (#05090d) + `text-hld-text` (#c5d8e8) the components render
light-on-light and look broken. Use `font-sans` (Inter) for reading content and
`font-mono` (JetBrains Mono) for UI chrome — labels, buttons, eyebrows — which are
typically uppercase with wide tracking. There is no light mode.

## The two affordance primitives (the core grammar — follow this)
- **`hld-lit`** / **`hld-lit-magenta`** = THE single next action on a surface.
  **Max one per visible surface.** Put it on the one primary button; everything else
  stays quiet (transparent or muted).
- **`hld-pip`** = the one status vocabulary, a small rotated diamond. Color encodes
  state: `hld-pip-green` (done/safe), `hld-pip-cyan` (active), `hld-pip-yellow`
  (attention), `hld-pip-magenta` (missing/failing), `hld-pip-purple` (secondary),
  `hld-pip-idle` (untouched, hollow), `hld-pip-dim` (inert). Add `hld-pip-sm`/`-lg`
  for size, `hld-pip-pulse` for in-flight. (Or use the `<Pip status=… />` component.)

## The class vocabulary (a Tailwind v4 preset — use these, don't invent colors)
- **Surfaces:** `bg-hld-bg`, `bg-hld-bgDeep` (camelCase), `bg-hld-surface`,
  `bg-hld-surface2`
- **Text:** `text-hld-text`, `text-hld-muted-text`, `text-hld-muted-text-2`,
  `text-hld-cyan`, `text-hld-magenta`, `text-hld-green`, `text-hld-gold` (and
  `-yellow`, `-purple`, `-orange`)
- **Borders:** `border-hld-border` (the hairline seam between surfaces)
- **Mono UI type scale:** `text-ui-label`, `text-ui-btn`, `text-ui-row`,
  `text-ui-meta`. Reading content uses ordinary sizes (e.g. `text-[13px]`).
- **HLD class layer:** `bracketed` (corner brackets — set `--br-color` to the accent),
  `hld-glow-cyan` / `hld-glow-magenta` / `hld-text-glow`, `hld-border` (hover-glow
  border), `hld-scanline` (opt-in CRT overlay on chrome surfaces — never on reading
  content). Tokens are also available as CSS vars: `var(--color-hld-cyan)`,
  `var(--font-mono)`, etc.

## Idiomatic build snippet
```tsx
import { ModalShell, Pip, SegControl } from '<this design system>';

<ModalShell eyebrow="Revision Engine" title="Apply changes" sub="3 spans"
            onClose={onClose} onPrimary={onApply} primaryLabel="Apply">
  <div className="flex items-center gap-2 font-mono text-ui-row text-hld-muted-text-2 uppercase tracking-[0.1em]">
    <Pip status="green" /> Claim stated
  </div>
</ModalShell>
```

ModalShell already paints the dark surface, the single `hld-lit` primary, and the
quiet CANCEL — compose your content as its children; reach for `<Pip>` for any status
and the `hld-*` utilities above for layout glue.
