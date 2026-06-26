// Workspace chrome: a cyan accent line, the GIST EDITOR mark, the document title +
// its scale (sections · words), and the settings + close affordances. Mirrors the
// other workspace top bars; the cyan identity is the gist's (vs. Parallel's green).

import { SlidersHorizontal } from 'lucide-react';
import { useStore } from '../../state';
import { countWords } from '../../lib/utils';

export function GistTopBar() {
  const close = useStore((s) => s.closeGist);
  const setShowSettings = useStore((s) => s.setShowGistSettingsModal);
  const projectName = useStore((s) => s.projectName);
  const sections = useStore((s) => s.sections);
  const localContent = useStore((s) => s.localContent);

  const words = countWords(localContent).toLocaleString();
  const count = sections.length;

  return (
    <div className="relative h-[54px] shrink-0 flex items-center gap-4 px-[20px] bg-hld-surface border-b border-hld-border">
      <div className="absolute top-0 left-0 right-0" style={{ height: 1, background: 'var(--color-hld-cyan)', boxShadow: '0 0 14px var(--color-hld-cyan)' }} />
      <button
        type="button"
        onClick={close}
        className="px-2.5 py-1.5 border border-hld-cyan/30 text-hld-cyan hover:bg-hld-cyan/10 font-mono text-[10px] uppercase tracking-[0.12em] transition-all"
      >
        ‹ Done — back to writing
      </button>
      <span aria-hidden style={{ width: 9, height: 9, transform: 'rotate(45deg)', background: 'var(--color-hld-cyan)', boxShadow: '0 0 10px var(--color-hld-cyan)' }} />
      {/* eslint-disable-next-line no-restricted-syntax */}
      <span className="font-mono uppercase tracking-[0.26em] text-[11px] font-bold" style={{ color: '#eaf6ff' }}>Gist Editor</span>
      <span style={{ width: 1, height: 14, background: 'var(--color-hld-border-strong)' }} />
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="font-sans text-[15px] leading-none text-hld-text truncate">{projectName?.trim() || 'Untitled'}</span>
        <span className="font-mono uppercase text-[8px] tracking-[0.2em] text-hld-muted">
          {count} section{count === 1 ? '' : 's'} · {words} words
        </span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <button
          type="button"
          onClick={() => setShowSettings(true)}
          title="Gist settings — model depth, prompts"
          aria-label="Gist settings"
          className="w-[28px] h-[28px] flex items-center justify-center border border-hld-border text-hld-muted-text hover:text-hld-cyan hover:border-hld-cyan/40 transition-colors"
        >
          <SlidersHorizontal size={13} />
        </button>
        <button
          type="button"
          onClick={close}
          title="Close workspace"
          aria-label="Close gist editor"
          className="w-[26px] h-[26px] flex items-center justify-center border border-hld-border text-hld-muted-text hover:text-hld-cyan transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
