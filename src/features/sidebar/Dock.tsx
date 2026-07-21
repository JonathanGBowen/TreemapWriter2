import { useEffect, useState, type CSSProperties } from "react";
import { useStore } from "../../store";
import type { Section } from "../../types";

function findTitleById(nodes: Section[], id: string): string | null {
  for (const node of nodes) {
    if (node.id === id) return node.title;
    const found = findTitleById(node.children, id);
    if (found) return found;
  }
  return null;
}

/**
 * The sidebar dock: the one lit re-entry action (CONTINUE), the sprint verb,
 * the monochrome tools strip (Assist opens the ⌘K command palette), and the
 * fixed caption line — the single place words appear (idle stats at rest, a
 * control's name on hover/focus).
 */
interface DockProps {
  onContinue: () => void;
  caption: string | null;
  setCaption: (c: string | null) => void;
}

const cyanBr = { '--br-color': 'var(--color-hld-cyan)' } as CSSProperties;

export function Dock({ onContinue, caption, setCaption }: DockProps) {
  const sections = useStore((s) => s.sections);
  const selectedId = useStore((s) => s.selectedId);
  const markdown = useStore((s) => s.markdown);

  const setShowSprintModal = useStore((s) => s.setShowSprintModal);
  const setShowCommandPalette = useStore((s) => s.setShowCommandPalette);
  const setShowSectionMapModal = useStore((s) => s.setShowSectionMapModal);
  const setShowGraphModal = useStore((s) => s.setShowGraphModal);
  const setShowPromptsGraphModal = useStore((s) => s.setShowPromptsGraphModal);
  const openCompare = useStore((s) => s.openCompare);
  const openSpecTest = useStore((s) => s.openSpecTest);
  const openClimate = useStore((s) => s.openClimate);
  const openDoctor = useStore((s) => s.openDoctor);
  const setShowSessionModal = useStore((s) => s.setShowSessionModal);
  const openDashboard = useStore((s) => s.openDashboard);
  const setShowCoachModal = useStore((s) => s.setShowCoachModal);
  const openInterpolate = useStore((s) => s.openInterpolate);
  const openSegment = useStore((s) => s.openSegment);
  const startSpecSweep = useStore((s) => s.startSpecSweep);
  const openRevisionWorkspace = useStore((s) => s.openRevisionWorkspace);
  const openParallel = useStore((s) => s.openParallel);
  const openGist = useStore((s) => s.openGist);
  const sessionActive = useStore((s) => s.activeSession !== null);

  // Hold ⌥ to reveal the tool labels (recognition over recall — the dock is
  // glyph-only at rest to keep the HLD density). Instant; reduced-motion-safe.
  const [altHeld, setAltHeld] = useState(false);
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Alt') setAltHeld(true); };
    const clear = () => setAltHeld(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', clear);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', clear);
      window.removeEventListener('blur', clear);
    };
  }, []);

  const continueLabel = (selectedId ? findTitleById(sections, selectedId) : null) ?? sections[0]?.title ?? 'Begin';
  const wordCount = markdown.trim() ? markdown.trim().split(/\s+/).length : 0;
  const idleStats = `${wordCount.toLocaleString()}W · ${sections.length} sections`;

  const cap = (label: string) => ({
    onMouseEnter: () => setCaption(label),
    onMouseLeave: () => setCaption(null),
    onFocus: () => setCaption(label),
    onBlur: () => setCaption(null),
  });

  // Two workflow groups (the grid wraps by sevens). Compose/revise first, then
  // evaluate/inspect. Every major modal/workspace is one glyph away — ⌘K
  // (Assist) stays the searchable door + the home of the rarer actions.
  const tools: { g: string; name: string; aria: string; onClick: () => void }[] = [
    // compose / revise
    { g: '◉', name: 'Assist — every action, searchable (⌘K)', aria: 'Assist', onClick: () => setShowCommandPalette(true) },
    { g: '◍', name: 'Coach — find the bottleneck', aria: 'Coach', onClick: () => setShowCoachModal(true) },
    { g: '⑂', name: 'Articulate — segment a text into its natural parts', aria: 'Articulate', onClick: () => openSegment() },
    { g: '✦', name: 'Generate specs — structural analysis, top-down', aria: 'Generate specs', onClick: () => startSpecSweep() },
    { g: '⟐', name: 'Revise — Glass Box revision workspace', aria: 'Revise', onClick: () => openRevisionWorkspace() },
    { g: '▥', name: 'Parallel — reverse-outline revision', aria: 'Parallel', onClick: () => openParallel(false) },
    { g: '◊', name: 'Gist — whole-at-once re-entry', aria: 'Gist', onClick: () => openGist() },
    { g: '▦', name: 'Goal map — section goal editor', aria: 'Goal map', onClick: () => setShowSectionMapModal(true) },
    // evaluate / inspect
    { g: '◈', name: 'Dependencies — section graph', aria: 'Dependencies', onClick: () => setShowGraphModal(true) },
    { g: '▣', name: 'Spec test — A/B against the rubric, whole + parts', aria: 'Spec test', onClick: () => openSpecTest() },
    { g: '≈', name: 'Compare — version A/B evaluation', aria: 'Compare', onClick: () => openCompare() },
    { g: '≋', name: 'Climate — atmospheric weather report', aria: 'Climate', onClick: () => openClimate() },
    { g: '≣', name: 'Outline Doctor — reverse-outline diagnosis, revision checklist', aria: 'Outline Doctor', onClick: () => openDoctor() },
    { g: '▤', name: 'Progress — accumulated evidence', aria: 'Progress', onClick: () => openDashboard() },
    { g: '❝', name: 'Prompts — AI routing', aria: 'Prompts', onClick: () => setShowPromptsGraphModal(true) },
  ];

  return (
    <div className="flex flex-col gap-[5px] px-2 pt-2 pb-1 border-t border-hld-border bg-hld-surface-3 shrink-0">
      <button
        type="button"
        onClick={onContinue}
        style={cyanBr}
        {...cap('Continue — return to your cursor')}
        className="bracketed hld-lit w-full px-[10px] py-[9px] flex items-center justify-center gap-2 font-mono text-[10px] tracking-[0.12em] uppercase"
      >
        <span className="text-[11px] leading-none">▸</span>
        <span className="truncate">{continueLabel}</span>
      </button>

      <div className="flex gap-[5px]">
        <button type="button" onClick={() => setShowSessionModal(true)}
          aria-label={sessionActive ? 'Check out of session' : 'Start a session'}
          {...cap(sessionActive ? 'Session — check out' : 'Session — check in')}
          className="flex-1 py-[6px] border border-hld-cyan/30 text-hld-cyan leading-none hover:bg-hld-cyan/10 transition-colors flex items-center justify-center gap-2">
          <span className="text-[12px]">{sessionActive ? '◉' : '◷'}</span>
          <span className="font-mono text-[9px] tracking-[0.14em] uppercase">Session</span>
        </button>
        <button type="button" onClick={() => setShowSprintModal(true)} aria-label="Sprint" {...cap('Sprint — goal or draft, timed')}
          className="flex-1 py-[6px] border border-hld-green/25 text-hld-green leading-none hover:bg-hld-green/10 transition-colors flex items-center justify-center gap-2">
          <span className="text-[12px]">»</span>
          <span className="font-mono text-[9px] tracking-[0.14em] uppercase">Sprint</span>
        </button>
      </div>

      {altHeld ? (
        <div className="flex flex-col gap-[1px]">
          {tools.map((t) => (
            <button
              key={t.aria}
              type="button"
              onClick={t.onClick}
              aria-label={t.aria}
              className="flex items-center gap-[8px] px-[6px] py-[4px] text-hld-muted-text hover:text-hld-cyan hover:bg-hld-cyan/5 border border-transparent hover:border-hld-cyan/35 transition-colors"
            >
              <span className="text-[13px] w-[16px] text-center shrink-0">{t.g}</span>
              <span className="font-mono text-[9px] tracking-[0.12em] uppercase truncate">{t.aria}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-[2px]">
          {tools.map((t) => (
            <button
              key={t.aria}
              type="button"
              onClick={t.onClick}
              aria-label={t.aria}
              {...cap(t.name)}
              className="flex items-center justify-center py-[7px] text-[13px] text-hld-muted-text hover:text-hld-cyan hover:bg-hld-cyan/5 border border-transparent hover:border-hld-cyan/35 transition-colors"
            >
              {t.g}
            </button>
          ))}
        </div>
      )}

      <div
        className="h-[16px] flex items-center justify-center font-mono text-[9px] tracking-[0.14em] uppercase transition-colors truncate px-1"
        style={{ color: caption || altHeld ? 'var(--color-hld-cyan)' : 'var(--color-hld-muted)' }}
      >
        {altHeld ? 'tool names · release ⌥' : (caption ?? idleStats)}
      </div>
    </div>
  );
}
