import { Section } from "../../types";

/** Status → the small filled square used in the section list. Glow = alive: a
 *  section's readiness is a static state, so success/fail/stale stay flat; only
 *  `running` (in-flight) animates. (The prior glows referenced the Tailwind-v3
 *  `--tw-colors-*` vars, undefined under v4, so they never rendered anyway.) */
const STATUS_SQUARE: Record<string, { color: string; live: string }> = {
  success: { color: 'bg-hld-green', live: '' },
  fail: { color: 'bg-hld-magenta', live: '' },
  stale: { color: 'bg-hld-yellow', live: '' },
  running: { color: 'bg-hld-cyan', live: 'animate-pulse' },
};

/** Text equivalent for the colour-only status square (colour is never the only channel). */
const STATUS_LABEL: Record<string, string> = {
  success: 'Solid',
  fail: 'Failing',
  stale: 'Stale',
  running: 'Running',
};

export function SectionRow({
  section,
  selected,
  status,
  onSelect,
}: {
  section: Section;
  selected: boolean;
  status: string;
  onSelect: (id: string) => void;
}) {
  const sq = STATUS_SQUARE[status] ?? { color: 'bg-hld-dim', live: '' };
  return (
    <div
      role="button"
      tabIndex={0}
      aria-current={selected ? 'true' : undefined}
      onClick={() => onSelect(section.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(section.id);
        }
      }}
      className={`flex items-center gap-0 p-[4px_12px] cursor-pointer transition-all relative select-none hover:bg-hld-surface-2 ${selected ? 'bg-[rgba(0,232,245,0.05)]' : ''}`}
    >
      {selected && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-hld-cyan shadow-[0_0_6px_var(--tw-colors-hld-cyan)]" />}
      <div className="shrink-0" style={{ width: `${section.level * 16}px` }} />
      <div className={`w-[6px] h-[6px] shrink-0 mr-2 ${sq.color} ${sq.live}`} title={STATUS_LABEL[status] ?? status} />
      <div className={`flex-1 text-ui-row whitespace-nowrap overflow-hidden text-ellipsis ${selected ? 'text-hld-cyan opacity-100 font-bold' : 'text-hld-text opacity-65'}`}>
        {section.title}
      </div>
      <div className="text-ui-meta text-hld-muted-text">{section.wordCount}w</div>
    </div>
  );
}
