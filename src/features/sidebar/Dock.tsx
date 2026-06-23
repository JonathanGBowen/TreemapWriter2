import type { CSSProperties } from "react";
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
  const setShowProjectFileModal = useStore((s) => s.setShowProjectFileModal);
  const openCompare = useStore((s) => s.openCompare);
  const openClimate = useStore((s) => s.openClimate);

  const continueLabel = (selectedId ? findTitleById(sections, selectedId) : null) ?? sections[0]?.title ?? 'Begin';
  const wordCount = markdown.trim() ? markdown.trim().split(/\s+/).length : 0;
  const idleStats = `${wordCount.toLocaleString()}W · ${sections.length} sections`;

  const cap = (label: string) => ({
    onMouseEnter: () => setCaption(label),
    onMouseLeave: () => setCaption(null),
    onFocus: () => setCaption(label),
    onBlur: () => setCaption(null),
  });

  const tools: { g: string; name: string; aria: string; onClick: () => void }[] = [
    { g: '◉', name: 'Assist — Coach · Generate specs · Revise · every action (⌘K)', aria: 'Assist', onClick: () => setShowCommandPalette(true) },
    { g: '▦', name: 'Goal map — section goal editor', aria: 'Goal map', onClick: () => setShowSectionMapModal(true) },
    { g: '◈', name: 'Dependencies — section graph', aria: 'Dependencies', onClick: () => setShowGraphModal(true) },
    { g: '❝', name: 'Prompts — AI routing', aria: 'Prompts', onClick: () => setShowPromptsGraphModal(true) },
    { g: '{}', name: 'Raw data — JSON editor', aria: 'Raw data', onClick: () => setShowProjectFileModal(true) },
    { g: '≈', name: 'Compare — version A/B evaluation', aria: 'Compare', onClick: () => openCompare() },
    { g: '≋', name: 'Climate — atmospheric weather report', aria: 'Climate', onClick: () => openClimate() },
  ];

  return (
    <div className="flex flex-col gap-[5px] px-2 pt-2 pb-1 border-t border-hld-border bg-[#080d13] shrink-0">
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
        <button type="button" onClick={() => setShowSprintModal(true)} aria-label="Sprint" {...cap('Sprint — goal or draft, timed')}
          className="flex-1 py-[6px] border border-hld-green/25 text-hld-green leading-none hover:bg-hld-green/10 transition-colors flex items-center justify-center gap-2">
          <span className="text-[12px]">»</span>
          <span className="font-mono text-[9px] tracking-[0.14em] uppercase">Sprint</span>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-[2px]">
        {tools.map((t) => (
          <button
            key={t.aria}
            type="button"
            onClick={t.onClick}
            aria-label={t.aria}
            title={t.name}
            {...cap(t.name)}
            className="flex items-center justify-center py-[7px] text-[13px] text-hld-muted-text hover:text-hld-cyan hover:bg-hld-cyan/5 border border-transparent hover:border-hld-cyan/35 transition-colors"
          >
            {t.g}
          </button>
        ))}
      </div>

      <div
        className="h-[16px] flex items-center justify-center font-mono text-[9px] tracking-[0.14em] uppercase transition-colors truncate px-1"
        style={{ color: caption ? 'var(--color-hld-cyan)' : 'var(--color-hld-muted)' }}
      >
        {caption ?? idleStats}
      </div>
    </div>
  );
}
