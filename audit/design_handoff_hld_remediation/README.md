# Handoff: HLD Design-System Remediation — Socratic Co-Writer (TreemapWriter2)

## Overview
This package operationalises the **visual design audit** of the Socratic Co-Writer
"HLD" design system. It is **not a UI to rebuild** — the app and its design language
already exist and are healthy. The job is to **apply a specific, bounded set of
token / CSS / component / accessibility changes to the existing repo**, in three
tiers, to fix the drift the audit found.

**Verdict the audit reached:** *needs polish, not rebuild.* There is a real,
documented design language; it simply stopped enforcing its own restraint as
features accreted. Every change here is **subtraction or consolidation** — nothing
introduces a new visual direction.

> Read this alongside the companion **`CODEBASE_FORENSIC_AUDIT.md`** already on the
> `claude/design-sync-ovgg8r` branch — that one found the *architecture* sound. This
> is the *design-layer* companion. Same posture: maintain, don't rewrite.

## How to use this package (read in this order)
1. **`IMPLEMENTATION_BRIEF.md`** — the work, as a tiered, file-mapped checklist with
   acceptance criteria. This is the main document; you can implement from it alone.
2. **`theme.tailwind.css`** — paste-ready rationalised `@theme` for `src/index.css`
   (keeps the existing `--color-hld-*` names; removes strays, namespaces feature
   accents). The migration find/replace table is at the bottom of the file.
3. **`tokens.css`** — the same tokens as framework-agnostic `:root` custom properties
   (reference / non-Tailwind contexts).
4. **`Design Audit.html`** — the full 13-page visual audit, **self-contained** (all
   CSS and fonts inlined; works offline). Open in any browser for the evidence and
   rationale behind any single change, and **print to PDF** (landscape) for a static copy.

## First, get oriented in the repo (the repo self-documents)
Before touching code, read — in this order — **`AGENTS.md`** (the architecture +
"where to put X" rules + anti-patterns), **`STATUS.md`** (the living backlog), and
**`docs/migration-log.md`** (append-only change log). The audit and the forensic
audit both confirm these are accurate and load-bearing; following them is what keeps
changes in-architecture. The design-sync branch also carries **`.design-sync/conventions.md`**,
which states the HLD grammar in prose — that grammar IS the benchmark this remediation enforces.

## Stack (confirmed)
Tauri 2 + Vite + React 19 + TypeScript, **Tailwind v4** with an `@theme` token block
and a custom `hld-*` component-class layer, both in **`src/index.css`**. Fonts: Inter
(prose) + JetBrains Mono (chrome), self-hosted via `@fontsource/*`. No theme provider,
no context — everything is CSS. There is no light mode.

## Fidelity
The token values, contrast ratios, and type/spacing scales are **high-fidelity and
final** — use the exact hex/px values given. The annotated screen mockups in the audit
are **reconstructions from component code**, not pixel captures, so treat their
*layout* as indicative and verify pin-level specifics against the running app (flagged
inline in the audit, e.g. whether the CodeMirror editor already emits semantic headings).

## Definition of done (per the repo's own ritual)
Each tier's changes ship only when: `tsc --noEmit` passes, `vitest` is green, `vite build`
succeeds (the existing CI gate), **and** `docs/migration-log.md` + `STATUS.md` are updated.
Keep the `prefers-reduced-motion` gate intact — it's already correct.

## Files in this bundle
- `README.md` — this file
- `IMPLEMENTATION_BRIEF.md` — the tiered work + acceptance criteria
- `theme.tailwind.css` — rationalised `@theme` (drop-in for `src/index.css`)
- `tokens.css` — framework-agnostic `:root` token reference
- `Design Audit.html` — the full visual audit, self-contained (open in browser / print to PDF)
