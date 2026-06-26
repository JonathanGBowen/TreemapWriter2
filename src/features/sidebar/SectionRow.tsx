import { Section } from "../../types";

/** Status → the small filled square used in the section list (rows unchanged from
 *  the prior batch; only extracted here to keep Sidebar.tsx under the line cap). */
const STATUS_SQUARE: Record<string, { color: string; shadow: string }> = {
  success: { color: 'bg-hld-green', shadow: 'shadow-[0_0_5px_var(--tw-colors-hld-green)]' },
  fail: { color: 'bg-hld-magenta', shadow: 'shadow-[0_0_5px_var(--tw-colors-hld-magenta)]' },
  stale: { color: 'bg-hld-yellow', shadow: 'shadow-[0_0_5px_var(--tw-colors-hld-yellow)]' },
  running: { color: 'bg-hld-cyan', shadow: 'animate-pulse' },
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
  const sq = STATUS_SQUARE[status] ?? { color: 'bg-hld-dim', shadow: '' };
  return (
    <div
      onClick={() => onSelect(section.id)}
      className={`flex items-center gap-0 p-[4px_12px] cursor-pointer transition-all relative select-none hover:bg-hld-surface-2 ${selected ? 'bg-[rgba(0,232,245,0.05)]' : ''}`}
    >
      {selected && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-hld-cyan shadow-[0_0_6px_var(--tw-colors-hld-cyan)]" />}
      <div className="shrink-0" style={{ width: `${section.level * 16}px` }} />
      <div className={`w-[6px] h-[6px] shrink-0 mr-2 transition-shadow ${sq.color} ${sq.shadow}`} />
      <div className={`flex-1 text-ui-row whitespace-nowrap overflow-hidden text-ellipsis ${selected ? 'text-hld-cyan opacity-100 font-bold' : 'text-hld-text opacity-65'}`}>
        {section.title}
      </div>
      <div className="text-ui-meta text-hld-muted-text">{section.wordCount}w</div>
    </div>
  );
}
