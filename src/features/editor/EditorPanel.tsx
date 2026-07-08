import React, { useEffect, useState, useRef, useLayoutEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Clock, FilePlus, FolderOpen, PenTool, History, GitBranch } from "lucide-react";
import { Section } from "../../types";
import { useStore } from "../../store";
import { isTauri } from "../../services/tauri-environment";
import { useCurrentSection } from "../tests-panel/use-current-section";
import { Pip } from "../shared/Pip";
import CodeMirror, { ReactCodeMirrorRef, ViewUpdate } from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { GFM, Table } from '@lezer/markdown';
import { hldExtensions, hldTheme } from '../../lib/editorTheme';
import { livePreviewPlugin } from '../../lib/livePreview';
import { provenanceField, setProvenanceMarks } from '../../lib/provenanceMarks';
import { ResumeMarker } from '../coach/ResumeMarker';
import { ActiveMoveMarker } from '../coach/ActiveMoveMarker';
import { EditorView, keymap, drawSelection, highlightSpecialChars, highlightActiveLine, dropCursor, rectangularSelection, crosshairCursor } from '@codemirror/view';
import { history, historyKeymap, defaultKeymap, indentWithTab } from '@codemirror/commands';
import { indentOnInput, bracketMatching, foldGutter, foldKeymap } from '@codemirror/language';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';

const manualBasicSetup = [
  highlightSpecialChars(),
  history(),
  drawSelection(),
  dropCursor(),
  EditorView.lineWrapping,
  indentOnInput(),
  bracketMatching(),
  closeBrackets(),
  autocompletion(),
  rectangularSelection(),
  crosshairCursor(),
  highlightSelectionMatches(),
  keymap.of([
    ...closeBracketsKeymap,
    ...defaultKeymap,
    ...searchKeymap,
    ...historyKeymap,
    ...foldKeymap,
    ...completionKeymap,
    indentWithTab
  ])
];

interface EditorPanelProps {
  handleSave: () => void;
  // The editor view ref is forwarded from App.tsx for cursor focus from outside.
  editorRef: any;
  onImportMarkdown: (content: string) => void;
  onLoadProject: (content: string) => void;
}

// Recursive helper to find the deepest section containing the line
const findSectionForLine = (nodes: Section[], line: number): Section | null => {
  for (const node of nodes) {
    if (line >= node.startLine && line <= node.endLine) {
       // Check children first for more specific match
       const childMatch = findSectionForLine(node.children, line);
       return childMatch || node;
    }
  }
  return null;
};

export const EditorPanel: React.FC<EditorPanelProps> = ({
  handleSave,
  editorRef,
  onImportMarkdown,
  onLoadProject,
}) => {
  // Domain + UI state from store
  const testSuite = useStore(s => s.testSuite);
  const localContent = useStore(s => s.localContent);
  const setLocalContent = useStore(s => s.setLocalContent);
  const lastAutoSave = useStore(s => s.lastAutoSave);
  const activeTab = useStore(s => s.activeTab);
  const setActiveTab = useStore(s => s.setActiveTab);
  const hiddenSectionIds = useStore(s => s.hiddenSectionIds);
  const toggleSectionVisibility = useStore(s => s.toggleSectionVisibility);
  const focusMode = useStore(s => s.focusMode);
  const setFocusMode = useStore(s => s.setFocusMode);
  const initialLineIndex = useStore(s => s.activeLineIndex);
  const onLineFocus = useStore(s => s.setActiveLineIndex);
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
  const createNewProject = useStore(s => s.createNewProject);
  const openExistingProject = useStore(s => s.openExistingProject);
  const setShowRemoteProjectModal = useStore(s => s.setShowRemoteProjectModal);
  const needsProject = isTauri() && !hasOpenProject;

  const toggleFocusMode = () => setFocusMode(!focusMode);
  const onOpenHistory = () => setShowHistoryModal(true);

  const currentSection = useCurrentSection();

  // The one quiet caption line (EDIT 2): the section's first outgoing commitment
  // — "what the next section expects" — the single structural fact worth a glance
  // while writing. Self-gates to nothing when there is no commitment yet.
  const currentEntry = currentSection ? testSuite[currentSection.id] : undefined;
  const nextExpects = currentEntry?.spec?.outgoingCommitments?.[0]?.trim() || '';

  const [titleInput, setTitleInput] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  // Live caret per section (no re-render); committed to the store on departure so
  // the resume marker + caret-restore only ever name a place you can return to.
  const caretRef = useRef<Record<string, { anchor: number; head: number }>>({});
  
  const mdInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef(localContent);
  const skipNextScroll = useRef(false);
  
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

  // Keep a ref of localContent to avoid stale closures during focus calculations
  useEffect(() => {
    contentRef.current = localContent;
  }, [localContent]);

  // --- Focus Mode State ---
  const [beforeText, setBeforeText] = useState("");
  const [focusText, setFocusText] = useState("");
  const [afterText, setAfterText] = useState("");

  // When focusMode toggles or currentSection changes, recalculate the slice
  useEffect(() => {
    if (focusMode && currentSection) {
      const lines = contentRef.current.split('\n');
      const before = lines.slice(0, currentSection.startLine).join('\n');
      const focus = lines.slice(currentSection.startLine, currentSection.endLine + 1).join('\n');
      const after = lines.slice(currentSection.endLine + 1).join('\n');
      
      setBeforeText(before ? before + '\n' : "");
      setFocusText(focus);
      setAfterText(after ? '\n' + after : "");
    } else {
      setFocusText("");
    }
  }, [focusMode, currentSection?.id]); // Re-run when section ID changes or we toggle focus

  // Sync title input
  useEffect(() => {
    setTitleInput(currentSection ? currentSection.title : (isEmptyState ? 'New Document' : 'Full Document'));
  }, [currentSection, isEmptyState]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setTitleInput(newVal);
    
    if (currentSection) {
       const lines = contentRef.current.split('\n');
       const hashes = '#'.repeat(currentSection.level);
       lines[currentSection.startLine] = `${hashes} ${newVal}`;
       setLocalContent(lines.join('\n'));
    }
  };

  const cmRef = useRef<ReactCodeMirrorRef>(null);
  const focusCmRef = useRef<ReactCodeMirrorRef>(null);

  // Push durable provenance marks (F2) into whichever editor is mounted; the
  // provenanceField re-resolves anchors against the live doc, so the tint tracks
  // edits and falls off a span the writer has overwritten.
  const provenanceMarks = useStore((s) => s.provenanceMarks);
  useEffect(() => {
    for (const ref of [cmRef, focusCmRef]) {
      const view = ref.current?.view;
      if (view) view.dispatch({ effects: setProvenanceMarks.of(provenanceMarks) });
    }
  }, [provenanceMarks, focusMode]);

  const handleMainChange = (val: string) => {
    setLocalContent(val);
  };

  const handleFocusChange = (val: string) => {
    setFocusText(val);
    setLocalContent(beforeText + val + afterText);
  };

  const handleSelectionMap = (viewUpdate: ViewUpdate) => {
    if (focusMode) return;
    
    // Only process if selection changed 
    if (!viewUpdate.selectionSet) return;

    const pos = viewUpdate.state.selection.main.head;
    
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
    findMatch(sections);

    // Remember the live caret for whatever section it now sits in (cheap ref
    // write; the store commit happens on departure — see the section effect).
    if (match) {
      const sel = viewUpdate.state.selection.main;
      caretRef.current[(match as Section).id] = { anchor: sel.anchor, head: sel.head };
    }

    if (match && match.id !== currentSection?.id) {
      // Mark that this change came from the editor, so we don't jump scroll
      skipNextScroll.current = true;
      onSectionChange(match.id);
    }
  };

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

  const handleResume = () => {
    if (!currentSection) return;
    const pos = useStore.getState().sectionCaret[currentSection.id];
    if (pos) restoreCaret(pos.anchor, pos.head);
  };

  const prevSectionId = useRef(currentSection?.id);

  // Handle section changes (e.g., clicking a tree tile). On leaving a section,
  // commit its last caret so a return restores it (the resume point); on entry,
  // restore the remembered caret if any, else fall back to the section start.
  useEffect(() => {
    const departing = prevSectionId.current;
    const changed = !!currentSection && currentSection.id !== departing;
    if (changed && departing && caretRef.current[departing]) {
      setSectionCaret(departing, caretRef.current[departing]);
    }

    if (changed) {
      const sec = currentSection!;
      prevSectionId.current = sec.id;
      if (!focusMode) {
        const view = cmRef.current?.view;
        if (view && !skipNextScroll.current) {
          // Restore the resume point for this section, or its start if unvisited.
          const remembered = useStore.getState().sectionCaret[sec.id];
          const anchor = remembered?.anchor ?? sec.startOffset;
          const head = remembered?.head ?? sec.startOffset;
          view.focus();
          try {
            // Dispatch selection and scroll effect together for atomicity
            view.dispatch({
              selection: { anchor, head },
              effects: [EditorView.scrollIntoView(head, { y: 'start', yMargin: 100 })],
            });
          } catch (e) {
            console.warn("Could not scroll to section", e);
          }
        }
      }
    }

    // Reset the skip flag
    skipNextScroll.current = false;
  }, [currentSection, focusMode, setSectionCaret]);

  
  const handleMdChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      if (typeof content === 'string') onImportMarkdown(content);
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleProjectChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      if (typeof content === 'string') onLoadProject(content);
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const isHidden = currentSection ? (hiddenSectionIds || []).includes(currentSection.id) : false;

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
                 {titleInput}
               </span>
             </>
           ) : (
             <span className="text-hld-text font-bold truncate">
               {isEmptyState ? "Untitled Document" : "Untitled Section"}
             </span>
           )}
         </div>

         <div className="flex items-center gap-[6px] shrink-0">
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
              <span className="bg-hld-yellow/10 text-hld-yellow border border-hld-yellow/20 text-ui-meta uppercase font-bold px-[7px] py-[3px] tracking-[0.1em] font-mono flex items-center gap-1">
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

          {focusMode && currentSection && (
            <div className="flex items-center gap-[8px] mb-[10px] pb-[8px] pt-[15px] px-[64px] border-b border-[rgba(0,232,245,0.2)] bg-hld-bg z-10 w-full max-w-[800px] mx-auto">
              <div className="w-[7px] h-[7px] bg-hld-cyan rotate-45 shadow-[0_0_8px_var(--tw-colors-hld-cyan)] shrink-0" />
              <span className="text-ui-label tracking-[0.14em] uppercase text-hld-cyan font-mono">{currentSection.title} — Focus Mode Active</span>
            </div>
          )}
          
          {(isEmptyState || needsProject) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 z-10 pointer-events-none opacity-100 animate-in fade-in duration-700">
               <div className="text-center pointer-events-auto bg-hld-surface/80 backdrop-blur-sm p-12 border border-[rgba(0,232,245,0.2)] shadow-[0_0_50px_rgba(0,0,0,0.5)] max-w-lg w-full">
                 {needsProject ? (
                   <>
                     <h2 className="text-[14px] uppercase tracking-[0.15em] font-bold text-hld-text mb-2 font-mono">Start a Project</h2>
                     <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-hld-muted-text mb-8 leading-[1.6]">{isEmptyState ? 'Your writing lives in a project folder — saved to disk, with version history. Create or open one to begin.' : 'This is a read-only preview — nothing here is saved. Your writing lives in a project folder on disk, with version history. Create or open one to begin.'}</p>
                     <div className="space-y-3">
                       <button onClick={() => { void createNewProject(); }} className="bracketed w-full flex items-center justify-center gap-3 px-6 py-4 bg-transparent border border-[rgba(0,232,245,0.2)] text-hld-cyan hover:bg-[rgba(0,232,245,0.05)] transition-all group hover:shadow-[0_0_16px_rgba(0,232,245,0.2)] hover:border-[rgba(0,232,245,0.4)]" style={{"--br-color": "var(--tw-colors-hld-cyan)"} as any}>
                         <FilePlus size={16} className="group-hover:scale-110 transition-transform"/>
                         <span className="font-bold font-mono uppercase tracking-[0.14em] text-ui-btn">New Project</span>
                       </button>
                       <button onClick={() => { void openExistingProject(); }} className="bracketed w-full flex items-center justify-center gap-3 px-6 py-4 bg-transparent border border-[rgba(0,232,245,0.2)] text-hld-cyan hover:bg-[rgba(0,232,245,0.05)] transition-all group hover:shadow-[0_0_16px_rgba(0,232,245,0.2)] hover:border-[rgba(0,232,245,0.4)]" style={{"--br-color": "var(--tw-colors-hld-cyan)"} as any}>
                         <FolderOpen size={16} className="group-hover:scale-110 transition-transform"/>
                         <span className="font-bold font-mono uppercase tracking-[0.14em] text-ui-btn">Open Project</span>
                       </button>
                       <div className="pt-4 text-center">
                          <button onClick={() => setShowRemoteProjectModal(true)} className="text-hld-muted-text hover:text-hld-text text-ui-btn font-mono uppercase tracking-[0.14em] flex items-center justify-center gap-2 mx-auto transition-colors">
                             <GitBranch size={12} /> Clone from a remote
                          </button>
                       </div>
                     </div>
                   </>
                 ) : (
                   <>
                     <h2 className="text-[14px] uppercase tracking-[0.15em] font-bold text-hld-text mb-2 font-mono">Ready to Write?</h2>
                     <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-hld-muted-text mb-8 leading-[1.6]">Import a markdown file to visualize its structure, or just start typing.</p>
                     <div className="space-y-3">
                       <button onClick={() => mdInputRef.current?.click()} className="bracketed w-full flex items-center justify-center gap-3 px-6 py-4 bg-transparent border border-[rgba(0,232,245,0.2)] text-hld-cyan hover:bg-[rgba(0,232,245,0.05)] transition-all group hover:shadow-[0_0_16px_rgba(0,232,245,0.2)] hover:border-[rgba(0,232,245,0.4)]" style={{"--br-color": "var(--tw-colors-hld-cyan)"} as any}>
                         <FilePlus size={16} className="group-hover:scale-110 transition-transform"/>
                         <span className="font-bold font-mono uppercase tracking-[0.14em] text-ui-btn">Import Markdown</span>
                       </button>
                       <div className="pt-4 text-center">
                          <button onClick={() => {
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
                          }} className="text-hld-muted-text hover:text-hld-text text-ui-btn font-mono uppercase tracking-[0.14em] flex items-center justify-center gap-2 mx-auto transition-colors">
                             <PenTool size={12} /> Start with a blank page
                          </button>
                       </div>
                     </div>
                   </>
                 )}
               </div>
               <input type="file" ref={mdInputRef} className="hidden" accept=".md,.markdown,.txt" onChange={handleMdChange} />
               <input type="file" ref={projectInputRef} className="hidden" accept=".json,.socratic" onChange={handleProjectChange} />
            </div>
          )}
 
          {/* Unified Editor Area — mounted whenever a project is open (real or
              browser), even when empty, so a blank document is immediately
              typeable. Only the desktop preview (needsProject) withholds it. */}
          {!needsProject && (
            <div className="flex-1 h-full max-w-[800px] mx-auto overflow-hidden">
              {focusMode && currentSection ? (
                <CodeMirror
                  ref={focusCmRef}
                  value={focusText}
                  onChange={handleFocusChange}
                  editable={!needsProject}
                  extensions={[
                    markdown({ 
                      base: markdownLanguage, 
                      codeLanguages: languages, 
                      addKeymap: false,
                      extensions: [Table, GFM]
                    }), 
                    ...hldExtensions, 
                    ...manualBasicSetup,
                    livePreviewPlugin,
                    provenanceField,
                  ]}
                  theme={hldTheme}
                  autoFocus
                  height="100%"
                  className="h-full"
                  basicSetup={false}
                />
              ) : (
                <CodeMirror
                  ref={cmRef}
                  value={localContent}
                  onChange={handleMainChange}
                  onUpdate={handleSelectionMap}
                  editable={!needsProject}
                  theme={hldTheme}
                  height="100%"
                  className="h-full"
                  extensions={[
                    markdown({ 
                      base: markdownLanguage, 
                      codeLanguages: languages, 
                      addKeymap: false,
                      extensions: [Table, GFM]
                    }), 
                    ...hldExtensions, 
                    ...manualBasicSetup,
                    livePreviewPlugin,
                    provenanceField,
                  ]}
                  basicSetup={false}
                />
              )}
            </div>
          )}
          
        </div>
      </div>
    </div>
  );
};