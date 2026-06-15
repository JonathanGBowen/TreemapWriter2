# Living Sprints — design & integration plan

> The Phase-0 design doc mandated by the design handoff (`design_handoff_living_sprints/`).
> A fresh agent should be able to re-derive intent from this file alone.

## Why

TreemapWriter's two sprints (Goal, Content) marched the writer through **every** section on a
per-section timer. Living Sprints evolves them into the load-bearing idea of the *Songwriting
Sprint*: a single working session runs a **generated, ordered sequence of timed _moves_** for
**one** section, **opens by reinstating context**, **forces transitions** (strict auto-advance),
is **seeded by argument shapes**, and **finalized by a short AI brief**. It targets one real user
(a philosopher with ADHD): the load-bearing problem is *reinstating context*; the therapeutic
mechanism is *externally-enforced structure*. Four directions compose into one loop:
**A** Brief (co-define) → **C** Shapes (seed) → **B** Runner (enforce) → **D** Made-Alive
(reinstate + ambient).

## Resolved decisions (handoff §11)

1. **Scope = one section.** A sprint targets the **active section** (`editor-state.selectedId`,
   fallback first). This replaces the old multi-section march — the design's core thesis ("stop
   iterating sections, start running moves"). Multi-section "chapter sprints" are deferred.
2. **Forced transition = save-then-advance.** On the zero-tick the current buffer is saved through
   the existing `onSaveContent`/`onSaveGoal` path **before** the move changes (the never-lose
   guarantee). No confirm dialog. A quiet **+2 min** is the only live escape valve.
3. **Plan locked while running.** All (re)planning happens in the Brief, before Start.
4. **Fragments = in-memory only (v1):** goal (`spec.mainClaim`→`mainClaim`→`goals`), last sentence
   of `section.content`, and `spec.incomingContext`; capped at 3. Git-snapshot / FTS-`search()`
   fragments are a documented seam (`buildReinstatement(..., { extraFragments })`) — `search()` is
   not yet shipped (see `docs/phase-5.md`).
5. **Shapes = read-only seed** in `lib/argumentShapes.ts`. Custom shapes = a later increment.
6. **Evolve the two existing sprints** (Goal stays goal-shaped, Content stays draft-shaped). No
   third Dock button (keeps the ≤5-action budget). One modal, three phases.
7. **Run-state is local** to the modal + engine hook — the whole flow (setup → brief → running) is
   one component subtree, so **no new slice and no new persisted field**. The existing `ui-state`
   openness flags are unchanged.

## Data model (`src/types/index.ts`)

`SprintMoveRole = 'reinstate'|'frame'|'marshal'|'draft'|'stress'|'synthesize'|'bridge'`;
`SprintMove { id, title, instructions[], durationSec, role, fromRequiredMoveId? }`;
`SprintPlan { shapeId, targetSectionId, totalSec, moves[] }` (moves[0] = reinstate);
`ArgumentShape { id, name, description, moves: Omit<SprintMove,'id'|'durationSec'> & { weight } }`.
Plus one new `PromptsConfig` field: `generateSprintPlanPrompt`. **No persisted field added.**

Role → color (canonical, `lib/sprintRoles.ts`): reinstate=green, frame/draft=cyan, marshal=yellow,
stress=orange, synthesize/bridge=purple; the per-move time bar is always magenta; done=green;
current pip=cyan-pulse.

## Pure logic (`src/lib/`, no React, unit-tested)

- `argumentShapes.ts` — the 5 shapes (each opens with reinstate). `findArgumentShape`.
- `sprintPlan.ts` — `scaleWeightsToSeconds` (proportional + floor, **sums to total exactly**),
  `planFromShape`, `renormalizeDurations`, `goalPlan`, `ensureReinstateFirst`, `reinstateMove`,
  `lastSentenceOf`, `formatClock`, `minutesOf`, `SPRINT_MOVE_ROLES`.
- `sprintRoles.ts` — `roleHue`, `roleLabel`, `hexA`.
- `reinstate.ts` — `buildReinstatement(section, entry, { cap, extraFragments })`.
- `ding.ts` — `playDing()` (WebAudio 880Hz, reused AudioContext).

Tests: `lib/__tests__/{argumentShapes,sprintPlan,sprintRoles}.test.ts` and
`features/modals/sprint/__tests__/use-sprint-engine.test.ts` (the strict-auto-advance
save-before-advance invariant).

## Components (`src/features/modals/sprint/`, each < 300 lines)

`SprintModal.tsx` (orchestrator — replaces the old `BaseSprintModal`; same export name/props +
`promptsConfig`; resolves target section, reinstatement, backlog; owns phase + plan) → renders one
of: `SprintSetup` (totals + `ShapeCard` library + "Generate brief"), `SprintBrief` (Direction A —
coach turn, goal textarea, `ModelPicker` depth, generated plan, graceful fallback), `SprintRunner`
(Direction B — progress + magenta time bars, header, 64px countdown, instruction checklist,
`SprintEditor` or `ReinstatePanel`, `SprintSequenceRail`, strict-advance footer). Hooks:
`use-sprint-engine` (50ms tick, `performAdvance` — save→ding→advance/complete), `use-sprint-cues`
(cues pref + ding). Reduced motion via the existing `topo/useReducedMotion`.

## AI Brief (Direction A) — mirrors existing flows

Prompt `services/prompts/generate-sprint-plan.md`; `AIProvider.generateSprintPlan(input):
Promise<SprintPlan>` + `GenerateSprintPlanInput`/`SprintBacklog`; impl delegates to
`services/ai/ai-provider.sprint.ts` (structured-output schema → `safeJsonParse` → validate →
`ensureReinstateFirst` → `renormalizeDurations`); new `AICallKind 'generateSprintPlan'` +
`DEFAULT_MODEL_CONFIG` (flash, fast). On error/no key the Brief falls back to the shape's default
plan, so the writer is never blocked.

## Cues (Direction D, sensory) — off by default

`preferences.ts: getSprintCuesEnabled/setSprintCuesEnabled` (default false). Ambient hue shown only
when cues on; its cross-fade (`.sprint-ambient`) and the transition flash are disabled under
`prefers-reduced-motion`. The ding follows only the cue toggle.

## Verification

`npm test` (162 pass), `npm run typecheck` (clean), `npm run lint` (no new errors; new files <300),
`npm run build` (ok). Manual (`npm run dev`): open a sprint from the Dock `»` → Reinstate card →
pick a shape (or Generate brief) → runner countdown/checklist/rail, let it hit zero (text saved,
advances, no confirm), +2m works, finish closes. Cues on → subtle hue + ding; reduced-motion
disables the hue cross-fade. Brief without `GEMINI_API_KEY` → falls back to the shape default.
