> **Frozen source document.** The donor spec for the integration roadmap in
> [`arpeggio-integration.md`](arpeggio-integration.md) — a complete from-scratch
> design for "Arpeggio," a hypothetical Wertheimer-grounded writing instrument,
> written as a prompt for a coding agent. Provided by the user 2026-07-02. This is a
> historical record, like [`FOUNDING.md`](FOUNDING.md): **do not edit it and do not
> implement from it directly** — the roadmap adjudicates which of its features enter
> this app and in what adapted form, and where the two disagree the roadmap wins.

# ARPEGGIO — a writing instrument for configurational minds

**A prompt and specification for Claude Code.** Read this document in full before writing any code. It is self-contained: everything you need to see the point is here, and seeing the point is a precondition for implementing it well, because most of your moment-to-moment implementation decisions should be arbitrated by the theory in §2 and the principles in §4 rather than by web-app convention.

---

## 1. Mission

You are building **Arpeggio**, a local-first desktop application for writing long-form argumentative prose — specifically, in the first instance, a philosophy dissertation.

The user it is built for has a specific and coherent profile: they grasp difficult intellectual material **holistically** — the argument arrives as a simultaneous configuration, substantially apprehended, its parts mutually determining one another — and they find the act of **linearizing** that configuration into prose excruciating and unproductive. They have ADHD and verbal intelligence at or above the 99th percentile. They can *talk* fluent paragraphs about the configuration; they cannot get it onto the page. They are stuck, and they have been stuck for a while.

The tool's founding claim, which every feature must serve: **this difficulty is structural, not a deficiency.** The argument in the writer's head is a configuration (a web, a symmetry, a matrix of mutual requirements); the page is a line. Mapping one onto the other is a genuine, formally characterizable problem, and the felt wrongness of every attempted opening sentence is an accurate perception of that problem, not a symptom to be overcome by discipline. Arpeggio's job is to take the mapping problem out of the writer's working memory and give it a body: **the tool holds the whole so the writer can inhabit the line. The tool holds the whole; the writer holds the pen.**

The name is the thesis: an arpeggio is a chord spread in time that remains hearable *as the chord* — provided the spreading respects the harmony and the listener's retention is fed. That is what a good text is to a configurational argument, and feeding the reader's retention is what most of this tool's machinery is for.

---

## 2. Theoretical foundation

The design derives from Max Wertheimer's Gestalt theory, worked through from primary sources (*On Truth*, 1934; *The Syllogism and Productive Thinking*, 1920; *Productive Thinking*, 1945; *Investigations on Gestalt Principles*, 1923). You do not need the sources; you need the following operative results, each stated with its design consequence. Treat these as the product's axioms.

**2.1 The two wholes.** A text has two distinct part–whole structures. **W₁** is the *argument as configuration*: claims, grounds, distinctions, objections, examples, individuated by their place, role, and function in the case being made. Its shape may be a chain, a tree, a matrix, a star, a web, a symmetry — usually not a line. **W₂** is the *document as sequence*: an ordered, nested stream of heading-level blocks and paragraphs. These are different objects and must be represented as **distinct, co-edited layers**, with the mapping between them a first-class, inspectable object. Almost every diagnosis the tool makes is a predicate of the *mapping*, not of either layer alone.

**2.2 The asymmetry.** W₁ is the primary bearer of structure; W₂ exists for its sake. But W₂ is not mere packaging: it is **the complete set of grouping factors available to a writer**. A reader cannot receive prose as an unorganized sum — the stream *will* organize itself in their mind, spontaneously and lawfully. The writer's only real choice is *which* organization the arrangement induces. The transposed factors: **proximity** = adjacency in the text (neighbors get grouped whether or not they belong together); **similarity** = parallel construction (which groups related material *across distance* — the chief tool for repairing what linearization breaks); **good continuation** = directional momentum; **closure** = the opened-and-answered question; **Prägnanz** = readers snap slightly-deviant arguments to the nearest canonical schema unless the deviation is made structurally loud; and — critically — **set (Einstellung)**: *the linear order itself is a grouping factor.* What the reader has already read pre-organizes what they read next. Everything in §6's Draft mode follows from this last one.

**2.3 Composition is truth-apt.** Arrangement and emphasis alone — with every sentence individually true — can make a document assert a false whole (the lie made of truths) or no whole at all (everything present, nothing graspable). So the tool's diagnostics are not style advice; they are truth-maintenance on the whole.

**2.4 Validity is order-blind; grasping is order-bound.** Logical dependency does not fix presentation order (premises commute). What fixes order is the **dynamics of a reader's process**: a gap must be *felt* before it is filled (deliver the resolution before the question exists in the reader and it arrives inert — memorizable, ungrasped); a set must be established before the material it organizes; an old view must be inhabited before the recentering that overthrows it; a debt must be owed before it can be paid. These dynamics sometimes track logical dependency and sometimes deliberately invert it.

**2.5 The formal core.** Consequently, a substance-structure W₁ fixes not a sequence but a **partial order** of must-precede requirements over its parts (each requirement carrying a *reason* from 2.4). Composing is choosing a **linear extension** of that partial order. The fixed precedences are the **necessary parts** of the ordering — violate one and the reader's process fails. The incomparabilities are the **arbitrary components** — pairs whose order the substance genuinely does not care about, to be ordered by rhythm and weight or honestly declared arbitrary. Cyclic requirements (mutual-dependency webs) mean the admissible-extension set is *empty*: essentially non-linearizable substance, requiring principled strategies (spiral passes at rising resolution; declared IOUs; pointers beyond the medium such as diagrams).

**2.6 The two costs.** Any chosen extension is measured in two currencies. **Broken adjacency**: parts functionally close in W₁ made textually distant in W₂ — survivable only if the reader's retention is fed (parallel form, recurrence, explicit backlinks, a live owed-closure). **False adjacency**: parts textually adjacent with no functional edge — the graver cost, because the reader *cannot refrain* from grouping neighbors; a wrong relation is actively manufactured.

**2.7 Topologies and their strategies.** Chain: natively temporal, cost ≈ 0, copy it. Tree: sibling co-presence breaks and position fakes rank — signpost the coordination, re-bind siblings with parallel construction. Star: the hub must be effectively everywhere — approximate by **recurrence with changed function** (the same content restated at each spoke, each restatement doing a *different* job; recurrence without function-change is monotony). Matrix: one axis must be amputated — spine the center-carrying axis, cover the other with strict parallelism and tables. Web/cycle: no admissible extension — spiral, IOU, pointer. Symmetric or simultaneous insight: any telling re-serializes what the insight de-serialized — so **linearize the genesis instead of the structure**: stage the old view, the shift, the new view (where the structure will not serialize, its genesis will). Aggregate: the honest heap — *declare* the arbitrariness (alphabetical order as truthful form); dressing a heap as an organism is the document-scale lie.

**2.8 Two standpoints.** A finished text is a validity-artifact: parts co-present, order settled, evaluated as a whole. A draft is a productivity-event: the structure itself still in flux, trouble felt before it is analyzed. These standpoints must not invade each other — the internal editor must be kept off the generator's premises. The tool therefore has distinct **modes**, and the finished-text stance (audit) is quarantined from the generative stances (canvas, sequence, draft).

**2.9 Recentering and the homotypy audit.** The most productive event in thinking and drafting is **recentering**: the realization that the center of the argument is elsewhere than assumed (section four "wants" to be the introduction). In an ordinary word processor this is a catastrophe; here it is a first-class operation. Its lawful consequences are computable: precedence constraints die and are born; the current order may become inadmissible; and — the subtle one — **blocks that survive verbatim have usually changed function**, and wording calibrated to the old function now quietly misleads (the homotypy test: after restructuring, "one cannot correctly even write the same letters"). The tool turns the catastrophe into a bounded checklist: *the jolt, itemized.*

**2.10 Enacted beats declared.** A reader can be *told* that scattered sections belong together; they cannot *keep* that grouping against the field's actual forces. So auditing must test the organization the text *enacts*, not the one the author intends — which is why the reader-simulation (§6.4) reads sequentially and blind, reporting the organization it actually forms.

**Translation table** (theory → feature), for orientation as you build:

| Theoretical result | Feature |
|---|---|
| Two wholes + mapping as first-class (2.1) | W₁ canvas, W₂ spine, realization threads |
| Order is a grouping factor / Einstellung (2.2) | "Reader holds" strip; available-material check in Draft mode |
| Partial order / linear extension (2.5) | Precedence engine; drag-reorder with live admissibility; commutable-run brackets |
| Two costs (2.6) | False-adjacency and uncovered-broken-adjacency diagnostics |
| Gap before filling (2.4) | Premature-resolution diagnostic |
| Owed closure / debt before payment (2.4, 2.5) | The IOU Ledger |
| Empty vs. required bridge (2.4) | Bridge classification and upgrade tasks |
| Recurrence with changed function (2.7) | Function tags on realizations; monotony check |
| Aggregate honesty (2.7) | "Declared heap" state; declare-or-defer everywhere |
| Genesis linearization (2.7) | Per-region exposition strategy: genetic vs. systematic |
| Prägnanz snapping (2.2) | Marked-deviation loudness check |
| Two standpoints (2.8) | Mode separation; scaffold vs. committed prose |
| Recentering + homotypy (2.9) | Recentering operation; verbatim-survivor audit; snapshots |
| Enacted beats declared (2.10) | Sequential reader-simulation in Audit mode |

---

## 3. The user, concretely

Design every interaction against this profile. Where the spec is silent, decide in this user's favor.

**ADHD implies:** working memory is the scarce resource — the tool must be an *external* working memory for the argument, so that nothing about the whole ever needs to be held in the head while a sentence is being made. Task initiation is the second bottleneck — the tool must always be able to answer "what is the one next thing?" with a small, closable move. Reward must be visible and immediate — completion events, a shrinking ledger, maturity states advancing; never abstract progress. Thought-capture is sacred — an idea that arrives at the wrong moment must be parkable in under thirty seconds with zero navigation, or it is lost and the loss is demoralizing. Latency is lethal — an interaction that takes 400ms invites a task-switch; budget <100ms for all common operations. Shame spirals cause abandonment — the tool never nags, never blocks, never expresses disappointment; it maintains a truthful ledger and waits.

**99th-percentile verbal intelligence implies:** do not simplify the vocabulary — use the theory's own precise terms (*recentering, Einstellung, linear extension, arbitrary component, declared heap, homotypy*); for this user precision is motivating and euphemism is condescension. Information density is fine; *task ambiguity* is not. Every automated judgment will be argued with, so every diagnostic must show its reasoning and be overridable by an explicit, recorded **declaration** — the tool concedes gracefully and remembers the concession.

**The combination implies:** this person can produce fluent spoken paragraphs about the configuration while being unable to write them, because speech is temporally forced and outruns the internal editor. So the capture surfaces must welcome torrential, unpolished input (freewrite, dictation transcripts, pasted voice memos) as *material attached to W₁ nodes* — never as committed draft text. The distinction between **material** (quarry), **scaffold** (machine-drafted, provisional by construction), and **committed prose** (writer-authored) is load-bearing and visually enforced.

---

## 4. Design principles

These ten arbitrate everything. When a framework convention conflicts with one of these, the principle wins.

1. **Externalize the whole; contract the local.** W₁ and the mapping live in the tool. The writing act is scoped to one block and its explicit, small contract.
2. **Every diagnostic is a predicate of the mapping — never of the person, and not even of the prose as achievement.** Phrasing reports structural facts and options: "edge A→B spans §2.1→§4.3 with no covering device," never "this section is disorganized."
3. **Nothing blocks. Everything is fixable, declarable, or deferrable.** Declare = an honest, recorded authorial choice (the aggregate move generalized). Defer = the item goes to the ledger and the tool stops mentioning it. The ledger stays truthful; the writer stays unblocked.
4. **Progress is measured in the theory's currency**: debts paid, edges covered, bridges upgraded, constraints satisfied, blocks matured, diagnostics cleared. Never words counted. Word count measures the heap; we measure the whole.
5. **The modes keep the standpoints apart.** Generation and editing never share a surface. Scaffold is visually unmistakable. The audit stance cannot leak into the drafting surface.
6. **Recentering is welcome.** It is the productive event, so it must be cheap, supported, itemized, and reversible (snapshot before, checklist after).
7. **Capture is instantaneous and unconditional.** One keystroke to a new node from anywhere; an inbox for material that arrives out of context.
8. **Spatial memory is sacred.** The writer's placement of nodes on the canvas *is* external memory. Auto-layout never moves a node without explicit preview-and-accept consent.
9. **Keyboard-first, calm, fast.** Full command palette; every mouse action has a key path; <100ms interaction budget; motion only where it means something.
10. **The writer holds the pen.** Machine assistance drafts scaffold and classifies structure; it never silently commits prose, never edits W₁ without confirmation, and adoption of any machine text is a deliberate, logged act.

---

## 5. Data model

Local-first, plain-text-durable (see §11). All entities carry `id`, `createdAt`, `modifiedAt`.

**Node** (a part of W₁): `handle` (short unique name — the term of art, e.g. `constitutive-luck`); `body` (markdown; the quarry: notes, fragments, quotes, dictation dumps); `keyTerms[]` (strings used by the available-material check; default: the handle's words, user-extendable); `kind` (optional enum: claim | ground | distinction | definition | example | objection | reply | method | datum); `status`: **germ** → **apprehended** → **articulated**; `position` {x, y} on canvas; `isCenter` (boolean; usually exactly one node true, multiple permitted); `canonicalNeighbor` (optional free text: the familiar schema this node's claim deviates from, powering diagnostic D8).

**Edge** (a functional relation in W₁), typed, sparse (seven kinds, no more):
- `grounds` (directed: a supports b)
- `requires` (undirected: mutual determination — the strong Gestalt relation; the web-maker)
- `qualifies` (directed)
- `opposes` (undirected: tension — the deliberately violating juxtaposition; legitimate as a gap-tearing device)
- `exemplifies` (directed: example → principle)
- `defines` (directed: definition → user of the term)
- `answers` (directed: reply → objection)

**PrecedenceConstraint** (over nodes): `before` (nodeId), `after` (nodeId), `reason` (enum: gap-before-filling | set-before-material | overthrow-before-recentering | debt-before-payment | ground-before-lean | definition-before-use | custom), `source`: derived | authored, `derivedFrom` (rule id + edge id, when derived), `status`: active | suspended | converted-to-iou.

**Derivation rules** (defaults; transparent — every derived constraint displays its rule; all suspendable per-constraint):
- `defines(a,b)` → a before b (*definition-before-use*), unless converted to a declared IOU.
- `answers(r,o)` → o before r (*gap-before-filling* — the objection is the gap).
- `grounds(a,b)` under region strategy **systematic** → a before b (*ground-before-lean*); under strategy **genetic**, instead generate: the designated problem/old-view node before the resolution node (*overthrow-before-recentering*), grounds free.
- `requires(a,b)` alone generates no precedence, but if other rules give both a-before-b and b-before-a, the cycle is detected and the containing region is flagged **non-linearizable** with a strategy prompt (spiral | IOU | pointer-beyond-medium; see §6.2).
- `opposes(a,b)` generates no precedence; it marks the pair as a candidate *deliberate-tension adjacency* (exempts them from D1).

**Region**: a user-defined set of nodes with an `expositionStrategy`: systematic | genetic | spiral | reference (declared heap). Strategies parameterize derivation and diagnostics.

**Block** (a part of W₂): `level` (1–3), `title`, `orderIndex` (within parent), `parentId`, `prose` (markdown), `maturity`: **empty** → **gesture** (telegraphic placeholder, e.g. "[the objection from constitutive luck; answered via node distinction-14]") → **drafted** → **hardened**; `declaredHeap` (boolean, on a parent: children order declared arbitrary); `scaffoldRanges[]` (character ranges of machine-drafted text not yet adopted).

**Realization** (the mapping): `nodeId`, `blockId`, `functionTag` (enum: open-gap | introduce | develop | recur | answer | pay | summarize), `note`. A node may have many realizations (recurrence); a block may realize many nodes. Nodes with zero realizations = content debt; blocks realizing zero nodes = orphan prose (D10).

**LedgerEntry**: `kind`: iou | declared-heap | declared-deviation | deferred-diagnostic; `openedAtBlockId`; `owes` (text and/or nodeId); `paidAtBlockId?`; `status`: open | paid | waived; `createdBy`: user | system; `reason` (which constraint/diagnostic it converts, if any).

**Snapshot**: full project state, auto-created before every recentering and on demand. **RecenteringEvent**: log entry {oldCenterIds, newCenterIds, checklistId, snapshotId}.

---

## 6. The four modes

Modes are the standpoint machinery (2.8). Switch with keys 1–4. A collapsible **Ledger drawer** (key L) and the **command palette** (Cmd/Ctrl-K) are available everywhere.

### 6.1 Canvas mode — W₁ (productivity standpoint)

A zoomable, pannable spatial graph. `N` creates a node at the cursor: type the handle, Enter, done (<5 seconds, no dialog). `E` from a selected node starts an edge; a single letter picks the kind (g/r/q/o/x/d/a). Node cards show handle + a **status ring** (germ = ⅓ arc, apprehended = ⅔, articulated = full). The center node(s) carry a quiet warm glow used nowhere else in the app. Edge kinds are distinguished by line treatment (solid arrow = grounds; double line = requires; dashed = qualifies; zigzag or barbed red = opposes; dotted = exemplifies; open-dot origin = defines; hooked arrow = answers) with an always-available legend.

A **capture inbox** (tray, bottom-left; global hotkey even from other modes) accepts raw text/paste in one keystroke; inbox items are later dragged onto nodes (appending to `body`) or promoted to nodes. Opening a node reveals its body as a full quarry editor — this is where dictation dumps and freewrites land. A **list view** toggle renders the entire canvas as an indented, screen-reader-accessible outline with full parity (every canvas fact must be inspectable as text).

Auto-layout exists only as *Suggest layout* → ghost preview → accept/reject (principle 8).

### 6.2 Sequence mode — the mapping (productivity standpoint)

Three regions: **Canvas** (left, ~55%, read-mostly here), the **Corridor** (center gutter, ~15%), the **Spine** (right, ~30%): W₂ blocks as horizontal slats in document order, nested by level, each slat filled according to maturity (empty = outline only; gesture = hatched; drafted = light fill; hardened = full ink).

**Realization threads** run through the corridor from node to slat (create by drag node→slat; a small picker sets the functionTag). Selecting a thread highlights both ends and shows the tag. Selecting a node lights all its threads; a node whose two `requires`/`grounds` partners realize far apart shows the **long-thread amber marker** unless a covering device is recorded (a recurrence realization, a parallel-form note, a backlink, or a live IOU) — then a small bridge glyph replaces the warning.

**Reordering**: drag slats freely. On drag, the engine live-checks the implied node order (via realizations) against active precedence constraints: a violated constraint renders a red tick between the offending slats with its reason on hover ("gap-before-filling, from node `constitutive-luck`"). Dropping into a violating position is *allowed* (principle 3) — the violation becomes a listed diagnostic with fix/declare/defer options, and "declare" offers the natural conversion (e.g., violated gap-before-filling → a **declared IOU**: the resolution is asserted early, *marked as unearned*, and the ledger carries the debt).

Runs of mutually incomparable slats are spanned by a subtle gray **commutable bracket** labeled "order arbitrary here" — showing the writer where order is *free* is itself a relief, and the bracket's context menu offers "declare heap" (alphabetize or leave, honestly).

Non-linearizable regions (cycle detected) get a violet chip on their slats; clicking opens the **strategy prompt**: *Spiral* (scaffolds a two-pass block structure: each node gets a provisional early realization tagged `introduce` and a later one tagged `develop`), *Declared IOU* (pick which cycle edge moves into the ledger), *Pointer beyond the medium* (creates a figure/table placeholder block and records that the escape is deliberate).

A **Next moves** panel (also summonable anywhere with `.`): three candidate moves as cards — {title, why (citing the exact constraint/diagnostic/ledger item), size estimate (~5 / ~15 / ~40 min), completion condition, jump-to button}. Ranking: unblocking power (how many constraints/diagnostics a move retires) > debt age > smallest-maturity-step preference, filtered by the session **energy setting** chosen at launch (*foggy* → capture, sorting, tagging, declaring; *generative* → gesture-drafting, bridge candidates; *precise* → hardening, bridge upgrades, homotypy rewrites). Energy-matching is possible precisely because the model distinguishes task *kinds*.

### 6.3 Draft mode — one block (productivity standpoint)

The heart of the tool, and the direct implementation of Einstellung (2.2): **when drafting, the writer sees not the whole but the reader's situation.**

Layout: a single prose column, ~68ch measure, serif, generous leading — a serious writing surface, a study rather than a dashboard. Flanking it, two quiet margin strips:

- **Left — READER HOLDS**: the handles of all nodes realized in earlier blocks (recency-ordered), plus the reader's live IOUs ("owed: why constitutive luck doesn't collapse the distinction — opened §2.4"). This is the established set: what the incoming sentence lands on.
- **Right — THIS BLOCK'S CONTRACT**: which node(s) this block realizes and under which functionTag; which precedence constraints it discharges; which functional edges it must make *felt* (e.g., "make `grounds: moral-luck-cases → asymmetry-thesis` felt"); which IOUs it pays; and **NOT YET AVAILABLE**: nodes the reader does not hold.

The point: "write the dissertation" is impossible; "make this block pay these two debts to a reader who holds these three things" is an afternoon's work. The contract is small on purpose.

**Available-material check** (live, soft): if the draft text contains keyTerms belonging to a not-yet-available node, a gentle inline underline appears with: "`homotypy` belongs to node not yet given to the reader — realize it earlier, declare an IOU, or dismiss." Never a modal, never blocking.

**Gesture drafting**: `G` inserts a telegraphic placeholder that satisfies the block for ordering/testing purposes and sets maturity = gesture. Gestures are progress and are counted as such.

**Freewrite toggle**: disables delete/backspace and hides all margin chrome for a timed burst; output lands as *material* appended to the realized node's body (not as committed prose) unless explicitly kept in place. This is the talk-it-out channel.

**Focus behavior**: all chrome fades to ~15% opacity while typing; returns on pause or hover. Drafted-but-not-hardened text carries a barely-visible provisionality watermark (a whisper of hatching in the margin, not over the words) — the mode itself carries the permission for the text to be bad. Hardening is a separate, deliberate pass (`Cmd-Enter` advances maturity).

### 6.4 Audit mode — the finished-text standpoint (quarantined)

A read-through surface plus a diagnostics rail, grouped by kind, each finding deep-linking to its site with fix / declare / defer actions. Includes the **session log** ("Today: 2 debts paid · 1 bridge upgraded empty→required · §3.2 gesture→drafted") and ledger summary.

**Reader simulation** (LLM module, §10): feeds the document to the model block-by-block, sequentially and *blind to W₁*. After each block the model returns structured JSON: `{perceivedCenter, currentGrouping, liveExpectations[], surprises[], termsAssumedUndefined[]}`. The engine diffs this trajectory against W₁ + mapping + ledger: perceived center vs. the actual center's realizations (an accidental Umzentrierung caught in the act); the model's live expectations vs. the ledger's official debts (unregistered debts the text creates; registered debts the text fails to make felt); termsAssumedUndefined vs. the available-material record. Output: a mismatch report keyed to blocks. This operationalizes 2.10: it tests the *enacted* organization, and it is the tool's single most valuable audit.

### The diagnostics catalog (engine = pure functions, unit-tested)

Severities: **violation** (red), **owed** (amber), **info** (blue). Every finding shows its reasoning and offers fix / declare / defer.

- **D1 — False adjacency** (violation): adjacent slats whose realized node-sets share no functional edge, and not covered by a `opposes` deliberate-tension exemption or a declared heap.
- **D2 — Uncovered broken adjacency** (owed): a `grounds`/`requires` edge whose endpoint realizations are ≥ N blocks apart with no covering device recorded.
- **D3 — Premature resolution** (violation): a node realized before an active gap-before-filling / definition-before-use / overthrow-before-recentering constraint on it is satisfied, and not converted to a declared IOU.
- **D4 — Bridge quality** (owed / info): each inter-section boundary is classified **empty** (certifies adjacency only: "having discussed X, we turn to Y"), **required** (the end of X *is* Y's question), or **violating-deliberate** (a marked tension). Heuristics locally (transition-phrase lexicon + shared-edge check); LLM refinement optionally. Empty bridges across a real functional edge become upgrade tasks.
- **D5 — Heap dressing** (violation) / **undeclared heap** (info): sibling blocks with no functional edges among their nodes but narrative connectives in the prose (overdressed); or a commutable run not yet declared (informational nudge toward honesty).
- **D6 — Unpaid IOUs** (owed): scoped per chapter-end and document-end.
- **D7 — Verbatim survivor** (owed): after a recentering or a block move, a block whose realized node's role in W₁ changed (center-distance or edge-role delta) while its prose hash did not — "wording calibrated to the old function."
- **D8 — Unmarked deviation** (info): a node with a `canonicalNeighbor` whose realizing prose does not loudly mark the difference (LLM-assisted; pure-local fallback: presence of the user's own deviation keyTerms).
- **D9 — Hub monotony / spoke drift** (owed): a node with ≥3 `recur` realizations whose functionTags do not advance; or a spoke block far (graph-distance) from the hub it should serve.
- **D10 — Content debt / orphan prose** (info): nodes with zero realizations; blocks with zero realizations (resolution: link, create node from prose, or mark rhetorical).

### Recentering (the operation)

Trigger: toggling `isCenter`, or a "Recenter on…" command. Procedure: (1) snapshot; (2) recompute derived constraints — diff of born/died; (3) admissibility scan of the current order under the new constraint set; (4) homotypy scan → D7 candidates; (5) bridge re-audit at every boundary adjacent to affected blocks; (6) ledger updates (IOUs whose reason died are flagged for waiver). Present as **"The jolt, itemized"** — a finite checklist with per-item estimates and jump-to links, satisfiable across sessions. The one orchestrated motion moment in the app accompanies it: the canvas visibly re-settles around the new center (≤600ms, honoring `prefers-reduced-motion`), then the checklist slides in. Revert = restore snapshot.

---

## 7. Visual and interaction design brief

You are the design lead as well as the engineer. Follow this brief exactly where it pins constraints; where it leaves an axis free, make a deliberate choice grounded in the subject's world and record it in DECISIONS.md. Do a token-system pass (palette as named hex values, type roles, layout concept, one signature element) *before* building, and self-critique it against the constraints below.

**The subject's world**: the manuscript and the engraved musical score. The app's own thesis is that a text is a *score for the grasping* — so the visual identity may draw honestly on engraving: the spine's slats as measures filling with ink; realization threads through the corridor drawn like ties and slurs; hairline precision; ink on paper.

**Hard constraints:**
- **Color is semantic or absent.** Base surfaces are a near-monochrome paper/graphite pair (full light and dark themes). The only chromatic pigments in the entire app are the four proofreader's marks — **amber** = owed, **red** = violation/false, **green** = paid/covered, **blue** = declared/informational — plus one warm **center-glow** hue reserved exclusively for W₁ center nodes. If something is colored, it means something.
- Do **not** default to the current AI-generated looks (cream background + high-contrast serif + terracotta accent; near-black + single acid accent; faux-broadsheet with hairline columns everywhere). Derive the palette from paper, graphite, ink, and the five semantic pigments above; choose specific hex values yourself and name them.
- **Type roles**: a serious book serif with true italics for all prose surfaces (e.g., Literata or Source Serif 4 — your call, justify it); a quiet humanist sans for UI chrome (e.g., IBM Plex Sans or Inter); a mono or small-caps treatment for node handles and ids. Prose: ≥18px, ~68ch measure, ~1.6 leading. Draft mode must *feel like writing in a study*; dashboard-ness is quarantined to Audit mode.
- **Motion budget**: 150–300ms standard easing; meaningful motion only (ledger strike-through on payment; maturity fill advancing; the recentering re-settle as the single orchestrated moment). Respect `prefers-reduced-motion` throughout.
- **Signature element** (spend the boldness here, keep everything else quiet): the **Corridor** — the space between configuration and sequence, with its engraved threads, gap-markers, and bridge glyphs. It is the product's thesis made visible; make it beautiful and legible at a glance.
- Quality floor without announcement: visible keyboard focus everywhere; full keyboard operability; the canvas has list-view parity for screen readers; density toggle (comfortable/compact); dark mode is first-class.

**Keyboard map (minimum)**: `1–4` modes · `N` new node · `E` edge (then kind letter) · `C` toggle center on selection · `G` gesture-fill · `D` declare (context-sensitive) · `F` defer · `L` ledger · `.` next moves · `[` `]` previous/next block · `Cmd-Enter` advance maturity · `Cmd-K` palette · global capture hotkey (configurable, default `Cmd-Shift-Space`).

**Voice and microcopy**: the interface speaks in the theory's precise register. It reports states and options; it never exhorts, never praises effort, never apologizes, never uses emoji. Templates to follow:
- "Edge `grounds: moral-luck-cases → asymmetry-thesis` spans §2.1 → §4.3 with no covering device. Add a recurrence, a parallel-form note, a backlink — or declare an IOU."
- "§3.3 before §3.2 would violate *gap-before-filling* (from node `constitutive-luck`). Proceed and declare, or keep the order."
- "These four sections are commutable — their order is an arbitrary component. Order freely, or declare the heap."
- "Verbatim survivor: §2.2 kept its wording; its function changed from *develop* to *recur* after recentering."
- Completion events, dry and exact: "IOU #7 paid in §5.1."
- Empty states teach the model: an empty canvas says "This is W₁ — the argument as configuration. Press N to seize a thought."

---

## 8. Progress, sessions, and the ledger

Session start (fast, skippable): pick an energy level (foggy / generative / precise) → Next-moves panel offers three sized cards. Session end (or on demand): the session log in the theory's currency (principle 4). The Ledger drawer lists all open entries as literal ledger rows — kind, opened-at, owes, age — with payment producing the strike-through event and the session tally increment. No streaks, no points, no badges: the ledger's native mechanics *are* the reward system, and they are honest.

---

## 9. Persistence, formats, export

Local-first; the project is a plain directory, git-friendly, human-readable, durable for a decade:

```
project/
  argument.yaml      # nodes, edges, regions, constraints (with derivation provenance)
  mapping.yaml       # realizations
  ledger.yaml
  document/
    order.yaml       # block tree + orderIndexes + maturity + declaredHeap flags
    blocks/*.md      # one file per block; YAML frontmatter: id, title, level, scaffoldRanges
  snapshots/         # timestamped full copies (auto pre-recentering)
  DECISIONS.md       # your implementation decision log
```

Autosave continuously. **Export**: `compiled.md` (the W₂ tree flattened, scaffold stripped or marked per user choice) and a pandoc-ready path to LaTeX (Phase 5+). Nothing the writer makes is ever locked in the app.

---

## 10. LLM assist module (optional, pluggable, degradable)

Integrates the Anthropic API (key via local config/env; no key → all assist affordances hide; the core app must be fully functional without them). Roles:

1. **Bridge candidates**: given the two nodes at a boundary and their functional edge, propose 2–3 *required-bridge* transition drafts (each showing how the end of X opens Y's question). Delivered as scaffold.
2. **Gesture expansion**: expand a gesture block into scaffold prose, drawing *only* on the realized nodes' body material and the reader-holds set (the prompt must include the contract and forbid leaning on unavailable nodes).
3. **Bridge classification** (D4 refinement) and **deviation-loudness reading** (D8).
4. **Homotypy assist**: for D7 candidates, describe the function shift and mark the specific sentences calibrated to the old function.
5. **Reader simulation** (§6.4): sequential, blind, structured-JSON returns; run per-chapter with caching; surface token cost before running.

**Guardrails (absolute)**: all machine text is **scaffold** — rendered on a hatched background, excluded from maturity progress, stripped-by-default on export — until the writer *adopts* it with a deliberate keystroke, which is logged. Assists never modify W₁ or the mapping without explicit confirmation. The reader simulation is read-only. The writer holds the pen (principle 10) — this is a dissertation; authorship integrity and voice are non-negotiable, and the theory itself demands it: selection, grouping, and centering are the writer's operators.

---

## 11. Architecture and stack

- **Shell**: Tauri 2 (preferred — real filesystem, small footprint, native menus/hotkeys). If Tauri is unavailable in the build environment, fall back to a web app using the File System Access API; record the decision.
- **UI**: React + TypeScript + Vite. State: zustand (or equivalent minimal store). No heavyweight component library; hand-rolled components per the design brief.
- **Canvas**: custom SVG rendering (nodes, edges, threads). No physics-simulation layout at rest (principle 8); optional d3-force behind Suggest-layout preview only.
- **Diagnostics engine, precedence engine, recentering diff**: pure TypeScript modules, no UI imports, fully unit-tested. These are the product's brain; they must be testable in isolation.
- **Editor**: a solid markdown-capable prose editor (e.g., CodeMirror 6 or ProseMirror) configured to the Draft-mode spec (inline soft flags, freewrite lockout, scaffold ranges).
- Performance budgets: cold start < 2s; node create < 100ms; reorder admissibility check < 50ms for 300 blocks / 500 constraints.

---

## 12. Build phases and acceptance scenarios

Build in phases; each ends runnable. Seed a **fixture project** in Phase 0 so every feature is demonstrable: a ~12-node miniature of a philosophy argument — include one center, one `requires` pair (to exercise the cycle path), one `answers` pair, one `defines` chain, a three-node commutable cluster (heap), one node with a `canonicalNeighbor`, a 7-block spine with mixed maturities, two IOUs (one paid), and one deliberately empty bridge.

**Phase 0 — Model.** Data model, YAML persistence, snapshots, fixture. *Accept*: round-trip the fixture through disk losslessly; unit tests green.

**Phase 1 — Canvas + Spine + Threads.** Canvas mode complete (capture inbox, list-view parity); Spine with maturity rendering; realization threads; manual precedence authoring; live admissibility on drag; commutable brackets. *Accept — the capture scenario*: from anywhere, global hotkey → type a thought → Enter; it exists as an inbox item in <30 seconds with zero navigation. *Accept — the reorder scenario*: drag §4 before §2; two red ticks appear with readable reasons; one adjacent pair shows a commutable bracket; dropping anyway files a diagnostic instead of blocking.

**Phase 2 — Draft mode.** Contract strips (reader-holds, block contract, not-yet-available), available-material soft flags, gesture drafting, freewrite toggle, maturity advancement, scaffold rendering. *Accept — the contract scenario*: open an empty block; the contract shows "reader holds A, B; pays IOU #3"; typing a keyTerm of an unavailable node produces the soft flag with declare/dismiss; declaring files the IOU and the flag resolves.

**Phase 3 — Diagnostics + Ledger + Next moves.** Full D1–D10 local engine; ledger drawer with payment events; declare/defer flows everywhere; next-move generator with energy settings; session log. *Accept — the unsticking scenario*: open the fixture, press `.`, choose the ~15-minute card ("upgrade the §3.2→§3.3 bridge: currently empty; the edge is `answers`"), complete it, watch the ledger tick and the session log record it.

**Phase 4 — Recentering.** The operation, the snapshot, the re-settle animation, the itemized checklist, D7 integration, revert. *Accept — the jolt scenario*: toggle center to a different node; snapshot auto-created; checklist appears ("The jolt, itemized: 7 items"); one item is a verbatim-survivor flag on an unmoved block; revert restores exactly.

**Phase 5 — LLM module + Audit.** All five assist roles with guardrails; reader simulation with mismatch report; export pipeline. *Accept — the audit scenario*: run the simulation on the fixture; it reports a perceived center diverging from the mapped center for the first three blocks; the mismatch deep-links to the block whose emphasis caused it.

---

## 13. Anti-features (build none of these)

No word counts or word-count targets anywhere. No streaks, points, badges, or confetti. No grammar or style checking. No citation manager in v1 (node bodies hold quotes and references as plain text; do not preclude later integration). No cloud, accounts, sync, or collaboration. No mobile. No notifications or reminders — the tool never initiates contact. No AI ghostwriting mode: assistance is scaffold under §10 guardrails, full stop. No auto-layout that moves the writer's nodes without preview-and-accept.

---

## 14. How to work

Read this document twice. Then: build phase by phase, keeping each milestone runnable; keep the engines pure and tested; maintain `DECISIONS.md` for every choice this spec leaves open (record the option set and the principle that decided it); when this spec conflicts with a framework convention or a library default, the spec wins; when the spec is silent, §4's principles arbitrate, and among them, when principles conflict, the earlier-numbered wins. If you find a place where the theory in §2 implies a feature this spec failed to derive, note it in DECISIONS.md and — if it is small — build it.

The success criterion, stated once and plainly: a writer who has apprehended a configuration and dreaded the line should be able to open Arpeggio on a foggy afternoon, be handed one small honest move, make it, watch the ledger tell the truth about what just improved — and find, some months of afternoons later, that the dissertation exists.
