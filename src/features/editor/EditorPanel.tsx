import React, { useEffect, useState, useRef } from "react";
import { Clock, History } from "lucide-react";
import { Section } from "../../types";
import { useStore } from "../../store";
import { isTauri } from "../../services/tauri-environment";
import { useCurrentSection } from "../tests-panel/use-current-section";
import { Pip } from "../shared/Pip";
import CodeMirror, { ReactCodeMirrorRef, ViewUpdate } from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { openSearchPanel } from '@codemirror/search';
import { magnitudeBand } from '../../lib/magnitude';
import { writingSurfaceExtensions, resetEditorHistory } from './extensions';
import { useProvenanceSync } from './useProvenanceSync';
import { setProvenanceMarks } from '../../lib/provenanceMarks';
import { focusModeExtension, focusRangeField, setFocusRange } from '../../lib/focusRange';
import { pulseAt } from '../../lib/editorPulse';
import { sectionRangeInDoc } from '../../lib/section-edit';
import { findSectionById } from '../../lib/utils';
import { ResumeMarker } from '../coach/ResumeMarker';
import { ActiveMoveMarker } from '../coach/ActiveMoveMarker';
import { EditorEmptyState } from './EditorEmptyState';

interface EditorPanelProps {
  handleSave: () => void;
  onImportMarkdown: (content: string) => void;
  onLoadProject: (content: string) => void;
}

// Module-level so the extension instances (history(), fields) are STABLE across
// renders — a fresh array each render would make the uiw wrapper reconfigure
// the editor and drop the undo history's state field every keystroke.
const editorExtensions = writingSurfaceExtensions([focusModeExtension]);

export const EditorPanel: React.FC<EditorPanelProps> = ({
  handleSave,
  onImportMarkdown,
  onLoadProject,
}) => {
  // Domain + UI state from store
  const testSuite = useStore(s => s.testSuite);
  const localContent = useStore(s => s.localContent);
  const setLocalContent = useStore(s => s.setLocalContent);
  const lastAutoSave = useStore(s => s.lastAutoSave);
  const focusMode = useStore(s => s.focusMode);
  const setFocusMode = useStore(s => s.setFocusMode);
  const sections = useStore(s => s.sections);
  const onSectionChange = useStore(s => s.setSelectedId);
  const projectName = useStore(s => s.projectName);
  const setShowHistoryModal = useStore(s => s.setShowHistoryModal);
  const openRevisionWorkspace = useStore(s => s.openRevisionWorkspace);
  const setSectionCaret = useStore(s => s.setSectionCaret);

  // Project lifecycle, for the no-project empty state (desktop only). On the
  // desktop demo/preview there is no on-disk handle, so nothing the user types
  // is saved and no version history accrues — steer them to create/open a real
  // project rather than into the in-memory editor.
  const hasOpenProject = useStore(s => s.hasOpenProject);
  const needsProject = isTauri() && !hasOpenProject;

  const toggleFocusMode = () => setFocusMode(!focusMode);
  const onOpenHistory = () => setShowHistoryModal(true);

  const currentSection = useCurrentSection();

  // The one quiet caption line (EDIT 2): the section's first outgoing commitment
  // — "what the next section expects" — the single structural fact worth a glance
  // while writing. Self-gates to nothing when there is no commitment yet.
  const currentEntry = currentSection ? testSuite[currentSection.id] : undefined;
  const nextExpects = currentEntry?.spec?.outgoingCommitments?.[0]?.trim() || '';

  // Live caret per section (no re-render); committed to the store on departure so
  // the resume marker + caret-restore only ever name a place you can return to.
  const caretRef = useRef<Record<string, { anchor: number; head: number }>>({});

  const skipNextScroll = useRef(false);
  const lastReportedLine = useRef<number | null>(null);

  const isEmptyState = localContent.trim() === '';

  // Ambient save status: tick once a second so "saved · 12s" stays relative.
  const [nowTs, setNowTs] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const savedAgoSec = lastAutoSave
    ? Math.max(0, Math.floor((nowTs - new Date(lastAutoSave).getTime()) / 1000))
    : null;
  const savedAgoLabel =
    savedAgoSec == null ? null
      : savedAgoSec < 60 ? `${savedAgoSec}s`
      : savedAgoSec < 3600 ? `${Math.floor(savedAgoSec / 60)}m`
      : `${Math.floor(savedAgoSec / 3600)}h`;

  const cmRef = useRef<ReactCodeMirrorRef>(null);

  // Push durable provenance marks (F2) into the editor; the provenanceField
  // re-resolves anchors against the live doc, so the tint tracks edits and
  // falls off a span the writer has overwritten. The returned callback seeds
  // the marks at view creation (wired in handleCreateEditor below).
  const seedProvenance = useProvenanceSync(cmRef);

  // A project load/switch replaces the buffer via the controlled-value
  // reconcile, which would otherwise land in undo history — letting Cmd+Z
  // rewind PAST the load into an empty document. Reset history at that hard
  // boundary; everything within a project session stays undoable.
  const activeProjectId = useStore(s => s.activeProjectId);
  const historyBoundary = useRef(activeProjectId);
  useEffect(() => {
    if (activeProjectId === historyBoundary.current) return;
    historyBoundary.current = activeProjectId;
    const view = cmRef.current?.view;
    if (view) {
      // Let the value reconcile land first, then wipe.
      requestAnimationFrame(() => {
        const v = cmRef.current?.view;
        if (v) resetEditorHistory(v);
      });
    }
  }, [activeProjectId]);

  // STABLE identity (useCallback, live state via getState): the uiw wrapper
  // fully RECONFIGURES the editor whenever onChange/onUpdate change identity —
  // with inline handlers plus the 1-second save ticker that meant a root
  // reconfigure every second, silently dropping appended config (the search
  // panel vanished within a second of opening).
  const handleMainChange = React.useCallback((val: string) => {
    setLocalContent(val);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectionMap = React.useCallback((viewUpdate: ViewUpdate) => {
    // Only process if selection changed
    if (!viewUpdate.selectionSet) return;

    const st = useStore.getState();
    const pos = viewUpdate.state.selection.main.head;

    // Report the caret's line so App's rename-recovery (selection retention by
    // line when a heading's derived id changes) has a live line to fall back
    // to. Throttled to actual line changes; nothing subscribes reactively.
    const line = viewUpdate.state.doc.lineAt(pos).number - 1;
    if (line !== lastReportedLine.current) {
      lastReportedLine.current = line;
      st.setActiveLineIndex(line);
    }

    // Find what section the cursor is in based on character offset
    let match: Section | null = null;
    const findMatch = (nodes: Section[]) => {
      for (const node of nodes) {
        if (pos >= node.startOffset) {
           match = node;
           findMatch(node.children);
        }
      }
    };
    findMatch(st.sections);

    // While focused, a caret inside the focus window must not re-scope the
    // selection to a child subsection (the window covers the whole section,
    // children included). A caret OUTSIDE the window (a search-panel jump into
    // the hidden surround) re-selects normally, and the focus window follows.
    const focusRange = viewUpdate.state.field(focusRangeField, false);
    const inFocusWindow = !!focusRange && pos >= focusRange.from && pos <= focusRange.to;

    // Remember the live caret for the section it now sits in (cheap ref
    // write; the store commit happens on departure — see the section effect).
    // SECTION-RELATIVE, so edits elsewhere in the document can't strand the
    // resume point at a stale absolute offset. Inside the focus window the
    // resume id is the FOCUSED section (selection never re-scopes to a child
    // there), so record under it — the id the departure commit and
    // handleResume will read — not under the deepest child match.
    if (match) {
      let m = match as Section;
      if (inFocusWindow && st.selectedId && st.selectedId !== 'root') {
        const focused = findSectionById(st.sections, st.selectedId);
        if (focused) m = focused;
      }
      const sel = viewUpdate.state.selection.main;
      caretRef.current[m.id] = {
        anchor: Math.max(0, sel.anchor - m.startOffset),
        head: Math.max(0, sel.head - m.startOffset),
      };
    }

    if (inFocusWindow) return;

    if (match && match.id !== st.selectedId) {
      // Mark that this change came from the editor, so we don't jump scroll
      skipNextScroll.current = true;
      st.setSelectedId(match.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore the caret a section was last left at (resume-marker click, and the
  // default on re-entry). Falls back to the section start when none is remembered.
  const restoreCaret = (anchor: number, head: number) => {
    const view = cmRef.current?.view;
    if (!view) return;
    view.focus();
    try {
      view.dispatch({
        selection: { anchor, head },
        effects: [EditorView.scrollIntoView(head, { y: 'center' })],
      });
    } catch (e) {
      console.warn('Could not restore caret', e);
    }
  };

  // The section's LIVE character span, computed fresh from the editor buffer
  // (never the debounced `sections` offsets — that staleness corrupted the old
  // sliced editor). Threads the store's sections so id continuity survives
  // line shifts (ids embed the heading's original line index; parseMarkdown
  // reuses by title). Null for root / unresolvable ids.
  const liveSectionRange = (view: EditorView) => {
    if (!currentSection || currentSection.id === 'root') return null;
    return sectionRangeInDoc(
      view.state.doc.toString(),
      currentSection.id,
      useStore.getState().sections,
    );
  };

  // The focus window: dispatched into the focusRangeField, which maps itself
  // through subsequent edits. The document itself is never touched by entering,
  // leaving, or re-scoping focus — undo history and decorations persist.
  const syncFocusRange = (view: EditorView) => {
    const range = liveSectionRange(view);
    view.dispatch({
      effects: setFocusRange.of(
        focusMode && range ? { from: range.from, to: range.to } : null,
      ),
    });
    return range;
  };

  // Stable onCreateEditor (identity matters — see handleMainChange note): the
  // view mounts after first render, so sync the focus window immediately (a
  // focus-default launch must not flash the whole document) and seed the
  // provenance marks, whose change-driven sync may already have fired viewless.
  const syncFocusRangeRef = useRef(syncFocusRange);
  syncFocusRangeRef.current = syncFocusRange;
  const handleCreateEditor = React.useCallback((view: EditorView) => {
    syncFocusRangeRef.current(view);
    seedProvenance(view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resume: land the caret at the section's remembered (section-relative)
  // resume point — or its start when unvisited — against the section's LIVE
  // span. Serves the margin ResumeMarker and the Dock's Continue button.
  const handleResume = () => {
    const view = cmRef.current?.view;
    if (!view || !currentSection) return;
    const range =
      currentSection.id === 'root'
        ? { from: 0, to: view.state.doc.length }
        : liveSectionRange(view);
    if (!range) return;
    const rel = useStore.getState().sectionCaret[currentSection.id];
    const clamp = (n: number) => Math.max(range.from, Math.min(n, range.to));
    restoreCaret(clamp(range.from + (rel?.anchor ?? 0)), clamp(range.from + (rel?.head ?? 0)));
  };

  // Outside-in focus requests (Dock Continue): respond even when the selected
  // section didn't change — exactly the re-entry case the old wiring missed.
  const editorFocusSeq = useStore(s => s.editorFocusSeq);
  const focusSeqRef = useRef(editorFocusSeq);
  useEffect(() => {
    if (editorFocusSeq === focusSeqRef.current) return;
    focusSeqRef.current = editorFocusSeq;
    handleResume();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorFocusSeq]);

  // Outside-in search requests (⌘K → "Find in text"): open the in-editor
  // find/replace panel, the discoverable door to ⌘F.
  const editorSearchSeq = useStore(s => s.editorSearchSeq);
  const searchSeqRef = useRef(editorSearchSeq);
  useEffect(() => {
    if (editorSearchSeq === searchSeqRef.current) return;
    searchSeqRef.current = editorSearchSeq;
    const view = cmRef.current?.view;
    if (view) {
      view.focus();
      openSearchPanel(view);
    }
  }, [editorSearchSeq]);

  const prevSectionId = useRef(currentSection?.id);

  // Handle section changes (e.g., clicking a tree tile) and focus toggles. On
  // leaving a section, commit its last caret so a return restores it (the
  // resume point); on entry, restore the remembered caret if any, else the
  // section start — clamped into the focus window when one is active.
  useEffect(() => {
    const view = cmRef.current?.view;
    const departing = prevSectionId.current;
    const changed = !!currentSection && currentSection.id !== departing;
    if (changed && departing && caretRef.current[departing]) {
      setSectionCaret(departing, caretRef.current[departing]);
    }

    const range = view ? syncFocusRange(view) : null;

    if (changed) {
      const sec = currentSection!;
      prevSectionId.current = sec.id;
      if (view && !skipNextScroll.current) {
        // Restore the resume point (section-relative) against the section's
        // LIVE span, or its start if unvisited.
        const remembered = useStore.getState().sectionCaret[sec.id];
        const base = range?.from ?? sec.startOffset;
        const lo = range?.from ?? 0;
        const hi = range?.to ?? view.state.doc.length;
        const clamp = (n: number) => Math.max(lo, Math.min(n, hi));
        const anchor = clamp(remembered ? base + remembered.anchor : base);
        const head = clamp(remembered ? base + remembered.head : base);
        view.focus();
        try {
          // Dispatch selection and scroll effect together for atomicity
          view.dispatch({
            selection: { anchor, head },
            effects: [EditorView.scrollIntoView(head, { y: 'start', yMargin: 100 })],
          });
          pulseAt(view, head);
        } catch (e) {
          console.warn("Could not scroll to section", e);
        }
      }
    }

    // Reset the skip flag
    skipNextScroll.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSection?.id, focusMode, setSectionCaret]);

  // "Here is what just changed": when a revision/parallel accept recorded a
  // splice offset and no workspace overlay is covering the editor anymore,
  // scroll to it and pulse the landing line — the moment-of-consequence cue —
  // then clear the request. The offset was recorded against the buffer at
  // accept time; clamp defensively (an intervening edit only costs precision).
  const pendingReveal = useStore(s => s.pendingEditorReveal);
  const revisionWorkspaceOpen = useStore(s => s.revisionWorkspaceOpen);
  const parallelOpen = useStore(s => s.parallelOpen);
  useEffect(() => {
    if (!pendingReveal || revisionWorkspaceOpen || parallelOpen) return;
    const view = cmRef.current?.view;
    if (!view) return;
    const pos = Math.max(0, Math.min(pendingReveal.offset, view.state.doc.length));
    try {
      view.dispatch({
        selection: { anchor: pos, head: pos },
        effects: [EditorView.scrollIntoView(pos, { y: 'center' })],
      });
      view.focus();
      pulseAt(view, pos);
    } catch {
      /* out-of-range mid-edit; the tint remains the fallback wayfinding */
    }
    useStore.getState().setPendingEditorReveal(null);
  }, [pendingReveal, revisionWorkspaceOpen, parallelOpen]);

  // Drift correction for the focus window. The field maps itself exactly
  // through ordinary edits, but two events de-sync it from the true section
  // boundary: an external full-document replace (an accepted AI edit while
  // focused — mapping balloons the range), and a structural edit inside the
  // window (typing a new same-level heading splits the section). Each time the
  // debounced parse lands, re-derive the range from the LIVE buffer and
  // correct: re-hide to the true boundary when the caret stays inside it, or
  // follow the caret into its new section when it doesn't.
  useEffect(() => {
    const view = cmRef.current?.view;
    if (!view || !focusMode || !currentSection || currentSection.id === 'root') return;
    const cur = view.state.field(focusRangeField, false) ?? null;
    const fresh = sectionRangeInDoc(view.state.doc.toString(), currentSection.id, sections);
    if (!fresh) return; // heading renamed mid-flight — selection retention re-aims first
    if (cur && cur.from === fresh.from && cur.to === fresh.to) return;
    const head = view.state.selection.main.head;
    if (head >= fresh.from && head <= fresh.to) {
      view.dispatch({ effects: setFocusRange.of({ from: fresh.from, to: fresh.to }) });
    } else {
      let target: Section | null = null;
      const walk = (nodes: Section[]) => {
        for (const n of nodes) {
          if (head >= n.startOffset) {
            target = n;
            walk(n.children);
          }
        }
      };
      walk(sections);
      if (target && (target as Section).id !== currentSection.id) {
        skipNextScroll.current = true;
        onSectionChange((target as Section).id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, focusMode, currentSection?.id]);

  return (
    <div className="editor-panel-step flex-1 flex flex-col h-full bg-hld-bg relative transition-colors duration-200 min-w-0">
      {/* Toolbar */}
      <div className="h-14 border-b border-hld-border bg-hld-surface flex items-center justify-between px-4 z-20 relative shrink-0 min-w-0">
         <div className="absolute top-0 left-0 right-0 h-[1px] bg-hld-text/40" />

         <div className="flex items-center gap-[5px] text-ui-meta tracking-[0.1em] uppercase text-hld-muted-text font-mono flex-1 min-w-0 pr-4">
           {currentSection ? (
             <>
               <span className="truncate">{projectName || 'Project'}</span>
               <span className="text-hld-muted-text" aria-hidden="true">›</span>
               <span className="text-hld-text font-bold truncate">
                 {currentSection.title}
               </span>
             </>
           ) : (
             <span className="text-hld-text font-bold truncate">
               {isEmptyState ? "Untitled Document" : "Untitled Section"}
             </span>
           )}
         </div>

         <div className="flex items-center gap-[6px] shrink-0">
           {/* Approximate section magnitude (VISION principle 8 — orientation,
               not false precision); the exact count waits on hover. */}
           {currentSection && currentSection.wordCount > 0 && (
              <span
                className="mr-1 text-ui-meta font-mono uppercase tracking-[0.12em] text-hld-muted-text"
                title={`${currentSection.wordCount} words`}
              >
                {magnitudeBand(currentSection.wordCount).label}
              </span>
           )}
           {/* Ambient save status — answers "is my work safe?" passively (autosave). */}
           {savedAgoLabel && (
              <div className="flex items-center gap-1.5 mr-1 text-ui-meta font-mono uppercase tracking-[0.12em] text-hld-muted-text" title="Autosaved continuously">
                <Pip status="green" size="sm" />
                saved · {savedAgoLabel}
              </div>
           )}
           {currentSection && testSuite[currentSection.id]?.status === 'stale' && (
              <span className="bg-hld-yellow/10 text-hld-yellow border border-hld-yellow/20 text-ui-meta uppercase font-bold px-[7px] py-[3px] tracking-[0.1em] font-mono flex items-center gap-1">
                ⬥ Stale
              </span>
           )}
           {currentSection && testSuite[currentSection.id]?.status === 'success' && (
              <span className="bg-hld-green/10 text-hld-green border border-hld-green/20 text-ui-meta uppercase font-bold px-[7px] py-[3px] tracking-[0.1em] font-mono flex items-center gap-1">
                ✓ Solid
              </span>
           )}
           {currentSection && testSuite[currentSection.id]?.status === 'fail' && (
              <span className="bg-hld-magenta/10 text-hld-magenta border border-hld-magenta/20 text-ui-meta uppercase font-bold px-[7px] py-[3px] tracking-[0.1em] font-mono flex items-center gap-1">
                ✕ Failing
              </span>
           )}

           {!needsProject && (
             <button
               onClick={openRevisionWorkspace}
               className="p-[5px_10px] bg-transparent border border-hld-border text-hld-muted-text hover:text-hld-cyan hover:border-hld-cyan/40 text-ui-btn font-mono uppercase tracking-[0.1em] flex items-center gap-[5px] transition-all"
               title="Revise — Glass Box revision workspace"
             >
               <span className="text-[12px] leading-none">⟐</span> Revise
             </button>
           )}

           {/* Focus Mode Toggle */}
           <button
             onClick={toggleFocusMode}
             className={`p-[4px_9px] bg-transparent border text-ui-btn font-mono uppercase tracking-[0.1em] flex items-center gap-[5px] transition-all ${
                focusMode
                  ? 'border-[rgba(0,232,245,0.12)] text-hld-cyan bg-[rgba(0,232,245,0.12)] shadow-[0_0_8px_rgba(0,232,245,0.12)]'
                  : 'border-hld-border text-hld-muted-text'
             }`}
             title="Toggle Focus Mode"
           >
             <div className={`w-[5px] h-[5px] ${focusMode ? 'bg-hld-cyan' : 'bg-hld-muted'}`} />
             Focus
           </button>

           {/* History + Snapshot persist to / read from an on-disk project. On the
               desktop preview (no open project) they have nothing to act on, so
               hide them rather than show an empty modal / no-op snapshot. */}
           {!needsProject && (
             <button
               onClick={onOpenHistory}
               className="p-[5px_10px] bg-transparent border border-hld-border text-hld-muted-text hover:text-hld-text hover:border-hld-border-strong text-ui-btn font-mono uppercase tracking-[0.1em] flex items-center gap-[5px] transition-all"
               title="Version History"
             >
               <History size={11} /> History
             </button>
           )}

           {!needsProject && (
             <button
               onClick={handleSave}
               className="p-[5px_12px] bg-transparent border border-[rgba(0,232,245,0.3)] text-hld-cyan hover:bg-[rgba(0,232,245,0.12)] hover:shadow-[0_0_10px_rgba(0,232,245,0.25)] text-ui-btn font-mono uppercase tracking-[0.12em] flex items-center gap-[5px] transition-all bracketed"
               style={{"--br-color": "var(--tw-colors-hld-cyan)"} as any}
               title="Commit a labeled snapshot to History"
             >
               <Clock size={11} /> Snapshot
             </button>
           )}
         </div>
      </div>

      {/* One quiet caption line (Quiet target, EDIT 2) — chrome above the
          manuscript, centered to the prose measure. The structural surround now
          lives in the Spec panel; only "what the next section expects" stays
          here, the single structural fact worth a glance while writing.
          Self-gates to nothing when there is no outgoing commitment yet. */}
      {!isEmptyState && !needsProject && nextExpects && (
        <div className="shrink-0 w-full max-w-[800px] mx-auto px-[64px] pt-[10px] pb-[6px]">
          <div className="flex items-baseline gap-[11px] min-w-0">
            <span className="font-mono text-[8.5px] tracking-[0.14em] uppercase text-hld-muted-text whitespace-nowrap shrink-0">Next expects →</span>
            <span className="text-[13px] leading-[1.5] italic text-hld-muted-text-2 min-w-0 truncate" title={nextExpects}>{nextExpects}</span>
          </div>
        </div>
      )}

      {/* Editor Area */}
      <div className="flex-1 overflow-hidden bg-transparent relative h-full">
        {/* Re-entry resume marker (Quiet target, EDIT 3) — a slim cyan bar in the
            left margin that replaces the floating "you were here" nudge. Reveals
            on hover and auto-escalates on a mid-section stall; click resumes. */}
        {!needsProject && !isEmptyState && !focusMode && <ResumeMarker onResume={handleResume} />}
        {/* Point-of-action move cue (F5): names the move the structure now owes,
            in the left margin, co-located with the prose. */}
        {!needsProject && !isEmptyState && !focusMode && <ActiveMoveMarker />}
        <div className="h-full relative">

          {/* No focus-mode banner: the lit Focus toggle + the toolbar breadcrumb
              (which already names the section) carry the mode — a header strip
              above the prose was one more line of chrome than the page needs. */}
          {(isEmptyState || needsProject) && (
            <EditorEmptyState
              needsProject={needsProject}
              onImportMarkdown={onImportMarkdown}
              onLoadProject={onLoadProject}
              onStartBlank={() => {
                // Seed a single heading so a treemap node + currentSection
                // appear immediately, then focus the (now-mounted) editor
                // on the next frame and drop the cursor at the end.
                setLocalContent('# ');
                requestAnimationFrame(() => {
                  const view = cmRef.current?.view;
                  if (view) {
                    view.focus();
                    const end = view.state.doc.length;
                    view.dispatch({ selection: { anchor: end, head: end } });
                  }
                });
              }}
            />
          )}

          {/* The ONE editor — mounted whenever a project is open (real or
              browser), even when empty, so a blank document is immediately
              typeable. Focus mode does not swap it out: the focusRange
              extension hides the surround and confines edits, so the buffer,
              undo history, and decorations persist across toggles. Only the
              desktop preview (needsProject) withholds it. */}
          {!needsProject && (
            <div className="flex-1 h-full max-w-[800px] mx-auto overflow-hidden">
              <CodeMirror
                ref={cmRef}
                value={localContent}
                onChange={handleMainChange}
                onUpdate={handleSelectionMap}
                onCreateEditor={handleCreateEditor}
                editable={!needsProject}
                theme="none"
                height="100%"
                className="h-full"
                extensions={editorExtensions}
                basicSetup={false}
              />
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
