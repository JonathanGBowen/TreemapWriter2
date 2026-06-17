# TreemapWriter2 — Vision

> **The why.** Spirit, user, principles, aesthetic. This is the most stable
> document in the repo: it changes only when the *intent* of the project changes,
> which is almost never. It carries no file trees, counts, or command lists —
> those live in the code and in [AGENTS.md](../AGENTS.md). For the founding
> conversation that produced all of this, see [FOUNDING.md](FOUNDING.md). When a
> proposed change fights the architecture, the answer is usually here.

## Origin (why this codebase is shaped the way it is)

This tool was **vibe-coded** — built by rapid, iterative, largely AI-assisted
development — by the philosopher who also uses it. Vibe-coding is a practice less
than two years old: powerful (emergent design, fast iteration) and chaotic (no
clear seams, storage bottlenecks, a god-store, a thousand-line `App.tsx`). The
refactor that produced today's architecture existed to make that practice *safe
and sustainable* without killing what made it work.

Hold this context, because every constraint below descends from it. The
small-file target, the strict layering, the agent-legibility demands — these are
not generic best practices imported from an enterprise playbook. They are
load-bearing adaptations to a specific situation: a developer with ADHD,
practicing a novel methodology, on an artifact (a dissertation) whose loss would
be catastrophic. Read the constraints as *accommodations*, not as ceremony.

## What this is

TreemapWriter2 is a single-user assistive-writing tool built to help one
philosopher with ADHD finish a dissertation. It already does something
philosophically distinctive: **it does not summarize, it structures.** The
treemap surfaces the document's shape at a glance; the AI performs *structural*
— not summary — analysis of academic argument. It is not, and must not become,
an enterprise product.

What it needs is narrow and absolute: to keep working, to never lose data, to be
pleasant to re-enter after a week away, and to support structural analysis of
academic prose.

## The user (load-bearing — this is a person, not a persona)

- A working philosopher writing a dissertation. Highly intelligent, ADHD,
  twice-exceptional. Reads complex texts; writes sophisticated prose.
- Wants the tool to feel like Hyper Light Drifter's UI: spare, glyph-driven,
  immersive, conveying scale and history through restraint. *Almost no words in
  the UI itself.* Affordances are clear from shape and behavior.
- Has limited working-memory budget for the codebase itself. Help the future
  user-*with-this-codebase* as much as the current user-*of-the-app* — they are
  the same person.

Design *for this person*. The constraints in this document are the trace that
person's needs leave on the architecture; they are not a checklist to satisfy a
hypothetical audience that does not exist.

## The thesis: structure, not summary

The tool exists to respect the difference between **summary** (restating what a
text says) and **exegetical reconstruction** (rebuilding the argument's moves,
commitments, and dependencies). That distinction is encoded directly in the
domain types in [`src/types/index.ts`](../src/types/index.ts) — `SectionSpec`,
`RequiredMove`, `DiagnosticResult`, `SectionAnalysis`, and their kin are a
serious theory of academic prose, not a CRUD schema.

When you meet exegetical complexity — dependencies between moves, nested argument
structure, the gap between what a section claims and what it earns — the types
make room for it. When you are tempted to flatten that to something simpler,
you are working against the user's stated purpose: to structure academic
argument *without destroying its complexity*. This is a philosophical stance,
not a feature. **Those types are the most carefully considered part of the
codebase. Extend them only to respect complexity; never collapse or "simplify"
them.** Any feature that flattens the argument model back into "notes" or
"summaries" is, by definition, building the wrong tool.

## Principles

These principles flow from one root insight: **every piece of state has exactly
one canonical home; everything else is a projection.** The original prototype had
*no clear answer* to "what is the source of truth?" — the IndexedDB blob, the
store, and the editor buffer all behaved like it at different moments. That was
the underlying disease, and the persistence bugs were merely its symptoms.
Committing to a single source of truth is also what lets git do so much work:
once the markdown on disk is authoritative, **persistence, change-tracking,
multi-machine sync, and durability stop being four problems and become one
problem, solved once.**

1. **Separation of concerns** — a module has one reason to change. (The original
   `App.tsx` had at least seven; that is why it hurt to open.)
2. **Single source of truth** — one canonical location per datum; the
   dissertation's truth is the markdown on disk, everything else (SQLite,
   in-memory state) is a rebuildable projection.
3. **Persistence ignorance / dependency inversion** — domain logic depends on a
   `Repository` interface; storage implementations depend on it, never the
   reverse. The same inversion governs AI: domain logic depends on an
   `AIProvider` interface, never on a vendor SDK. This is what let IndexedDB
   become SQLite without touching a single component.
4. **Content-addressable, append-only history** — past states are immutable; new
   states are derivations. This is git's central insight, and a dissertation is
   *exactly the kind of artifact that wants to live in git*: long-form,
   incremental, branchable, recoverable. So we do not imitate git — we **use the
   actual git binary.** Snapshots are commits; undo is checkout; history is the
   `git log`.
5. **Reversibility and durability proportional to stakes** — the harder a mistake
   is to recover from, the more redundant the safety net should be. *This is a
   dissertation.* The safety net should be **excessive**: three independent
   recovery paths — human-readable markdown on disk, a rebuildable SQLite cache,
   and git history pushed to a private remote. Never lose user input, across
   crashes, reloads, or AI errors; the local draft persists separately from the
   committed copy.
6. **Minimum cognitive surface area — the ADHD principle.** A folder structure
   should answer "where does X go?" in five seconds, and a file should fit in
   working memory. A 1,000-line `App.tsx` is a ravine you fall into; a 60-field
   god-store is an interrogation room. The ~300-line target is not about
   performance — it is a cognitive-load budget, because **executive function is
   the scarce resource here.** (ESLint warns rather than errors; see
   [AGENTS.md](../AGENTS.md) for how it's tooled and what debt remains.)
7. **Agent-legibility** — the codebase teaches a future AI agent (or a returning
   human) how to extend it correctly *without re-deriving design intent each
   session*. The documentation set is part of the product. Keeping it honest is
   load-bearing, not housekeeping: every session that pays the re-derivation tax
   is a session the user paid for.

## Aesthetic

"Juicy" feedback here is an **interaction paradigm — tactile, responsive,
magical — not merely a visual theme.** The point is that the *core, intended use
of the app* should itself feel cool and compelling: building the treemap,
running a diagnostic, watching an analysis assemble. Visual polish exists to
amplify those moments of consequence; it is never decoration at the margins.

- **Hyper Light Drifter** dark theme is the canonical look — spare, glyphic,
  conveying scale and history through restraint. HLD barely used words and was as
  functional as it was beautiful; its UI was a record of depth that *rewarded
  exploration*. Design in that spirit: restraint is respect for the user's
  attention, not austerity. No light mode is required.
- Use the `hld-*` design tokens, not raw colors. Typography: JetBrains Mono for
  chrome and any glyph-like UI; a serif for the prose surface.
- "Juicy" feedback is permitted only at the **moment of consequence** — saving,
  diagnosing, syncing. It is forbidden as ambient decoration. The test: if an
  animation communicates something about the system's state or effort, it earns
  its place; if it merely pleases the eye, it is noise.
- No emoji in UI text. The aesthetic is glyphic and quiet.

## ADHD-aware UX

- **Default to fewer choices.** If a screen offers more than five primary
  actions, it is wrong.
- **Save automatically.** Never ask the user to confirm a save.
- **Make destructive actions undoable, not confirmable.** Confirmation modals are
  an executive-function tax. (The one exception is deleting a project.)
- **Show progress** for any operation over 200 ms. **Streaming AI output,
  token-by-token, is the *preferred* accessibility feature for an ADHD writer** —
  it makes the system's thinking visible, kills the suspended-anxiety "is it
  working?" moment, and keeps the writer engaged with the work. Spinners are the
  minimum fallback, not the goal.
- **Surface state at a glance** via color and shape, not text. The treemap is the
  primary affordance for "where am I in this document?".

## What we will not build

These are not deferred features — they are out of scope by *identity*. Do not add
them, and do not propose them: user accounts, billing, RBAC, telemetry, A/B
testing (the *product-experimentation* kind — splitting users into cohorts to
measure a metric; this is **not** the Version Compare feature, which compares two
drafts of the user's *own* prose and is squarely in scope),
internationalization, multi-tenant anything, or feature flags for a hypothetical
user. The default answer to "should we add this dependency?" is no.

A configuration knob without a default that does the right thing, and a feature
flag for a user who does not exist, are both anti-patterns here. (Currently
out-of-scope *roadmap* items — multi-branch git, SSH auth, real-time
collaboration — live in [STATUS.md](../STATUS.md), not here.)

## Closing — what the refactor was really for

The deepest reason for this architecture is not storage efficiency or the
file-size cap. It is that the domain types already encode a serious theory of
academic prose, and for too long they were jostling for room inside a JSON blob,
next to `sidebarWidth` and `showProjectModal`. **The real work was to give that
philosophical model the architectural seat it had earned** — its own layer, its
own persistence, its own respect.

The git decision is the same move at a different scale. The question was never
whether to *imitate* git's change-tracking. It was to admit that **git is what
this writing was always reaching for** — and to let it do what it already does
better than anything we could build.

---

*For how the app is actually built today, see [AGENTS.md](../AGENTS.md). For
what's being worked on next, see [STATUS.md](../STATUS.md). For the founding
conversation, see [FOUNDING.md](FOUNDING.md). For the dated record of how it got
here, see [migration-log.md](migration-log.md).*
