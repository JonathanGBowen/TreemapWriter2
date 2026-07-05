// The W₁ Canvas top bar (Arpeggio Phase 4) — the workspace's chrome: the title +
// live node/edge counts, the suggest-layout control (which becomes an accept/reject
// pair while a preview is live), the list-view toggle, and close. Pure presentation;
// every action is a prop the workspace owns.

export function CanvasTopBar({
  nodeCount,
  edgeCount,
  previewing,
  onAccept,
  onReject,
  onSuggest,
  listView,
  onToggleList,
  onClose,
}: {
  nodeCount: number;
  edgeCount: number;
  previewing: boolean;
  onAccept: () => void;
  onReject: () => void;
  onSuggest: () => void;
  listView: boolean;
  onToggleList: () => void;
  onClose: () => void;
}) {
  return (
    <header className="shrink-0 flex items-center gap-[12px] px-[18px] h-[46px] border-b border-hld-border bg-hld-surface-3">
      <span aria-hidden className="w-[6px] h-[6px] rotate-45 bg-hld-purple" />
      <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-hld-muted-text">W₁ Canvas</span>
      <span className="font-mono text-[9px] tracking-[0.1em] uppercase text-hld-muted">
        {nodeCount} node{nodeCount === 1 ? '' : 's'} · {edgeCount} edge{edgeCount === 1 ? '' : 's'}
      </span>
      <div className="flex-1" />
      {previewing ? (
        <div className="flex items-center gap-[8px]">
          <span className="font-mono text-[8px] tracking-[0.1em] uppercase text-hld-cyan">Preview layout</span>
          <button type="button" onClick={onAccept} className="px-[10px] py-[5px] font-mono text-[8px] tracking-[0.12em] uppercase border border-hld-cyan text-hld-cyan hover:bg-hld-cyan/10 transition-colors">
            Accept
          </button>
          <button type="button" onClick={onReject} className="px-[10px] py-[5px] font-mono text-[8px] tracking-[0.12em] uppercase border border-hld-border text-hld-muted hover:text-hld-text transition-colors">
            Reject
          </button>
        </div>
      ) : (
        <button type="button" onClick={onSuggest} title="Settle the graph into a suggested layout (preview → accept, undoable)" className="px-[10px] py-[5px] font-mono text-[8px] tracking-[0.12em] uppercase border border-hld-border text-hld-muted hover:text-hld-cyan hover:border-hld-cyan/40 transition-colors">
          ✦ Suggest layout
        </button>
      )}
      <button type="button" onClick={onToggleList} aria-pressed={listView} title="Toggle the list view" className={`px-[10px] py-[5px] font-mono text-[8px] tracking-[0.12em] uppercase border transition-colors ${listView ? 'border-hld-cyan text-hld-cyan' : 'border-hld-border text-hld-muted hover:text-hld-text'}`}>
        ☰ List
      </button>
      <button type="button" onClick={onClose} aria-label="Close the canvas" className="font-mono text-[11px] text-hld-muted hover:text-hld-text transition-colors">
        ✕
      </button>
    </header>
  );
}
