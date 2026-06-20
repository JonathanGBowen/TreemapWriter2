import { useStore } from '../../state';
import { Pip, type PipStatus } from '../shared/Pip';
import { useColumnResize } from '../shared/useColumnResize';
import { ResizeHandle } from '../shared/ResizeHandle';
import type { Section } from '../../types';

/** Section status → the one pip vocabulary. */
const STATUS_PIP: Record<string, PipStatus> = {
  idle: 'idle',
  stale: 'yellow',
  running: 'purple',
  fail: 'magenta',
  success: 'green',
};

const flatten = (
  nodes: Section[],
  depth = 0,
  out: { node: Section; depth: number }[] = [],
): { node: Section; depth: number }[] => {
  nodes.forEach((n) => {
    out.push({ node: n, depth });
    flatten(n.children, depth + 1, out);
  });
  return out;
};

/**
 * The slim section rail — navigation without the full treemap's visual weight.
 * Drives the same `selectedId` the rest of the app uses. Drag the right edge to
 * resize (width persists per-project via ui-state).
 */
export function RevisionRail() {
  const sections = useStore((s) => s.sections);
  const selectedId = useStore((s) => s.selectedId);
  const setSelectedId = useStore((s) => s.setSelectedId);
  const testSuite = useStore((s) => s.testSuite);
  const width = useStore((s) => s.revisionRailWidth);
  const setWidth = useStore((s) => s.setRevisionRailWidth);
  const onResize = useColumnResize({ width, setWidth, edge: 'right', min: 120, max: 360 });
  const flat = flatten(sections);

  return (
    <div
      style={{ width }}
      className="shrink-0 relative border-r border-hld-border bg-hld-surface flex flex-col"
    >
      <div className="h-10 shrink-0 border-b border-hld-border flex items-center gap-2 px-3 bg-hld-surface2">
        <span className="text-hld-cyan text-[12px]">◇</span>
        <span className="font-mono uppercase tracking-[0.14em] text-[9px] text-hld-muted-text">sections</span>
      </div>
      <div className="flex-1 overflow-y-auto py-1.5">
        {sections.length > 0 && (
          <button
            type="button"
            onClick={() => setSelectedId('root')}
            title="Revise across the whole document (used by Citations mode)"
            style={{ paddingLeft: 10 }}
            className={`flex items-center gap-1.5 w-full text-left pr-2 py-1.5 border-l-2 transition-colors ${
              selectedId === 'root'
                ? 'bg-hld-cyan/10 border-hld-cyan'
                : 'border-transparent hover:bg-white/[0.02]'
            }`}
          >
            <Pip status={STATUS_PIP[testSuite['root']?.status ?? 'idle'] ?? 'idle'} size="sm" />
            <span
              className={`flex-1 font-mono text-[9.5px] uppercase tracking-[0.1em] truncate ${
                selectedId === 'root' ? 'text-hld-text font-semibold' : 'text-hld-muted-text'
              }`}
            >
              ◈ Whole document
            </span>
          </button>
        )}
        {flat.map(({ node, depth }) => {
          const sel = node.id === selectedId;
          const status = testSuite[node.id]?.status ?? 'idle';
          return (
            <button
              key={node.id}
              type="button"
              onClick={() => setSelectedId(node.id)}
              style={{ paddingLeft: 10 + depth * 12 }}
              className={`flex items-center gap-1.5 w-full text-left pr-2 py-1.5 border-l-2 transition-colors ${
                sel ? 'bg-hld-cyan/10 border-hld-cyan' : 'border-transparent hover:bg-white/[0.02]'
              }`}
            >
              <Pip status={STATUS_PIP[status] ?? 'idle'} size="sm" pulse={status === 'running'} />
              <span
                className={`flex-1 font-mono text-[9.5px] truncate ${
                  sel ? 'text-hld-text font-semibold' : 'text-hld-muted-text'
                }`}
              >
                {node.title}
              </span>
            </button>
          );
        })}
      </div>
      <ResizeHandle side="right" onMouseDown={onResize} />
    </div>
  );
}
