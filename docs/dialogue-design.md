# Dialogue design — the Interlocutor and the anchored corridor

> **What this is.** The design record for the dialogue-expansion wave: why the
> app's conversational surface grows the way it does, what law governs every
> dialogue affordance, and what was deliberately refused. Written before the
> implementation increments; the shipped record is `STATUS.md` and
> [`migration-log.md`](migration-log.md), which are canonical. When this essay
> and the code disagree, trust the code.
>
> **Provenance.** Produced by a three-lens design study (attention-guardian /
> clinical, Hyper-Light-Drifter interaction design, systems integration) over a
> full exploration of the existing chat-shaped surfaces, the coach subsystem,
> and the activity/context sources reachable from the TypeScript side. The
> owner set the brief: expand dialogue beyond the analysis-tethered Socratic
> tab — coaching integration, git-history awareness, gap identification, an
> optional self-maintaining memory — *"totally optional and not distracting…
> a tendency of slingshotting the user back at their own work task rather than
> dissipating their work efforts in endless experimentation."*
>
> **Owner decisions recorded here** (2026-07-10): memory ships as the single
> **Memorandum** snippet (not a field-notes ledger); the 90-second stall
> escalation is **repointed** from the whole-document CoachModal to a bounded
> section-grained *unstick* dialogue; the wave ships as this essay plus four
> implementation increments.

---

## I. The finding — one dialogue, five copies, and unburned fuel

The right column's Dialogue tab is the app's only direct-AI dialogue, and it is
strictly a dependent of the Analysis feature: it can only be seeded from the
Analysis tab, and its empty state cannot start a conversation. That narrowness
is an accident of history — but it contains a correct instinct this design
elevates into law (§II).

Around it, the codebase already carries five other chat-shaped surfaces — the
Glass-Box directive dialogue, the sprint coach, the spec-level chat, the
one-shot coach stream, the local-agent console — each hand-copying the same
transcript/bubble/streaming idiom. And the fuel for exactly what the owner
asked for is already on board, unburned:

- Focus builders exist for interrogating a thesis, concepts, argument,
  support, or an entire analysis — only *objections* ever got a button.
- `SessionRecord.carryForward` — the app's own gap-capture, written at every
  check-out — is never re-surfaced at the next check-in.
- The `Repository` already reads git and sessions (`listSessions`,
  `listSnapshotMeta`, `wordCountDelta`, `listTags`); no prompt consumes them.
- `lib/reinstate.ts` ships an `extraFragments` seam documented as waiting for
  richer reinstatement material.

So the expansion is mostly *ignition*, not construction: the gap is
integration, the same verdict the 2026-06-29 AI-integration audit reached for
agentic AI.

## II. The law — dialogue as an anchored corridor, never a venue

In Hyper Light Drifter you do not chat with anyone. You meet figures at fixed
sites, receive a wordless orientation, and are sent back into the world. That
is the correct model for conversation in this tool.

**A conversation here is a corridor between two locations in the work, never a
destination.** Every dialogue *begins* anchored to a concrete structural
occasion — an objection, a strain signal, a stall, a re-entry after days away,
a coach plan worth contesting — and *ends* by depositing one concrete artifact
back into the work: a landed caret, a session wish, a next action, a new
analysis version. The corridor law has three clauses:

1. **No lobby.** There is never a blank composer. The Dialogue tab's inability
   to start an unseeded conversation stops being an accident and becomes an
   invariant of the shared composer: dialogue is entered only by *taking
   something to dialogue* (the ⊕ affordance). An "ask me anything" box is the
   archetypal senseless task — an affordance whose document-purpose the writer
   cannot state — and its absence is the design (VISION principle 8).
2. **A terminal artifact, or the opening doesn't ship.** Every dialogue
   *opening* (the typed occasion) declares the fenced terminal block the model
   must converge on and the exit affordance that consumes it. An opening with
   no artifact is definitionally busywork and is cut at design time.
3. **The exit outshines the entrance.** The one lit element in any dialogue
   surface is the way out — the deposit chip that jumps the caret back into
   the prose with the reveal pulse. Sending a message is always the quiet
   action. The only "juicy" moment a conversation is permitted is the deposit:
   the dopamine gradient points at the manuscript.

**Why a dialogue at all, then?** Because the alternatives at these moments are
worse. A briefing (the dashboard, a static cue) cannot be steered — "actually,
I want to work on the objections section today" — and a form cannot push back.
Dialogue earns its place exactly where the writer's own account of the
situation must meet the structure's account of it, and nowhere else.

## III. The shape — one presence, typed openings, deterministic context

**One presence, one home.** There is exactly one conversational surface — the
right column's Dialogue tab, generalized to host *openings* — and one house
voice. The embedded flow dialogues (directive, sprint coach, spec chat) stay
where they are: they are already anchored corridors inside their workspaces.
They converge on shared rendering primitives, not on a shared method.

**Unify three layers; refuse two.** The renderer (one shared
transcript/composer kit), the context assembly (deterministic builders over
canonical records), and the guardrails (convergence, terminal contract,
no-lobby) are unified. The per-genre `AIProvider` methods and their
persistence are *not*: `continueDialogue`, `directiveDialogueTurn`,
`coachSprintTurn`, `developSpecLevel` each encode a distinct speech genre with
a distinct contract, and flattening them into a generic `chat(kind)` would be
the conversational version of collapsing the domain types — the same disease
as summarizing. One new method (`interlocutorTurn`) serves all *new* openings,
because they genuinely share one contract: inquiry, convergence, deposit.

**The openings** (v1 set, ranked by clinical leverage):

- **Re-entry** — the highest-leverage moment. Context reinstatement is this
  writer's single most expensive act; the app now reconstructs where they left
  off (last sessions' wish/obstacle/carry-forward, snapshot subjects, word
  delta rendered as approximate magnitude) and converges on one located wish.
  Entered from the session check-in or the resume marker. Deterministic first:
  carry-forward lines render as tappable chips *before* any AI is involved —
  the dialogue is the fallback for when the carry-forward has gone stale.
- **Gap** — the structure's own account of what is absent, which is precisely
  what gap-blindness cannot generate: commitment-mesh breaks, strain signals,
  missing/empty moves, the gap→vector next action — taken to dialogue from the
  register row or the analysis card.
- **Coach-plan** — the coach's triage becomes contestable. The one-shot stream
  stays; a quiet ⊕ takes the finished plan to dialogue, where the writer can
  push back before committing to a sprint. The coach's context finally
  includes recent activity, so its triage knows what happened last sitting.
- **Unstick** — the 90-second stall's escalation, repointed from the
  whole-document coach to a three-exchange, section-grained exchange with
  exactly three permitted outcomes: a located next action *here*; a
  recentering (the goal may be the block — handed off to the existing
  recentering machinery, never re-derived in chat); or **permission to stop**
  ("this move is good enough — move on"), the first home of the Good-Enough
  gate (STATUS F3). The ambient cue itself stays deterministic and AI-free;
  AI joins only on the writer's tap.

**Context is assembled, never remembered.** Every opening's context is built
at open time by pure, deterministic composers over canonical records — git
snapshots, session YAML, specs, diagnostics, the strain register — with fixed
character budgets and approximate-magnitude rendering. No AI summarizes
history for the AI; derived context is computed fresh, because a cached
AI-written digest would be a second source of truth by another name. (The
session records are deliberately preferred over re-parsing git trailers: the
YAML is the same data, richer and already typed.)

**The voice is a design material.** A locked house-voice prompt governs every
new opening: at most three sentences per turn; exactly one question while
inquiring; no praise, no filler, no restating what the writer just said; every
turn points at a location in the document; demand rhetoric — what the
structure requires — never chore rhetoric; and by about the fourth exchange,
stop asking and propose the deposit. The partner talks like a margin note
written by a severe, well-disposed reader. No name, no face, no persona
settings: the glyph is ⊕, the voice is the prompt.

## IV. The Memorandum — memory with a fence around it

Almost everything a "memory" could hold is already held better by canonical
sources — sessions, snapshots, specs, carry-forward — and duplicating those
into an AI-maintained blob would violate single-source-of-truth. What no
canonical record holds is the writer's **standing intent**: "chapter 2's
framing is settled — do not reopen it"; "the examiner cares most about the
Husserl chapter"; "stop suggesting I split the long section — it is long on
purpose." That is the Memorandum's entire jurisdiction.

- One plain-markdown snippet, hard-capped (~1,200 characters, enforced in the
  setter), living in the project as `.twriter/memorandum.md` — committed, not
  gitignored, so git is both its history and its undo.
- The writer holds the pen. The AI may *propose* a revision only inside a
  dialogue's terminal block, rendered as a diff beside the exit chip,
  default-skip. Never an autonomous write, never mid-conversation, never at
  moments the writer didn't convene.
- **The symmetry rule keeps it honest:** wherever the Memorandum is injected
  into a prompt, it is the verbatim text the writer can read and edit on
  screen at that moment. The model never knows anything about the writer that
  the writer cannot see.
- **The no-inference rule keeps it clean:** document-facts and stated
  commitments only — no trait claims, no "you tend to…", no behavioral
  inference. The rule lives in locked prompt text so it cannot drift.
- Empty means invisible: no toggle, no flag, zero footprint until first use.

## V. Anti-distraction mechanics (not platitudes)

1. **No lobby** (§II.1) — structurally unstartable idle chat.
2. **Convergence horizon in the prompt** — the proven converge-fast contract
   from the directive dialogue, generalized: the model itself steers the
   conversation shut.
3. **Turn pips, soft yield** — each opening declares a small turn budget,
   rendered as depleting pips (the HLD health-chunk idiom: state via shape,
   no words). At exhaustion the composer dims and the exit lights; a quiet
   "one more" affordance permits continuation. Never a hard lockout — a
   lockout is itself an executive-function tax, and scolding is worse.
4. **Transcripts die into artifacts** — new openings are ephemeral by design;
   what mattered was deposited into its canonical home. No archive, no
   history browser, nothing to curate: the analysis dialogue alone stays
   persisted, because it is part of the analysis record.
5. **The AI never initiates.** No proactive turns, no notification badges, no
   pulsing tab beyond the existing quiet pip. Every ambient cue stays local
   and deterministic; entry is always a deliberate ⊕.
6. **One dialogue at a time** — one active opening; opening a new one ends
   the old (undo-not-confirm; it was ephemeral by contract).
7. **The exit is the juice** (§II.3) — the deposit chip gets the one earned
   pulse; replies render with restraint.

## VI. Refused (tempting, and wrong here)

- A general-purpose chat box, dock chat glyph, or floating companion.
- A generic `chat(kind)` provider method absorbing the existing genres.
- A conversation archive or search over past transcripts.
- AI-initiated messages of any kind ("I noticed you've been stalled…").
- Behavioral memory, session-pattern analytics, embeddings/RAG over chats —
  telemetry wearing a face, even at n = 1.
- Persona play: names, avatars, personality sliders, multiple companions.
- A dialogue settings surface. The one knob is the prompt text itself,
  already user-editable through the prompt library (locked voice excepted).
- A git-trailer-reading IPC command (the session YAML already carries it).
- Autonomous writes from dialogue to anything — prose, specs, Memorandum.
  Everything lands through a gated accept. No exceptions for "small" edits.

## VII. The increments

1. **The shared kit + dead seams** — extract the dialogue rendering/streaming
   primitives; wire the dormant interrogation foci; add the deterministic
   gaps focus. No new AI method.
2. **The activity spine + re-entry** — the pure activity brief over
   sessions/snapshots (also fed to the coach and the sprint reinstatement
   seam); carry-forward chips at check-in; the `interlocutorTurn` flow, the
   openings substrate, and the re-entry opening.
3. **Coach, gap, unstick** — the contestable plan, register-row openings,
   and the repointed stall.
4. **The Memorandum** — the persisted field chain (the one Rust-touching
   increment) and the gated diff proposal.

Each increment ships whole under the definition-of-done ritual. The shipped
truth lives in `STATUS.md` and the migration log; this essay records only the
why.
