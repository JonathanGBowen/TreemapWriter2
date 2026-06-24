import { SlidersHorizontal } from 'lucide-react';
import { useStore } from '../../state';
import { useParallelScope } from './use-parallel-scope';

/** Workspace header: Done · ▥ Parallel · scope title · section⇄whole-doc · settings. */
export function ParallelTopBar() {
  const close = useStore((s) => s.closeParallel);
  const wholeDoc = useStore((s) => s.parallelWholeDoc);
  const setWholeDoc = useStore((s) => s.setParallelWholeDoc);
  const setShowSettings = useStore((s) => s.setShowParallelSettingsModal);
  const scope = useParallelScope();

  return (
    <div className="h-[54px] shrink-0 flex items-center gap-4 px-[18px] border-b border-hld-green/25 bg-gradient-to-b from-hld-green/5 to-transparent">
      <button
        type="button"
        onClick={close}
        className="px-2.5 py-1.5 border border-hld-green/30 text-hld-green hover:bg-hld-green/10 font-mono text-[10px] uppercase tracking-[0.12em] transition-all"
      >
        ‹ Done — back to writing
      </button>
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-hld-green text-[14px]">▥</span>
        <span className="font-mono uppercase tracking-[0.14em] text-[10px] font-bold text-hld-text">
          Parallel
        </span>
        <span className="text-[#1f3050]">›</span>
        <span className="font-mono uppercase tracking-[0.14em] text-[9px] text-hld-green truncate">
          {scope ? scope.title : 'select a section'}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="flex border border-hld-border">
          {([
            { v: false, label: '§ Section' },
            { v: true, label: '◈ Whole doc' },
          ] as const).map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => setWholeDoc(opt.v)}
              className={`px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] transition-colors ${
                wholeDoc === opt.v
                  ? 'bg-hld-green/10 text-hld-green'
                  : 'text-hld-muted-text hover:text-hld-text'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowSettings(true)}
          title="Parallel settings — voice, model, token preview, prompts"
          aria-label="Parallel settings"
          className="w-[28px] h-[28px] flex items-center justify-center border border-hld-border text-hld-muted-text hover:text-hld-green hover:border-hld-green/40 transition-colors"
        >
          <SlidersHorizontal size={13} />
        </button>
      </div>
    </div>
  );
}
