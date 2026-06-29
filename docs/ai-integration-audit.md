# TreemapWriter2 — Agentic AI Integration & Human-AI Interaction Audit

> **The audit.** Where agentic (multi-turn, tool-using) AI fits versus single
> one-shot calls in this app, which emerging Human-AI-interaction findings should
> govern the AI UX, and the low-risk fixes that follow. A point-in-time analysis
> (2026-06-29) grounded in a fact-checked survey of eight HAI literature areas and
> three codebase explorations. For *why* the app is shaped this way see
> [`VISION.md`](VISION.md); for *how* it's built see [`../AGENTS.md`](../AGENTS.md);
> for *what's next* see [`../STATUS.md`](../STATUS.md). This doc is analysis +
> recommendation; once an item ships, its facts live in the code, not here.

## Context — why this audit

The question was whether the agent AI "just barely wired up" is being put to
effective use, where agentic calls fit versus single one-shot calls, and how to fix
an ad-hoc AI configuration/UX flow using current Human-AI interaction research.

**The headline correction:** the app is *not* minimally wired. It has ~30 typed AI
call-kinds, a clean provider-agnostic seam, and **two** complete agentic substrates
— the experimental Claude Agent SDK transport and a provider-agnostic local
`runAgent` tool-loop (repo read, FTS5 search, git history, a scoped writer to
`.twriter/agent-output/`, two routines). The real problem is precise: **the agentic
plumbing exists but is not *integrated*.** Both substrates are off by default,
terminate in a free-text answer inside a settings console, and are woven into *no*
feature workflow. That is exactly why it doesn't feel "put to effective use." The
work is integration and interaction design, not new plumbing.

---

## 1. Capability audit (what's actually here)

| Layer | State today |
|---|---|
| Provider seam | `AIProvider` interface → provider-agnostic impl → one `LLMClient` per provider (Gemini, Anthropic, Ollama, Agent-SDK). Quota-aware fallback ladder, per-minute throttle, context-fit pre-flight, tolerant JSON parsing. Mature. |
| Single-call flows (~30 kinds) | Diagnostic, analysis, dialogue, specs, revisions, reverse-outline, gist, sprint coach, compare, spec-test, atmosphere, gestalt. Mostly correct modality. |
| Agent substrate A — Claude Agent SDK | Routes dialogue+coaching via Max sub through `agent-sidecar/`. Off by default, hand-started. |
| Agent substrate B — local `runAgent` | ~90-line multi-turn loop (`src/services/ai/agent/agent-loop.ts`), prompted-JSON tools, whole-text-first context, FTS5 + git-history + scoped writer. Off by default; surfaced only as an inline console in AI settings. **Integrated into zero features.** |
| Streaming + trace | `emitAgentTrace` sink → `AgentTraceTicker`/`AgentTraceModal`; global activity pill. Strong foundation; streaming is already the stated preferred a11y primitive. |
| Config / settings UX | **Fragmented and ad hoc:** global AI settings live inside a *misnamed* `PersonaSettingsModal`; three near-identical per-feature settings modals duplicate a prompt-editor + token-preview; `RevisionTokenPreview` is misfiled under `modals/`; `PersonaSettingsModal` takes data props, violating the self-mounting modal convention; inline `style={{}}` islands bypass the HLD token system. |

## 2. The core finding: plumbing without integration

The local agent ends in a text blob in a console, never in the accept/reject idiom.
The fix is not "use the agent more" — it is to **route a small number of genuinely
agent-shaped tasks through the surfaces that already exist** (Glass-Box
`ProposalsColumn`, the Argument Topology modal, the trace ticker), and keep
everything else single-call. The literature is unambiguous about which is which.

## 3. Single-call vs agent — the decision rubric (literature-grounded)

Use an **agent** only when *all three* hold; otherwise use a **single call**.

1. **The path can't be hardcoded but progress *can* be verified** by a *non-model*
   oracle — a held spec/rubric, an FTS5 hit, a git diff, the dependency mesh, or the
   human. (Anthropic, *Building Effective Agents*, 2024; Huang et al., ICLR 2024 —
   LLMs can't reliably self-correct without external feedback.)
2. **The task needs grounding in external state** beyond one context window —
   multi-hop retrieval, cross-section reference, history reasoning. (Yao et al.,
   *ReAct*, ICLR 2023 — tool loops earn their keep by grounding, not "thinking
   harder.")
3. **Run-to-run nondeterminism is acceptable** because a human gates the result.
   (tau-bench, Yao 2024: pass@1 ≈ 61 % collapses to pass^8 ≈ 25 %; 0.99¹⁰⁰ ≈ 37 % —
   error compounds, so never put an agent behind a surface that must be stable.)

**Force a single call when:** the output has a known schema that must render
deterministically (the treemap diagnostic), the action commits text under the
author's name (Glass-Box accept), the loop is turn-by-turn *with the human* supplying
feedback (dialogue/coach), or the task is routing/classification (F5 triggers).
Schema-constrained decoding makes a single call ~100 % well-formed (OpenAI Structured
Outputs, 2024); an agent there only adds latency, cost, and nondeterminism.
**No external verifier → no loop.**

## 4. Where agents clearly realize the mission (ranked, bounded + gated)

All three end in *existing* gates; none writes `project.md` autonomously.

1. **Manuscript-wide commitment / dependency audit** — *"find every place commitment
   X is assumed but never argued."* Multi-hop ACQUISITION+ANALYSIS that exceeds one
   context: FTS5 search + cross-section read + iteration. Safe to automate *high*
   because the output is a **diagnostic, not an edit**. Routes into the **Argument
   Topology modal** / dependency mesh; findings reach prose only via Glass-Box.
   *Basis:* ReAct; Parasuraman/Sheridan/Wickens (automate early stages high,
   decision/action low).
2. **Cross-section consistency / argument-drift trace over git history** — trace a
   claim's lineage and detect where commitments drifted across revisions. Open path,
   verifiable via git diffs + FTS5 — the exact criterion for promoting to an agent.
   Writes durable artifacts to `.twriter/agent-output/`; manuscript changes still go
   through Glass-Box.
3. **Bounded move-completion loop inside a Living Sprint** (pairs with the **F3
   "Good-Enough" gate**) — a *short*, step-capped loop scoped to **one RequiredMove /
   one section**, with a ground-truth check each step (does the prose now realize
   this move per the held diagnostic?). The **rubric — not the model — declares
   Good-Enough**, supplying the F3 stop signal honestly. *Basis:* Huang 2024
   (external feedback); Shinn et al., *Reflexion* (2023), anchored to an external
   signal.

**Implementation note:** #1 and #3 reuse the *existing* `runAgent` + tool registry +
trace sink; the new work is wiring their **final answer into a typed gate**, not new
agent code. The flagship near-term build is a fourth, even more direct one: a
**multi-step structural-revision agent** that gathers cross-section + source context,
then emits the *same* `RevisionProposal[]` the Glass-Box already accepts.

## 5. What should stay single-call (don't "agent-wash" these)

The structural **diagnostic** (schema-constrained, must render deterministically,
re-run constantly); **Glass-Box** proposal generation (one call → one span-anchored
proposal, human is the verifier, snapshot is the checkpoint); **Socratic Dialogue**
and **Coach** (multi-turn *with the human* each turn — the safe form of multi-turn);
**Generate-Specs** (one structured call per level, human-gated between levels — the
gate is the error firewall); **Spec Test** (single scoring call vs the *external*
held rubric, A/B order randomized to defeat position/verbosity bias); **Gist/Parallel**
(deterministic transforms pinned to live text); **F5 routing**. Dependency
*estimation* stays single-call too — one bounded classification pass; tool use adds
latency without insight.

## 6. The HAI-literature UX audit + low-hanging fruit

Eight cross-cutting principles, each sourced, then the concrete fixes.

- **Spend working memory on the argument, not the tool.** Intrinsic load (writing
  philosophy) is maxed; chrome, words, confirmations, and knobs are all extraneous
  load to delete. (Sweller/van Merriënboer/Paas 2019; Amershi G1/G2 rendered
  glyphically.)
- **Externalize state into the spatial surface; never force reconstruction from a
  scrolling transcript.** The treemap is the memory prosthesis — load-bearing
  *because* recognition memory is 2nd–5th %ile. Chat is for stating intent and
  synthesizing results only. (Weiser & Brown 1995.) → **Do not bolt a chatbot on as
  the primary agent surface.**
- **Calm by default, juicy at consequence.** Proactive nudges defer to a natural
  pause (~3–5 s after typing stops, never mid-keystroke/mid-move). (Chen et al., CHI
  2025; Horvitz bounded-deferral.)
- **Co-locate instruction with action** to defeat split-attention — a RequiredMove's
  guidance appears *on the live prose the moment the move becomes active* (F5), not
  as a skippable pre-gate. (Chandler & Sweller; Amershi G3.)
- **Undoable, not confirmable; dismissable, correctable.** Confirmation dialogs are
  an executive-function tax, not safety. (Amershi G8/G9/G17.)
- **Carry confidence in the UI (color/shape), not in disclaimer prose**, on an
  inverted-U (medium, occasional honest doubt beats both false certainty and hedge
  spam) — LLMs are systematically overconfident and users inherit it. (Parasuraman &
  Manzey 2010.)
- **Opinionated defaults over knobs** — every exposed parameter is a decision-fatigue
  tax; collapse to one default path + one meaningful axis behind ≤2 disclosure levels.
  (Nielsen progressive disclosure.)
- **Offload mechanics, defend metacognition** — keep the writer planning/evaluating
  via *surgical* forced-justification friction at moments of consequence; never
  substitute for their reasoning. (Fan et al., *metacognitive laziness*, BJET 2025;
  Lee et al., CHI 2025.)

**Low-hanging-fruit config fixes:** expose **one meaningful axis — autonomy level
(single-call default vs opt-in bounded agent), per task** — not a wall of
provider/temperature toggles. Default everything to single-call; keep both agent
substrates clearly **off** until each has a verified use. Replace any numeric
autonomy dial with a glyphic per-surface **role** ("approver" default vs "observer"
opt-in). Name the misnamed AI-settings home, de-duplicate the three feature-settings
modals into one shared shell, move `RevisionTokenPreview` to `shared/`, and fix the
prop-violating modal. When the agent *is* on, declare its scope glyphically (reads
repo / FTS5 / git; writes only `.twriter/agent-output/`) and stream its step-trail
with a one-tap kill.

## 7. Provenance / authorship marking (F2) — the highest-leverage integrity fix

Recognition memory is 2nd–5th %ile and people misremember authorship a week later —
steepest in mixed human/AI workflows. So this is a **safety requirement**, not a
nicety, and the single highest-leverage change.

**Recommendation:** a durable provenance **layer** in the document model, not inline
markers. Every AI-introduced span carries an origin record (surface, act-type,
timestamp) that survives reload, snapshot, and Version Compare, applied **at
accept-time** (no AI call). Render it HLD-glyphically as a thin gutter mark / a
desaturated tint that **decays toward the user's own color as the span is rewritten**
— so "how much of this is still the machine's" is readable at a glance, wordlessly,
and genuine authorship is *rewarded*. (Draxler et al., *Ghostwriter Effect*, TOCHI
2024 — *control*, not personalization, restores ownership.) **Differentiate by
act-type on an escalating scale:** a retyped coach nudge < an accepted Glass-Box edit
< a wholesale-generated paragraph (most insistent until transformed), because
attribution is non-binary and whole-cloth generation carries the highest risk (He,
Houde & Weisz, CHI 2025). **Surfacing is the point** — latent/metadata-only marking
fails the notice purpose. Keep it a **private accessibility prosthetic: persistent
inside the app, strippable on export** so the external-reader "transparency penalty"
never touches the dissertation.

**Why now:** it pairs with every text-generating flow and especially the
sourceless-revision and agent paths, which today inject **unmarked** prose
(`normalizeRevisions` drops the verbatim receipt in `sourceless` mode —
`src/lib/revision-helpers.ts`). The accept-time chokepoint already computes the
insertion offset (`findProposalOffset`/`applyProposal`), so instrumentation is one
shared helper.

## 8. Anti-patterns to avoid

Agent-by-default / agent-washing (multiplies cost + failure on stable surfaces);
naive self-correction loops with no external oracle (feeds the perfection loop);
letting the model grade/accept its own output (LLM-as-judge bias — anchor to the held
rubric + human); **explanation theater** (showing reasoning does *not* prevent
over-reliance without a cognitive-forcing beat — Buçinca et al., CSCW 2021);
tone-as-epistemics; **chat-first as the primary surface** (defeats spatial memory);
confirmation dialogs as "safety"; transient/latent-only provenance or a single flat
"AI" tag; whole-context-by-default on a book-length manuscript (lost-in-the-middle,
Liu et al. 2024 — prefer FTS5-scoped retrieval); multi-agent orchestration creep for
a single-user app; reality-detached agent busywork (every step must yield a concrete
artifact — a diff, a found span, a file — per the "no senseless task" law).

## 9. Open tensions (literature vs ADHD-calm) and how we resolve them

- **Risk-contingent autonomy vs minimal-surprise.** Gate at **risk-defined
  delegation moments only** (any `agent-output` write, any manuscript-touching
  action); replace per-step confirmation with **continuous streamed visibility +
  one-tap kill** — oversight as ambient peripheral state, not modal interruption.
- **Cognitive-forcing reduces over-reliance but is the design users like least.**
  Deploy it **surgically and reframed as concrete document work** (name *which*
  RequiredMove a Glass-Box change satisfies; commit a one-line Socratic answer before
  reveal) — undoable, never optimized purely for the frictionless path the
  perfection-prone user subjectively prefers.
- **Stream-everything vs calm/glyphic.** Stream token-by-token only for what the user
  is *actively waiting on* (diagnostic, coach, agent step-trail) — that streaming *is*
  the "why" (Amershi G11) — while routine status stays peripheral color/shape.
- **Whole-text context vs lost-in-the-middle.** Treat full-context and FTS5 retrieval
  as complementary, chosen by document length, with a quiet glyph for which ran.
- **Calibrated doubt vs a decisive Good-Enough signal.** Encode confidence as a
  per-finding glyph ("probably" vs "definitely" missing); reserve honest doubt for
  genuinely uncertain findings; keep the F3 "this clears the spec" signal unambiguous.

## 10. Recommended roadmap

Four workstreams, low-risk → high. All reuse existing primitives — `ModalShell`,
`SegControl`, `ModelPicker`, `Disclosure`, `Pip`, `Spinner`,
`ProposalsColumn`/`ProposalCard`, `notifyAiError`, the trace sink,
`normalizeRevisions`/`applyProposal`, the anchor-relocation pattern
(`SavedOutlineBullet`/`GistSegment`), the `StateField` decoration precedent
(`lib/livePreview.ts`), `runAgent`/`buildToolRegistry`/`buildAgentContext`, and the
opaque-`Value` sidecar pattern (`gist`/`reverseOutlines`).

- **WS1 — AI-config consolidation** (pure refactor; no persistence). Move
  `RevisionTokenPreview` → `shared/`; extract one `FeatureSettingsShell` for the
  three feature-settings modals; rename `PersonaSettingsModal` → `AiSettingsModal`
  with a `SegControl` "Model & keys"/"Personas" split; fix the prop violation (read
  from store); surface the one autonomy axis with the agents off by default.
- **WS3 — Point-of-action move instructions (F5)** (no persistence). `ActiveMoveMarker`,
  a sibling of `ResumeMarker`, surfaces the active move's vector in the left margin
  when the move becomes active; a pure `selectActiveMove` selector; reads the cached
  `lastDiagnostic`.
- **WS2 — Durable provenance layer (F2)** (the one persisted-field migration).
  `ProvenanceMark`/`ProvenanceDoc`; a `.twriter/provenance.json` sidecar following the
  **opaque-`serde_json::Value`** rule end-to-end; a `markProvenance` helper at the two
  accept hooks; a `lib/provenanceMarks.ts` CodeMirror `StateField` with a decaying
  tint. Land TS + Rust together.
- **WS4a — Flagship bounded+gated structural-revision agent.** Behind
  `localAgentEnabled`, a "deep pass" toggle runs `runAgent` with a locked
  `revision-agent-preamble.md`, gathering cross-section/source/git context then
  emitting `RevisionProposal[]` parsed by `normalizeRevisions` into the unchanged
  `ProposalsColumn` accept path (snapshot + `applyProposal` + a provenance mark). The
  agent *proposes*; the human *accepts*; it never writes `project.md`.

**Sequencing:** WS1 → WS3 → WS2 → WS4a. WS2 lands on its own commit (highest blast
radius). WS4a depends on WS1's config surface and pairs with WS2.

## 11. Verification

- **Each workstream:** `npm test`, `npm run typecheck`, `npm run build` (and
  `cargo test` for WS2) pass.
- **WS1:** open AI settings from a forced key error (`notifyAiError`) → lands on the
  keys tab; the three feature-settings modals render identically post-refactor;
  `ModalLayer` passes no data props.
- **WS3:** unit-test `selectActiveMove`; manual — type into a section with an unmet
  move → the vector appears near the caret, click jumps, no collision with
  `ResumeMarker`.
- **WS2:** Rust round-trip test for `.twriter/provenance.json`; unit-test
  `markProvenance`; manual — accept a Glass-Box/Parallel edit → the tinted span
  persists across reload + snapshot restore, decays as rewritten, strips on export.
- **WS4a:** with the local agent enabled + a deep-pass run, the trace ticker streams
  tool calls; the final answer parses into proposals in the unchanged
  `ProposalsColumn`; accept routes through the snapshot + provenance path; the agent
  never writes `project.md`.

---

*Sources (fact-checked, sample): Horvitz CHI 1999; Parasuraman/Sheridan/Wickens IEEE
SMC 2000; Sheridan & Verplank 1978; Amershi et al. CHI 2019; Anthropic "Building
Effective Agents" 2024; Yao et al. ReAct ICLR 2023; Yao et al. tau-bench 2024; Huang
et al. ICLR 2024; Shinn et al. Reflexion 2023; Liu et al. "Lost in the Middle" 2024;
Buçinca et al. CSCW 2021; Draxler et al. Ghostwriter Effect TOCHI 2024; He/Houde/Weisz
CHI 2025; Chen et al. CHI 2025; Weiser & Brown 1995.*
