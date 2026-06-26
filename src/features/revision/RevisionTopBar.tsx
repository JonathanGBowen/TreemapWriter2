import { SlidersHorizontal } from 'lucide-react';
import { useStore } from '../../state';
import { useCurrentSection } from '../tests-panel/use-current-section';

/** Workspace header: Done · ⟐ §title · Preview-all toggle · in-use source glyphs · settings. */
export function RevisionTopBar() {
  const close = useStore((s) => s.closeRevisionWorkspace);
  const phase = useStore((s) => s.revisionPhase);
  const previewAll = useStore((s) => s.previewAll);
  const setPreviewAll = useStore((s) => s.setPreviewAll);
  const sources = useStore((s) => s.revisionSources);
  const selectedIds = useStore((s) => s.selectedSourceIds);
  const setShowSettings = useStore((s) => s.setShowRevisionSettingsModal);
  const current = useCurrentSection();
  const inUse = sources.filter((s) => selectedIds.includes(s.id));

  return (
    <div className="h-[54px] shrink-0 flex items-center gap-4 px-[18px] border-b border-hld-cyan/25 bg-gradient-to-b from-hld-cyan/5 to-transparent">
      <button
        type="button"
        onClick={close}
        className="px-2.5 py-1.5 border border-hld-cyan/30 text-hld-cyan hover:bg-hld-cyan/10 font-mono text-[10px] uppercase tracking-[0.12em] transition-all"
      >
        ‹ Done — back to writing
      </button>
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-hld-cyan text-[14px]">⟐</span>
        <span className="font-mono uppercase tracking-[0.14em] text-[10px] font-bold text-hld-text">
          Revision Workspace
        </span>
        <span className="text-hld-border-strong">›</span>
        <span className="font-mono uppercase tracking-[0.14em] text-[9px] text-hld-cyan truncate">
          {current ? current.title : 'select a section'}
        </span>
      </div>
      <div className="ml-auto flex items-center gap-3">
        {phase === 'review' && (
          <button
            type="button"
            onClick={() => setPreviewAll(!previewAll)}
            title="Show every pending edit inline, at once"
            className={`px-2.5 py-1.5 border font-mono text-[10px] uppercase tracking-[0.12em] transition-all ${
              previewAll
                ? 'border-hld-cyan/40 text-hld-cyan bg-hld-cyan/10 shadow-[0_0_10px_rgba(0,232,245,0.2)]'
                : 'border-hld-border text-hld-muted-text hover:text-hld-text'
            }`}
          >
            {previewAll ? '◉ Previewing all' : '◐ Preview all edits'}
          </button>
        )}
        <div className="flex items-center gap-2">
          {inUse.map((s) => (
            <span key={s.id} className="font-mono text-[9px] text-hld-muted-text flex items-center gap-1">
              <span className="text-[11px]">{s.glyph}</span>
              {s.label}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowSettings(true)}
          title="Revision settings — instruction, model, token preview, prompts"
          aria-label="Revision settings"
          className="w-[28px] h-[28px] flex items-center justify-center border border-hld-border text-hld-muted-text hover:text-hld-cyan hover:border-hld-cyan/40 transition-colors"
        >
          <SlidersHorizontal size={13} />
        </button>
      </div>
    </div>
  );
}
