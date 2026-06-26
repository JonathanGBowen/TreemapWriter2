# Codebase Forensic Audit — TreemapWriter2

*A version-control forensic analysis, written to teach as much as to diagnose.*

**Audited:** 2026-06-26 · **Repo:** TreemapWriter2 · **History analyzed:** 147
commits, 2026-05-05 → 2026-06-24 (~7 weeks) · **Authors:** Jonathan Bowen (82
commits), Claude (65) · **Stack:** Tauri 2 (Rust) + React 19 / TypeScript / Vite
· **Size:** ~239 source `.ts`/`.tsx` files, 22 Rust files, 56 prompt/markdown
files.

---

## How to read this document

You asked for a forensic audit because you've been "vibe-coding" — pushing
features fast, fearing untracked regressions, worried the result is
unsustainable. That is the right instinct to interrogate. But the honest job of a
forensic analyst is to follow the evidence wherever it leads, including when it
contradicts the client's own worry.

So here is the verdict up front, before the argument that earns it: **this is not
an unsustainable codebase, and it is not what "vibe-coding gone wrong" usually
looks like.** The typical vibe-coded project that needs an audit has no tests, no
documentation, a tangle of copy-pasted logic, commit messages like "fix" and
"asdf," and a single 4,000-line file that everything routes through. This project
has a CI gate, ~48 test files, an explicit written architecture with enforced
laws, an append-only change log, and a commit history that builds forward instead
of thrashing. The data simply does not support the self-diagnosis of
"unsustainable."

That does **not** mean there's nothing to fix. There is real, localized debt —
chiefly one oversized orchestration file — and there are habits worth hardening
before the codebase doubles again. The rest of this document shows you the
evidence, teaches you the principles that let you read that evidence yourself next
time, and gives you a concrete plan. It is written to be re-read, not skimmed
once.

---

## Section 1: Executive Summary

**Verdict: a healthy, deliberately-architected personal tool carrying a small
amount of mostly-prudent debt — not a maintenance crisis.**

The standard framing for "how bad is this debt?" is **Martin Fowler's Technical
Debt Quadrant (2009)**. Fowler observed that not all debt is equal, and split it
along two axes:

- **Deliberate vs. Inadvertent** — did you *choose* to take on the shortcut, or
  did you not realize you were taking it?
- **Prudent vs. Reckless** — was the shortcut a reasonable trade given what you
  knew, or careless?

That yields four quadrants. The dangerous one is **Reckless + Inadvertent** —
"What's layering?" — debt you took on without knowing, because you didn't know
better. Vibe-coding's reputation is that it lands you here.

**This codebase lands overwhelmingly in the Deliberate + Prudent quadrant, with a
thin sliver of Inadvertent.** The evidence:

- The single largest source of debt — `App.tsx` at 1,034 lines against a stated
  ~300-line target — is **explicitly named as acknowledged debt in two separate
  governance docs** (`AGENTS.md` §6 and `STATUS.md`). You can't be more
  "deliberate" about a debt than to write it down, explain why it's tolerable,
  and describe how you'll pay it down. That is the textbook definition of
  *prudent deliberate* debt.
- There is an architecture, it is written down (`AGENTS.md`), and it is *enforced*
  by a CI gate. Reckless debt doesn't come with a rulebook.
- The commit history shows **0 reverts** and only ~10 fix-flavored commits out of
  147 — the opposite of the "introduce regressions I notice later" pattern you
  feared.

The *inadvertent* sliver is real but minor: `App.tsx` has accreted handlers and
modal wiring slightly faster than it's been decomposed, and a few feature areas
(notably the "coach" logic) are scattered across more files than their cohesion
warrants. These are drift, not disease.

**What this means for the path forward:** you do not need to rewrite, and you do
not need a heavy stabilization project. You need to *continue what you're already
doing* — decompose the one hot file opportunistically, close a known test gap in
the AI orchestrators — and to recognize that the disciplined scaffolding you've
built (the docs, the CI, the architectural law) is the very thing keeping you out
of the reckless quadrant. The risk is not that the codebase collapses; it's that
you stop trusting the system that's working.

---

## Section 2: The Evidence

This section presents the forensic data and, for each finding, explains **what
the data shows**, **what principle it illustrates**, and **why it matters**. The
techniques come from Adam Tornhill's *Your Code as a Crime Scene* (2015), whose
core insight is that **how code changes over time reveals more about where
problems live than any single snapshot of the code does.** A file can look fine
today and still be a problem if its *history* shows it's a magnet for change.

### 2.1 Change frequency — where the hotspots are

> **Command:** `git log --format=format: --name-only | sort | uniq -c | sort -rn`

The most-frequently-modified files across all 147 commits:

| Changes | File | Reading |
|--:|---|---|
| 42 | `docs/migration-log.md` | Expected — it's an append-only log; *meant* to change every feature |
| 39 | **`src/App.tsx`** | **The genuine code hotspot** |
| 27 | `STATUS.md` | Expected — the living backlog |
| 23 | `src/types/index.ts` | The domain model; grows as features ship |
| 20 | `src/state/ui-state.ts` | Modal flags + widths; touched by every UI feature |
| 18 | `src/services/ai/ai-provider.impl.ts` | The AI orchestrator |
| 18 | `src/services/ai-provider.ts` | The AI interface |
| 14 | `src/features/sidebar/Sidebar.tsx` | — |

**What it shows.** Tornhill's empirical finding across many codebases is that
defects cluster in a *small* fraction of files (often 4–6%) that absorb a
disproportionate share of all changes. Here, once you discount the two docs that
are *supposed* to change constantly (`migration-log.md`, `STATUS.md`), the
standout is `App.tsx`.

**The principle — hotspots.** A file changed far more often than its neighbors is
either (a) doing too much, so every feature has to touch it, or (b) badly shaped
for the changes being made to it. High change frequency is a *question*, not a
verdict — but `App.tsx` is clearly answering "I touch everything."

**Why it matters.** `ui-state.ts` and `types/index.ts` ranking high is benign:
they're *registries* (modal flags; domain types), and a registry that grows with
the app is healthy by design. `App.tsx` ranking high is the one to watch, because
it's not a registry — it's logic, and logic that everything routes through is
where regressions hide.

### 2.2 Complexity trend — is the hot file getting worse?

> **Command:** for each historical revision of `App.tsx`, measure line count.

A sampled trajectory of `src/App.tsx`:

```
2026-05-11   944 lines
2026-06-13   951
2026-06-17   993 → 1005
2026-06-18  1020
2026-06-19  1028
2026-06-22   960   ← a deliberate decomposition pass
2026-06-23   994
2026-06-24  1027   (today: 1034)
```

**What it shows.** This is the single most important graph in the audit, and it
is *good news disguised as a problem.* A file that only ever grows — Tornhill's
"complexity trend" — is accumulating debt with no countervailing force. This file
doesn't do that. It climbs toward ~1,030, then someone (you, or an agent under
your direction) *trims it back* — the dip to 960 on 2026-06-22 is a documented
decomposition pass — and then it climbs again. It **oscillates** rather than
**ramps**.

**The principle — complexity trend.** The shape of a file's size-over-time curve
tells you whether refactoring is happening. A monotonic ramp means "we keep
adding and never paying down." An oscillation means "we add, then consolidate."
The second is sustainable; the first is not.

**Why it matters.** It means your instinct ("I'm accumulating mess") is half
right — the file *does* grow — but your fear ("and I never deal with it") is
contradicted by your own history. The decomposition reflex is already there. The
file is large, but it is *tended*. Section 4 is mostly about making that tending
slightly more frequent.

### 2.3 Temporal coupling — what changes together

> **Command:** count how often each pair of files appears in the same commit.

Top co-change pairs (excluding lockfiles):

| Co-commits | Pair | Reading |
|--:|---|---|
| 19 | `App.tsx` ↔ `state/ui-state.ts` | God-component signature |
| 15 | `ai-provider.ts` ↔ `ai-provider.impl.ts` | Interface + impl — *expected* |
| 15 | `App.tsx` ↔ `types/index.ts` | New feature → new type → wired in App |
| 15 | `App.tsx` ↔ `state/project-state.ts` | — |
| 15 | `App.tsx` ↔ `services/ai-provider.ts` | — |
| 12 | `model-config.ts` ↔ `model-types.ts` | Config + its types — *expected* |

**What it shows.** **Temporal coupling** is when two files repeatedly change in
the same commit. Tornhill calls it one of the strongest predictors of
architectural decay — *because it can reveal a dependency that the import graph
doesn't show.* Some coupling is healthy and expected: an interface and its
implementation (`ai-provider.ts` ↔ `.impl.ts`), or a config object and its type
definition, *should* change together. That's cohesion, not coupling-as-smell.

The signal here is that **`App.tsx` is coupled to almost everything** —
`ui-state`, `types`, `project-state`, `ai-provider`, `Sidebar`. When one file is
the partner in the top co-change relationships across unrelated subsystems, it
means "to do nearly any feature, you must edit this file." That is the defining
operational cost of a god component: it serializes your work through a single
bottleneck and raises the merge-conflict and regression surface of every change.

**Why it matters.** This is the same finding as 2.1 and 2.2, seen from a third
angle — which is exactly how forensics builds confidence. Three independent
measurements (frequency, size-trend, coupling) all point at `App.tsx`. That
convergence is what makes the App.tsx recommendation the highest-confidence item
in this report.

### 2.4 Commit-message forensics — the *process*, not the code

> **Command:** classify all 147 commit subjects by keyword.

| Category | Count | Of 147 |
|---|--:|--:|
| Feature / add / implement | ~40 | 27% |
| Refactor / migrate / consolidate / retire | ~13 | 9% |
| Fix / bug / broken | ~10 | 7% |
| **Revert / undo** | **0** | **0%** |

A representative slice of real subjects:

```
Add Parallel Editor: reverse-outline-driven revision workspace
Consolidate AI surfaces; add ⌘K command palette
test(rust): cover fs_io, git, layout, and serde mirror
refactor(phase-3.5c): route App.tsx through aiProvider; retire ai-pipeline.tsx
Fix empty-document trap; remove dead code
```

**What it shows.** Commit messages are a window into the *development process*,
not just the code. A history dominated by "fix," "fix again," "really fix," "wip,"
"revert" tells you the author is fighting the code — trial-and-error debugging,
changes that don't stick. **This history shows the opposite.** Messages are
descriptive, feature-scoped, and frequently *announce their own discipline*
(`test(...)`, `refactor(...): retire ...`). There are **zero reverts** in 147
commits.

**The principle.** The ratio of *forward* work (feat/refactor) to *corrective*
work (fix/revert) is a cheap, honest proxy for whether a codebase is fighting you.
A healthy ratio here is ~5:1 forward-to-fix; you're at roughly that.

**Why it matters.** This is the direct, evidence-based rebuttal to your stated
fear — "introducing regressions I only notice later." If that were happening at
the rate you fear, it would show up as a wake of fix-and-revert commits trailing
each feature. It doesn't. Either the regressions aren't happening, or your CI gate
(2.6) is catching them before they're committed. Both are good outcomes.

### 2.5 Churn — and the ghosts

> **Command:** sum lines added + deleted per file over all history.

Highest-churn real source files (excluding lockfiles):

| Churn (±lines) | File | Status |
|--:|---|---|
| 3,553 | `src/App.tsx` | live (the hotspot, again) |
| 1,568 | `features/tests-panel/TestsPanel.tsx` | live |
| 1,318 | `features/sidebar/Sidebar.tsx` | live |
| 1,313 | `features/modals/DependencyGraphModal.tsx` | live |
| 1,221 | `src/lib/ai-pipeline.tsx` | **deleted** |
| 1,162 | `src/services/gemini-provider.ts` | **deleted** |

**What it shows.** **Code churn** is the total volume of change (added + deleted)
a file has seen. High churn *combined with* high complexity is Tornhill's most
dangerous signal — a complex file that keeps getting reworked but never
stabilizes. `App.tsx` has the highest churn and high complexity, which is why it's
the headline.

But look at the two highest-churn files *after* the live ones: `ai-pipeline.tsx`
and `gemini-provider.ts`. Both are **deleted**. They were absorbed and retired
during refactors — the commit log literally says *"route App.tsx through
aiProvider; retire ai-pipeline.tsx"* and the multi-provider rework replaced the
single Gemini provider with the pluggable `services/ai/clients/` structure.

**Why it matters.** Those two "ghosts" are the fingerprint of **active
de-complexification.** A codebase that never refactors leaves its mistakes in
place; this one has a track record of identifying a structure that no longer fits
and *removing* it. That history is the single best predictor that the `App.tsx`
debt will eventually be paid too — because the same thing has already happened to
its neighbors.

### 2.6 Tests and CI — the decisive evidence

> **Commands:** count test files; read `.github/workflows/ci.yml`.

- **48** JavaScript/TypeScript test files (`*.test.ts(x)`) against ~239 source
  files — a ~20% test-file ratio. Coverage spans state slices, sync policy, the
  AI registry/resolver, prompt registry, and many pure `lib/` helpers.
- **9** Rust test modules (`#[cfg(test)]`) covering `fs_io`, git, layout, and the
  serde mirror.
- A **CI gate** (`.github/workflows/ci.yml`) that on *every push and PR* runs:
  `tsc --noEmit` (typecheck) → `vitest --coverage` → `vite build` →
  `cargo test`. Superseded runs are auto-cancelled. Coverage has floor thresholds
  that "ratchet up" (per `STATUS.md`).
- Only **3** `TODO`/`FIXME` markers in the entire source tree.

**Why this is decisive.** **Michael Feathers (*Working Effectively with Legacy
Code*, 2004) defines legacy code as, simply, "code without tests."** By that
definition — the most widely-used one in the field — **this is not a legacy
codebase.** It has tests, and more importantly it has an *automated gate that
prevents a red suite from merging.* That single fact changes the entire risk
calculus of the rest of this report, and it is the strongest reason the rewrite
question (Section 3) answers itself.

The 3-TODO count matters too: it means you are not leaving a trail of "deal with
this later" landmines. The archaeological layers of abandoned intent that make
most vibe-coded projects frightening to modify are, here, almost absent.

### 2.7 Architecture — intentional and enforced

The structural analysis (dependency mapping, cohesion, separation of concerns)
found a *genuinely designed* system, documented in `AGENTS.md` and largely
adhered to:

- **Six named layers, each with "one reason to change":** presentation
  (`features/`) → application state (ephemeral Zustand) → domain state (persisted
  Zustand) → repository → service → infrastructure (Rust/SQLite/git).
- **Two dependency-inversion seams** make the app pluggable: the `Repository`
  interface (with browser-IndexedDB and Tauri-SQLite implementations chosen at
  module load) and the `AIProvider` interface (one `LLMClient` per provider; *no
  other file imports an AI SDK*).
- **State partitioned by lifecycle, not feature** — 13 Zustand slices where UI
  ephemera never shares a slice with domain data.
- **A single source of truth per datum** — `AGENTS.md` carries an explicit table
  mapping each kind of data to its one authoritative home (`project.md` on disk
  for prose; SQLite as a *rebuildable cache*; git for history).

Structural findings, each grounded in the code:

- **`App.tsx` is a *moderate* god component, not a pathological one.** It
  orchestrates ~23 modals plus the three main panels, destructures ~100 store
  selectors, and owns the 60-second autosave/snapshot interval inline. But it is
  *layered* (init → state-wiring → render-orchestration), the modals it renders
  are mostly pass-through (state + callbacks in, no embedded business logic), and
  it makes only ~2 direct AI calls. The ~200-line modal-render block and the
  autosave loop are clean extraction seams (see Section 4).
- **State is coherent.** 13 slices, lifecycle-partitioned, **no duplicated
  state**. Cross-slice writes go through `get().otherAction()` thunks; the
  potential registry↔store import cycle is deliberately broken by DI injectors
  (`setModelConfigSource`, `setAgentTraceSink`).
- **No circular dependencies were found**, and dead code is near zero — features
  import `useStore`/`aiProvider` but never the repository, credentials, or an LLM
  SDK directly. The layering isn't just documented; it holds.
- **`types/index.ts` (903 lines, 76 exports) is *not* a god file.** It's grouped
  cleanly by domain layer (spec/diagnostic, analysis, revision, gist, sprint,
  sync), documented, and orphan-free. `AGENTS.md` explicitly designates it the
  most carefully-considered artifact in the codebase and forbids "simplifying"
  it. Its size is a feature of an ambitious domain model, not a smell.
- **The `ai-provider.ts` / `ai-provider.impl.ts` "duality" is an intended
  facade+implementation pattern, not duplication.** `ai-provider.ts` is the
  interface and input types; `.impl.ts` is the `MultiProviderAIProvider` that
  delegates to ~10 focused `ai-provider.*.ts` satellite flows; the registry is
  the DI singleton. Adding a provider means adding one client file — the
  hallmark of a well-placed seam.

**Honest weaknesses** (named so they don't hide):

1. `App.tsx` size — the one item all the forensic signals agree on.
2. **Scattered "coach" logic** — spread across `CoachModal`, `use-ambient-cue`,
   and `App.tsx` handlers, with no cohesive `coach/` home. Low cohesion; the kind
   of thing that's mildly annoying to change because you have to touch three
   places.
3. **`lib/constants.ts` (~58 KB)** — much of it is prompt-ish content living as
   code; it would be more legible as data (the prompt *registry* already shows
   the pattern).
4. **Repository/AIProvider are swapped via module-load singletons, not
   injected** — which makes *per-test substitution* harder. This is the one
   architectural choice that actively fights testability, and it's the friction
   behind the AI-orchestrator coverage gap (Section 4).

---

## Section 3: The Rewrite Question

This is the section you most need, because "should I just start over?" is the
question vibe-coders ask when a codebase *feels* unsustainable. The feeling and
the evidence diverge here, and the evidence wins.

### The case against rewriting (Spolsky)

Joel Spolsky's *"Things You Should Never Do, Part I"* (2000) calls a from-scratch
rewrite "the single worst strategic mistake" a software company can make. His
three arguments: (a) old code embeds **hard-won knowledge** — every weird
conditional is a bug someone hit and fixed, and a rewrite throws that away; (b)
the rewrite **always takes longer than you think**, and during that time you ship
nothing; (c) there's **no reason to believe** the second attempt will be better.
His cautionary tale is Netscape, which rewrote for 6.0 and effectively handed the
market to Microsoft.

### The case *for* strategic rewriting

The counter-literature (Herb Caudill's *"Lessons from 6 Software Rewrite
Stories,"* the "Joel is wrong" rebuttals) points out that Spolsky's rule was
written for **large commercial products with users and competitors**, and the
calculus differs for a solo personal tool:

- There are **no competitors** gaining ground while you rebuild.
- *You* wrote the original, so the "hard-won knowledge" isn't lost when the code
  is — it's in your head (and, here, in your docs).
- If the architecture genuinely doesn't match your understanding of the problem,
  refactoring *within* a broken structure can be harder than rebuilding on a
  clean one.

This is the strongest possible case for rewriting — and **it still doesn't apply
here, because its central premise (a broken architecture) is false.** Section 2.7
found a coherent, layered, documented, enforced architecture. The condition that
would justify a rewrite is precisely the condition this codebase doesn't meet.

### The middle path (Feathers and Fowler)

- **Feathers' Legacy Code Change Algorithm:** (1) identify change points, (2)
  find *test points* (**seams** — places where you can change behavior without
  editing the code in place), (3) break dependencies, (4) write
  **characterization tests** that pin down what the code *currently does*, (5)
  change and refactor under that safety net.
- **Fowler's Strangler Fig:** rather than replacing everything at once, build the
  new alongside the old and route behavior through it incrementally until the old
  code can be deleted — named for the vine that grows around a host tree and
  gradually replaces it. You've *already done this twice* (`ai-pipeline.tsx` and
  `gemini-provider.ts` were strangled and removed — see 2.5).

### The recommendation

**Do not rewrite. It isn't close.** A rewrite here would mean discarding a
working, tested, CI-gated, well-documented Tauri app — with a hard-won durability
stack (on-disk `project.md` as source of truth, rebuildable SQLite cache, git
history, keyring secrets, multi-provider AI behind a clean seam) — in order to
escape **roughly one oversized file.** That is trading an asset for a liability.

Every one of Spolsky's arguments applies *and* the solo-developer counterarguments
that would normally weaken them are themselves neutralized:

- The hard-won knowledge isn't just in your head — it's externalized in
  `AGENTS.md`, `VISION.md`, `STATUS.md`, and `migration-log.md`. A rewrite would
  still throw away the *encoded edge cases* (the silent-persistence bug fix, the
  context-budget pre-flight, the sparse-config serde contract) that those docs
  show you've already paid for in debugging time.
- The "broken architecture" premise is false. The architecture is the *best* part
  of this codebase.

**What to preserve regardless:** even in the counterfactual where you did rebuild,
you would keep the domain model (`types/index.ts` — it encodes a genuine theory of
academic prose), the source-of-truth discipline, the two inversion seams, and the
docs. But since those *are* the codebase's spine and they're healthy, "keep the
spine" just means "keep the codebase."

**The actual move is the strangler fig you're already running**, applied next to
`App.tsx`: grow the replacement (extracted modal-layer + hooks) alongside it and
route through the new structure until `App.tsx` is a thin shell. That's Section 4.

---

## Section 4: If We Keep It — A Stabilization Plan

We are keeping it. Here is the highest-return-on-investment work, ordered. None of
this is urgent in the "broken right now" sense — nothing is broken right now — so
treat it as a backlog to drain opportunistically, exactly as `STATUS.md` already
frames it.

### 4.1 Close the one real test gap: the AI orchestrators

`STATUS.md` already names this precisely — "the big remaining gaps are the AI-flow
orchestrators (`ai-provider.impl` + per-flow modules)." These are the files that
build prompts and parse model responses, and they're under-tested because the
singleton wiring (weakness #4 in 2.7) makes them awkward to substitute in a test.

**The Feathers move:** write **characterization tests** — tests that capture what
the code *currently does* (given this input, it builds exactly this prompt and
parses exactly this shape), not what it *should* do. You don't need a live model:
the seam is the `LLMClient`. Inject a fake client that returns canned responses,
and assert on the prompt that goes *in* and the structured object that comes
*out*. This pins the orchestrators so a future refactor (or a model-SDK upgrade)
can't silently change behavior.

To make that easy, consider the small dependency-breaking change: allow the
`AIProvider`/`Repository` to be *injected* for tests rather than resolved only
from the module-load singleton. That one seam improvement unlocks most of the
remaining coverage cheaply.

### 4.2 Break `App.tsx`'s dependencies — continue the strangle

The seams already exist; you've used them before. Two concrete, low-risk
extractions:

1. **A `<ModalLayer>` component.** The ~200-line block that conditionally renders
   ~23 modals is pure orchestration — it can move to its own component that
   subscribes to the same store. This is the biggest single line-count win and
   carries almost no regression risk because the modals already own their own
   open/close flags (per the `AGENTS.md` modal convention).
2. **An autosave hook** (`useAutosave`). The 60-second autosave/snapshot interval
   with its overlap guard is self-contained logic that belongs in
   `features/shared/` or `editor/`, not inline in the layout shell.

Both follow the architecture's own "where to put X" rules, so they're consistent
with — not a deviation from — the documented design. Target: `App.tsx` back under
~700 lines, then keep trimming opportunistically. Don't make it a big-bang
refactor PR; do it the next two times you're already in the file.

### 4.3 Tidy the low-cohesion spots (cheap, do-when-annoyed)

- **Give "coach" a folder.** Co-locate `CoachModal`, `use-ambient-cue`, and the
  coach handlers currently in `App.tsx` into a cohesive `features/coach/` home.
  Pure cohesion improvement; no behavior change.
- **Move prompt-ish content out of `lib/constants.ts`.** The 58 KB file mixes
  true constants with content that wants to be data. The prompt *registry* already
  demonstrates the pattern to follow.

### 4.4 Prune the small, known debts

Dead code is already near zero, so this is light. `STATUS.md` itself lists the
candidates: retire the `.env` AI-key fallback once the keyring path is verified;
productionize or formally mark-experimental the `agent-sidecar/` helper. These are
housekeeping, not stabilization.

### What you should *not* do

Don't add tests to the UI feature layer for coverage's sake — `STATUS.md`
correctly scopes those out, and brittle render tests are negative-value for a solo
dev. Don't refactor `types/index.ts` "to make it smaller" — it's defended for good
reason. Don't pursue 100% coverage; pursue *characterization of the seams that
hide regressions* (the AI orchestrators), which is a much smaller, higher-value
target.

---

## Section 5: If We Rebuild — A Process for Doing It Right

You're not rebuilding. But you asked how to avoid the vibe-coding trap on the next
project (or the next big feature), and the genuinely useful framing is this: **you
have already invented most of the antidote — you just may not have noticed which
of your habits are doing the work.** This section names them so they survive
contact with the next blank repo.

### 5.1 Define a clear MVP before writing code

The trap isn't building too little planning; it's building features whose scope
you discover *while* coding, which is how a tool sprawls. Your `VISION.md` /
`STATUS.md` split is already the cure: **`VISION.md` fixes the *why* and the
permanent non-goals** (no accounts, no telemetry, no i18n — *identity*-level
scope), and **`STATUS.md` carries the "Non-goals (out of scope by design — do not
pre-build)" list.** That second list is the MVP-discipline tool: every time you're
tempted to build for a hypothetical, you write it in the non-goals list *instead*
of in code. Keep doing exactly that.

### 5.2 A minimal branch/commit strategy

You already have the right one: short-lived feature branches → PR → **CI gate** →
merge. For a solo dev this is not bureaucracy; the PR + CI is the thing that
catches the regression you're afraid of *before* it lands. The commit history
(2.4) proves it's working — descriptive messages, no reverts. The one upgrade
worth making is in 5.4.

### 5.3 The minimum viable testing strategy for a solo dev

Not "test everything." The rule that fits a personal tool:

- **Unit-test the pure functions** (`lib/`) — they're cheap, fast, and catch real
  logic bugs. You already do this well.
- **Characterization-test the seams** where a wrong output is silent and
  expensive — here, the AI orchestrators and the repository/persistence boundary.
  (This is exactly the 4.1 gap.)
- **Don't** unit-test the UI render layer. The cost/benefit is bad for one
  developer.
- Let **CI** be the enforcer so the discipline doesn't depend on you remembering.

### 5.4 Avoid the tool-building-as-procrastination trap

There's a failure mode where building *infrastructure* feels like progress while
the actual tool stalls — what philosophers of action call **epistemic action**
(moves that improve your understanding/setup) crowding out **pragmatic action**
(moves that achieve the goal). Refactoring, adding test tooling, polishing docs:
all valuable, all also seductive ways to *not* ship the feature.

Your codebase shows *mild* symptoms — six full-screen "workspaces" (Compare, Glass
Box, Climate, Parallel, Gist, Generate-Specs) is a lot of surface for one writer's
tool, and it's worth periodically asking which ones *you actually use to write*
versus which were satisfying to build. The guardrail: **tie each new feature to a
concrete writing task you personally hit this week.** If you can't name the moment
it would've helped, it's epistemic action wearing a feature costume. The single
best upgrade to your process would be a one-line "what writing problem did this
solve for me?" field at the top of each `migration-log.md` entry.

### 5.5 Keeping AI-assisted development from re-creating the problem

This is the deepest point, and you've already solved it better than most:
**`AGENTS.md` is a machine-readable contract that makes the *next* agent
session produce consistent, in-architecture code instead of a new pile of
untested features.** Its "where to put X" table, its anti-patterns list ("will be
reverted"), and its definition-of-done ritual (ship isn't done until
`migration-log.md` + `STATUS.md` are updated) are *exactly* the mechanism that
prevents AI-assisted vibe-coding from accreting inconsistent slop. The reason your
codebase doesn't look vibe-coded is that you taught the AI the rules and gated the
output.

Two reinforcements:

1. **Turn the doc-update ritual into a CI/PR check**, not just a convention.
   `STATUS.md` already flags this: "add a lightweight pre-commit hook or PR
   checklist that flags a feature change which doesn't also touch
   `migration-log.md`." CI covers the *code* half of done; this closes the *docs*
   half. Then the ritual can't quietly lapse.
2. **Point every agent at `AGENTS.md` first** (you do). The whole system works
   because the rules are written down *and* enforced; neither alone suffices.

---

## Section 6: Concepts Glossary

A reference for the ideas used above, with sources, so you can read further.

- **Technical Debt** — the future cost incurred by choosing an easy/limited
  solution now over a better one. Coined by **Ward Cunningham (1992)** as a
  metaphor: like financial debt, it's fine if you pay it down, dangerous if the
  interest compounds. **Fowler's Debt Quadrant (2009)** classifies it as
  Deliberate/Inadvertent × Prudent/Reckless.

- **Hotspot analysis** — using version-control history to find files with the
  highest *change frequency*, on the empirical observation that defects cluster in
  a small fraction of frequently-changed files. **Adam Tornhill, *Your Code as a
  Crime Scene* (2015).**

- **Temporal coupling** — files that repeatedly change together in the same
  commit, which can reveal hidden dependencies the import graph doesn't show. A
  strong predictor of architectural decay. **Tornhill (2015).**

- **Complexity trend** — the trajectory of a file's size/complexity over its
  history. A monotonic climb signals unmanaged accumulation; oscillation signals
  active refactoring. **Tornhill (2015).**

- **Code churn** — total lines added + deleted in a file over time. High churn ×
  high complexity is the most dangerous combination: a complex file that never
  stabilizes.

- **Legacy code** — in **Michael Feathers' *Working Effectively with Legacy Code*
  (2004)**, defined simply as *code without tests*, regardless of age or quality.

- **Characterization test** — a test written to capture what code *currently
  does* (not what it should do), creating a safety net before you change it.
  **Feathers (2004).**

- **Seam** — a place where you can alter a program's behavior without editing in
  that place (e.g., by injecting a different implementation). Seams are the entry
  points for getting untested code under test. **Feathers (2004).**

- **Strangler Fig pattern** — incrementally replacing a system by building the new
  alongside the old and routing more behavior through it over time, until the old
  can be deleted. **Martin Fowler (2004).**

- **The rewrite debate** — **Spolsky (2000)**, "never rewrite from scratch":
  rewrites discard hard-won knowledge, overrun, and rarely end up better. The
  counterarguments (**Herb Caudill**, others) note the rule was framed for
  competitive commercial products and weakens for solo personal tools — though it
  still holds when the existing architecture is sound.

- **Separation of concerns** — structuring a system so each part addresses one
  responsibility (UI vs. state vs. persistence vs. external APIs), so parts can be
  understood, tested, and replaced independently. (Term traces to **Dijkstra**.)

- **God object / god component** — a single unit that knows about or coordinates
  too much of the system, becoming a change bottleneck and a regression magnet.
  The anti-pattern `App.tsx` mildly exhibits here.

- **Dependency inversion** — depending on an interface rather than a concrete
  implementation, so the concrete one can be swapped (the `Repository` and
  `AIProvider` seams). Enables both pluggability and testability.

- **Cyclomatic complexity** — **McCabe (1976)** — a count of the independent paths
  through a function (branches + 1), a proxy for how hard it is to test and reason
  about. Not separately measured in this audit, but the line-count and
  god-component findings are its cheaper cousins.

- **Epistemic vs. pragmatic action** — epistemic actions improve your knowledge or
  setup (refactoring, tooling); pragmatic actions achieve the goal directly
  (shipping the feature). The tool-building procrastination trap is epistemic
  action that never terminates into pragmatic action.

---

## Closing note

You came in worried this codebase was a liability. The forensic evidence says it's
an asset with one well-understood soft spot and a couple of cosmetic untidy
corners. The discipline you may not have credited yourself for — writing the
architecture down, gating it with CI, logging every change, tracking your own debt
honestly — is precisely what kept you out of the reckless quadrant while you moved
fast. The work ahead isn't repair; it's maintenance. Keep strangling `App.tsx`,
close the AI-orchestrator test gap, and trust the system you built — it's working.
