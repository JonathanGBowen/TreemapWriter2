Ready for review
Select text to add comments on the plan
Ideation: Generative Stance Preservation in TreeMap Writer 2.0
Context
This is a design ideation document — not an implementation plan. Its output is a brief for Claude Design to storyboard and prototype. Implementation will follow separately.

The problem is not writer's block in the ordinary sense. The research report identifies a specific neurocognitive failure mode: intention deactivation across session boundaries. When a writing session ends, the executive scaffolding that was holding the prose together — the generative stance, the affective-postural condition of the writer inside the work — is actively metabolized away by the brain. The prose doesn't become harder to access; it becomes alien. The words are still there; the stance from which they were generative is not.

The dominant clinical finding is unambiguous: the cue must arrive in the future moment, not be entrusted to the future self. External focal cues work. Self-initiated retrieval from memory fails. This is not a motivational or willpower problem.

TreeMap Writer 2.0 is already a sophisticated structured-writing tool with a Hyper Light Drifter (HLD) aesthetic. It has CodeMirror editing, AI diagnostics, section-spec scaffolding, version snapshots, and a multi-project system. The features below extend it into session-boundary territory — the transition out of and back into deep writing — which is the only territory not yet addressed.

The HLD design language is the right vehicle. HLD's core loop is: enter a hostile world, push as deep as you can, retreat, and then re-enter at a known anchor point. That is exactly the phenomenological structure of long-form academic writing with executive dysfunction.

Existing Foundation (What We're Building On)
Data models: Section, SectionSpec, TestSuiteEntry, Snapshot, Persona, ProjectMeta — all in src/types/index.ts

Key state: markdown, localContent, sections, testSuite, revisions, activeProjectId, selectedId — all in src/App.tsx

Storage: IndexedDB via idb-keyval — blobs, audio, and structured JSON all viable

AI: Gemini Flash / Pro via @google/genai in src/lib/ai-pipeline.tsx

Visual system: HLD color tokens in src/index.css — deep navy background, cyan/magenta/yellow/green accents, scan lines, glow effects

Editor: CodeMirror 6 in src/components/panels/EditorPanel.tsx — extensible with custom plugins and decorations

Feature Concepts
1. THE SESSION GATE ("Reentry Protocol")
The problem it solves: Intention deactivation. When the user re-opens the app after a gap, there is no cue that reinstates the generative stance. They open to an editor and a blank cognitive slate.

Clinical grounding: Manly et al. (2002) content-free auditory cueing; context-reinstatement (Tulving & Thomson encoding specificity); Leroy & Glomb (2018) Ready-to-Resume Plan; Wilson NeuroPage RCT (2001).

The concept: When a project is opened and the last save was >N hours ago (configurable, default 4h), instead of loading straight to the editor, the user passes through a full-screen Session Gate. This is not a modal — it is an atmospheric interstitial screen.

HLD analog: The game's opening — not a menu, not a tutorial prompt, but an atmospheric establishing sequence that immerses you in the world's texture before you act. Also the return-to-zone feeling after dying and respawning at a checkpoint.

Visual language: Deep navy full-bleed. The document's title rendered in large HLD-style glyphed typography with a slow scan-line animation. A spectral waveform visualization of the last voice transmission (see Feature 2) plays automatically. The waveform pulses in cyan. Below it, the "Hemingway Anchor" fragment (see Feature 3) floats in dim text, resolving to full opacity over 3 seconds. A single button: ENTER THE FIELD (in the HLD bracketed style). No other affordances. The user cannot skip it — they must actively choose to enter.

Tone: Not a loading screen. Not a checklist. The ritual is the point. "The field is waiting. This is where you were."

UX flow:

User opens app or switches to a suspended project
Session Gate fires if last-session gap > threshold
Last transmission audio plays automatically (ambient, not loud)
Anchor fragment fades in
User reads/listens, then clicks ENTER THE FIELD
Editor loads with cursor positioned at the Anchor point
Implementation hooks: Wrap project-load logic in App.tsx; use existing revisions timestamps to detect gaps; store transmission audio in IndexedDB alongside project.

2. THE TRANSMISSION SYSTEM ("Voice Handoff")
The problem it solves: The Ready-to-Resume Plan (Leroy & Glomb 2018) must be captured in the generative register — not a summary of what was written, but the next sentence, spoken in the voice of the prose. Current tools have no mechanism for this.

Clinical grounding: Leroy & Glomb (2018) Ready-to-Resume Plan; Hemingway "stop with the well still full" rule; voice-first composition bypasses the typographic bottleneck and keeps the intention live (UNC Writing Center ADHD guidance; Hux et al. 2018).

The concept: A Transmission is a short (30s–3min) voice memo recorded at the end of each writing session, captured in the generative register. It is stored with the project and plays automatically on reentry (via the Session Gate). The key constraint: the UI scaffolds the generative register by framing the recording prompt as "Continue the next sentence aloud…" not "Summarize what you wrote."

HLD analog: The scattered holographic lore transmissions in HLD — fragments from the civilization that came before, still broadcasting. The writer's past self is a civilization that left signals for the future self to find. Each transmission is a glyph: compressed, atmospheric, pointing forward.

Visual language: A circular waveform visualizer (oscilloscope-style, HLD cyan). Record button styled as a "broadcast" icon — pulsing ring when active. After recording, the waveform "crystallizes" into a saved state (color shift to cooler blue-white). In the Session Gate, the waveform "reactivates" — warm cyan, pulsing, as if the transmission is being received live. Transcription text appears beneath the waveform (secondary, not primary — the audio IS the artifact).

Register Guardian (sub-feature): After transcription, a lightweight Gemini Flash call checks whether the transmission is in generative or descriptive register. If descriptive (user summarized what they wrote instead of continuing the next thought), a gentle visual cue fires — not an interruption, just a color shift in the waveform to amber with a small glyph: "OBSERVING FROM OUTSIDE?" The user can re-record or proceed. No text explanation — the glyph is the signal.

UX flow:

User clicks "End Session" (a persistent button that replaces "Save" in the sidebar)
Transmission recorder opens — full-bleed overlay, minimal UI
Prompt displayed in the prose's voice: "The next thing this section needs to say is…"
User records
Waveform crystallizes, transcription renders, register check fires
If generative: confirmation glyph (small green pulse)
If descriptive: amber waveform, "OBSERVING?" glyph — option to re-record
Session ends; project card in project manager shows "transmission awaiting" state
New data shape: SessionTransmission { id, projectId, sectionId, audioBlob, transcription, register: 'generative'|'descriptive'|'unchecked', timestamp }

3. THE HEMINGWAY ANCHOR ("Last Known Coordinates")
The problem it solves: The session-end completion signal triggers intention deactivation (Goschke & Kuhl 1993; Marsh et al. 1998). If the prose ends with a complete thought, the brain treats it as done. Hemingway's rule: stop mid-sentence, mid-thought, so the session ends as suspended, not completed.

Clinical grounding: Intention deactivation / ISE deactivation literature; Marsh, Hicks & Bink (1998); Goschke & Kuhl (1993); Hemingway (Esquire 1935; A Moveable Feast).

The concept: At session end, the user "drops anchor" — a keyboard shortcut that marks the current cursor position as the Hemingway Anchor. This captures the incomplete sentence or trailing clause. The anchor is rendered in the editor with a distinctive visual treatment and is the first thing shown on reentry.

HLD analog: The bonfire / checkpoint mechanic in soulslike games — not "you died, start over" but "you suspended here, resume here." The checkpoint is a physical location in the world. The anchor IS the location.

Visual language: In the editor, the anchored position is decorated with a small HLD-style glyph in the gutter — a compass rose or crosshair in cyan with a subtle pulse. The incomplete sentence extends beyond the anchor with a trailing gradient fade-to-nothing. On reentry, the editor scrolls to the anchor and applies a brief warm-white flash animation ("arriving") before the cursor appears there. The anchor is persistent — it doesn't disappear until the user "breaks anchor" by continuing past it.

UX flow:

User is mid-sentence, mid-thought
Presses anchor shortcut (e.g. Shift+Cmd/Ctrl+A)
Editor glyph appears at cursor position
Trailing text fades
On next session reentry (via Session Gate), editor scrolls to anchor, brief arrival flash
User begins typing — anchor "dissolves" with a satisfying visual (pixel scatter? glyph fades to green)
New data shape: AnchorPoint { sectionId, offset, lineNumber, fragmentText, timestamp } stored in project.

4. THE STANCE CARD ("Field Notes")
The problem it solves: Context reinstatement requires reinstating the processing context, not just the content (Tulving & Thomson; Manning 2024). For prose, this means the affective-postural condition — the voice, the pressure, the direction of the section — not just what it contains.

Clinical grounding: Gorman et al. (2003) cognitive orthotics — "invariant form across sessions, content as the only variable"; Goldstein's "abstract attitude"; context-reinstatement literature.

The concept: Each section has a Stance Card — a small, always-visible card pinned to the top of the TestsPanel (or floating near the editor), with three fill-in-the-blank fields:

VOICE: "This section moves as…" (e.g., "a challenge being slowly unpacked," "a claim defending itself")
PRESSURE: "The central weight on this prose is…" (e.g., "Gestalt's unresolved question about figure/ground")
HEADING: "The direction of motion is toward…" (e.g., "the moment where direct insight becomes necessary")
These are written in the voice of the writing, not as descriptions of it. AI can draft them from existing section content, but the user refines them.

HLD analog: The scattered lore tablets in HLD — small glyphs that convey immense meaning in compressed, atmospheric form. The stance card should feel like an artifact discovered in the world, not a UI form to fill in. Visual treatment: aged, slightly textured, set apart from the diagnostic content by color temperature (warmer — amber/gold rather than clinical cyan).

Visual language: Card styled like a worn field notebook entry. Handwriting-adjacent font (or JetBrains Mono in a looser tracking). Amber/gold text on a surface-dark background. Thin amber border. Subtle texture overlay. The three fields are inline-editable but default to a read-only view that feels like reading a note, not a form. "AI DRAFT" button in the card corner (small, glyph only) to regenerate from current content.

UX flow:

First session: stance card is empty, prompts user in faint placeholder text
User types directly into the card (or clicks AI Draft)
Card is saved with the project, per-section
On reentry, stance card is the first element rendered in the side panel (above specs/diagnostics)
Session Gate shows a condensed version of the active section's stance card alongside the transmission waveform
5. THE FIELD INTERRUPT ("GMT Chime")
The problem it solves: Goal neglect under absorbing ongoing tasks (Manly et al. 2002) — the user gets so deep into the ongoing task that PM monitoring lapses. An external content-free auditory cue breaks the absorption and returns attention to the meta-level: "Am I inside the prose or observing it?"

Clinical grounding: Manly, Hawkins, Evans, Woldt & Robertson (2002) — random tones + "think about what you are doing" brought brain-injured patients to control levels on the Six Elements Test. Fish et al. (2007) "STOP!" text messages. Goal Management Training STOP step.

The concept: A configurable ambient chime fires every N minutes during a writing session (default 25 min, adjustable 10–60). When it fires, a minimal non-blocking toast-like overlay appears at the screen edge: a single glyph and two choices. NO TEXT. The glyph communicates the question; the two responses communicate the options. Selecting a response dismisses it.

HLD analog: The ambient environmental audio cues in HLD that shift subtly to signal that something has changed — you're being watched, a door has opened, the field has shifted. The interrupt should feel like the world noting your presence, not like a notification from an app.

Visual language: A small "pulse" emanates from a corner of the screen — not a notification badge, but a wave ripple in HLD magenta, subtle enough to be peripheral. If the user is in deep flow, they may not notice it for 30 seconds. It doesn't escalate. When noticed and hovered, it expands to show two glyph-buttons:

A figure inside a circle (IN THE FIELD / inhabiting the prose)
A figure above a rectangle (OBSERVING / describing from outside)
If IN THE FIELD is selected: brief green pulse, dismisses. If OBSERVING: amber pulse, a single additional glyph appears — a microphone icon (record a micro-transmission) or an anchor icon (drop anchor and refocus). These are the only two words in the interaction: the glyph labels could be "IN" and "OUT" at most. The HLD principle: convey affordances without words.

UX flow:

User writing for 25 min (configurable)
Magenta ripple appears at screen edge, peripheral
User notices, hovers — glyph choices expand
Selects IN THE FIELD → green flash → continues writing
Selects OBSERVING → amber flash → micro-transmission prompt OR anchor drop
Interaction complete in < 3 seconds
New state: Session timer, chime interval config, chime response log (for future pattern analysis)

6. THE INTENT FORGE ("Pre-Session Crystallization")
The concept: Implementation intentions (Gollwitzer 1999) in if-then form, forged at session end. "When I return to [section], I will [specific verb] [specific target]." These are stored with the project and displayed on reentry.

Clinical grounding: Gollwitzer & Sheeran (2006) meta-analysis d≈0.65 across 8,000+ participants; Lengfelder & Gollwitzer (2001) frontal injury effects; Brewer et al. (2010) clinical PM applications.

The concept: After recording the Transmission (Feature 2), and before closing, the "End Session" flow offers one more step: FORGE YOUR INTENT. A minimal form: section selector (defaults to current), verb selector (a set of verbs drawn from the SectionFunction taxonomy — "argue," "apply," "synthesize," "explicate"), and a short text field: "specifically…"

The result is stored as a full if-then sentence and displayed on the Session Gate: "When you return here, you will ARGUE [specific thing] in [section name]."

HLD analog: The crafting/forging mechanic in action RPGs — you go to a forge, combine materials, and create something with a defined purpose. The intent is a weapon forged for tomorrow's session. Visual treatment: anvil-glyph, hot-metal amber color, brief forge-animation on save.

Data shape: SessionIntention { sectionId, verb: SectionFunction, target: string, createdAt, status: 'pending'|'fulfilled' } — extends existing SectionFunction taxonomy.

7. THE SUSPENSION PROTOCOL ("Crystallizing the Field")
The problem it solves: Standard "save" framing presents session-end as completion. Intention deactivation fires on perceived completion (Goschke & Kuhl 1993). The session must be framed as suspended, not finished.

The concept: The "End Session" button doesn't just save — it suspends the project. Visual metaphor: a crystallization animation in which the document card in the project manager takes on a "frozen" visual treatment — crystalline texture overlay, blue-white color shift, a small "SUSPENDED" glyph. When re-opened, the suspension dissolves (reverse animation), and the Session Gate fires.

HLD analog: HLD's environmental storytelling uses crystallized/fossilized forms to convey suspended time. The Drifter enters zones where time has stopped. The suspended project IS the frozen zone.

UX flow for End Session:

User clicks END SESSION (sidebar button, replaces Save)
"Forge Intent" step (Feature 6) — optional but prompted
"Record Transmission" step (Feature 2) — prompted
"Drop Anchor" confirmation (Feature 3) — one-click
Crystallization animation fires on project card
App moves to project manager or closes
On reopen: dissolution animation → Session Gate → editor at anchor
8. THE FIELD MAP ("Session Cartography")
The concept: A session history visualization as a map of explored territory, not a version diff tree. The dissertation is a world being built. The map shows which sections have been recently inhabited (warm, bright), which are cold (dim, hazier), and which have never been entered (dark, unknown). Each section's "heat" decays based on recency of genuine edits (not just views).

HLD analog: HLD's world map is celebrated as one of the most evocative in games — it conveys scale, history, and mystery. Unexplored regions have a distinctive visual texture that rewards exploration. The dissertation world-map should feel like the HLD map: an artifact that shows you where you've been and gestures at what you haven't yet discovered.

Visual language: Extend the existing Treemap/React Flow visualization. Overlay a "heat layer" on the treemap — recently edited sections glow cyan, sections edited last week are dim blue, unvisited sections are nearly black with a textured "unmapped" pattern. The heat map is not just recency of autosave but recency of generative writing (detected by significant word-count change). Clicking on any section in the map shows a mini-card: last stance card, last anchor fragment, last transmission date.

Implementation hooks: Extends existing Treemap component (src/components/Treemap.tsx) and Plotly/React Flow visualizations in existing modals.

9. AMBIENT FIELD SOUND ("Zone Audio")
The concept: Each project (or section) has an assignable ambient soundscape — not music, not a writing playlist, but a persistent environmental texture. The same soundscape plays every session in the same project. The encoding-specificity principle (Tulving & Thomson) predicts that reinstating the perceptual context of encoding aids retrieval. The soundscape becomes part of the context being reinstated.

Clinical grounding: Encoding specificity (Tulving & Thomson); context reinstatement literature (Hupbach et al.); embodied stance maintenance through environmental cueing.

HLD analog: HLD's zone-specific audio design is extraordinary — each region has a distinct ambient texture that conveys its history and mood. The dissertation's zones should have the same quality of distinctiveness.

Visual language: In project settings, a small "FIELD AUDIO" selector — a set of abstract glyphs representing different textures (deep hum, white noise, crystalline resonance, low drone, open field, etc.). No labels beyond glyph icons. The playing soundscape is indicated by a subtle animated waveform in the sidebar. Volume control is minimal — a single vertical slider, no text.

Technical note: Web Audio API with procedurally generated or pre-recorded ambient textures — 5–6 distinct "zones." Loop-point seamless, no noticeable repetition.

Overall UX Architecture: The Session Loop
The features above compose into a session loop that mirrors the HLD gameplay loop:

CRYSTALLIZE (End Session)
  → Transmission recorded (voice handoff)
  → Intent forged (if-then plan)
  → Anchor dropped (mid-sentence)
  → Project crystallizes in project manager
  
  ↓ (time passes)

REENTER (Session Gate fires on reopen)
  → Field audio starts
  → Transmission plays
  → Stance card surfaces
  → Forged intent is displayed
  → Editor loads at anchor with arrival flash

  ↓ 

IN THE FIELD (writing session)
  → Field interrupts fire (GMT chime)
  → Field map shows heat
  → Anchor point persists until broken

  ↓

CRYSTALLIZE (session ends, loop repeats)
This is not a new workflow imposed on top of existing features. It is a frame that wraps existing save/restore/session behavior in a ritual that maintains the generative stance.

Design Principles for Storyboarding
Every interaction at session-boundary must be ritual, not utility. The Session Gate, Transmission recorder, and Intent Forge are not forms or dialogs — they are passages. The experience of passing through them is part of their function.

No completion signals at session end. No "Great work!" no progress bars completing, no confetti. The session ends as a suspension, not an achievement. The only "reward" is the crystallization animation — which signals pause, not completion.

Words are expensive; use glyphs. The Field Interrupt uses no text. The Transmission Register Guardian uses no text. The Session Gate has one button. The HLD principle: affordances conveyed without words.

Consistent form, variable content. The stance card, transmission, anchor, and intent all have identical form across sessions. The cognitive-orthotic principle (Gorman et al. 2003): consistency in design ensures consistent cueing. The ritual is the same every time; only its content changes.

The prose is a world, not a document. Every visual metaphor should reinforce this: sections are zones, sessions are expeditions, the writer is a field researcher / explorer. The HLD drifter enters hostile territory, pushes as far as they can, retreats, and re-enters at the last anchor point. This is the dissertation writer's phenomenology.

The generative stance is the target state, not a nice-to-have. Every design decision should ask: does this help the user enter the prose or observe it from outside? Features that make the prose feel like an object to be manipulated (diff views, completion percentages, achievement badges) are anti-patterns. Features that make the prose feel like a field to be entered are the goal.

What Not to Build (Anti-Patterns from the Literature)
Session summaries or "what you wrote today" digests — completion signal, triggers deactivation
Diff views surfaced by default on reopen — trains the user to relate to prose as object
Word-count goals / progress bars — completion-frame, wrong register
Graph/network view as primary drafting environment — fragments continuity
Multi-step "choose what to open" dialogs — strategy-application step at worst moment
Intrusive modals that interrupt writing — the Field Interrupt is peripheral, not blocking
Files Most Likely to Be Modified in Implementation
File	Why
src/types/index.ts	Add SessionTransmission, AnchorPoint, SessionIntention, StanceCard types
src/App.tsx	Session gate logic, suspension protocol, session loop orchestration
src/components/panels/EditorPanel.tsx	Anchor point rendering (CodeMirror decoration), arrival animation
src/components/panels/TestsPanel.tsx	Stance card display (above specs)
src/components/Sidebar.tsx	"End Session" button replacing Save, field audio controls
src/components/Treemap.tsx	Heat-map layer for Field Map
src/lib/ai-pipeline.tsx	Stance card AI draft, transmission register check
src/index.css	Crystallization animations, session gate styles, anchor glyph
New: src/components/SessionGate.tsx	Full-screen reentry interstitial
New: src/components/TransmissionRecorder.tsx	Voice memo UI with waveform
New: src/components/FieldInterrupt.tsx	GMT chime peripheral overlay
New: src/lib/audio.ts	Web Audio API ambient soundscapes, chime generation
Add Comment