import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useStore } from '../../store';
import { ModalShell } from './ModalShell';

export interface Command {
  id: string;
  label: string;
  hint?: string;
  glyph?: string;
  shortcut?: string;
  run: () => void;
}

/**
 * The Cmd/Ctrl+K command palette — one filterable, keyboard-navigable list of
 * every primary action by name. It is the discoverable door to the glyph-only
 * dock tools, and the canonical "Assist" entry for Coach / Generate specs /
 * Revise. Presentational: App.tsx builds the command list; this owns only its
 * open flag plus the search/selection state.
 */
export function CommandPaletteModal({ commands }: { commands: Command[] }) {
  const isOpen = useStore((s) => s.showCommandPalette);
  const setShow = useStore((s) => s.setShowCommandPalette);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return commands;
    return commands.filter((c) => `${c.label} ${c.hint ?? ''}`.toLowerCase().includes(needle));
  }, [q, commands]);

  useEffect(() => {
    if (isOpen) {
      setQ('');
      setActive(0);
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  useEffect(() => {
    setActive(0);
  }, [q]);

  if (!isOpen) return null;
  const onClose = () => setShow(false);

  const runAt = (i: number) => {
    const cmd = filtered[i];
    if (!cmd) return;
    onClose();
    cmd.run();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runAt(active);
    }
  };

  return (
    <ModalShell
      eyebrow="Command"
      title="Jump to…"
      sub={`${filtered.length} action${filtered.length === 1 ? '' : 's'}`}
      onClose={onClose}
      widthClass="max-w-lg"
    >
      <div className="flex flex-col gap-[12px]">
        <div className="flex items-center gap-[8px] border-b border-hld-border pb-[7px]">
          <span className="font-mono text-[10px] tracking-[0.1em] text-hld-muted-text shrink-0">⌘K</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type to filter actions…"
            aria-label="Filter commands"
            className="flex-1 bg-transparent border-none outline-none text-[11px] text-hld-text placeholder:text-hld-muted-text/70 placeholder:uppercase placeholder:tracking-[0.1em] placeholder:font-mono"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-10 text-hld-muted-text font-mono text-[10px] uppercase tracking-[0.14em]">
            No actions found.
          </div>
        ) : (
          <div className="border border-hld-border max-h-[340px] overflow-y-auto">
            {filtered.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onClick={() => runAt(i)}
                onMouseEnter={() => setActive(i)}
                className={`w-full flex items-center gap-[11px] px-[12px] py-[9px] text-left border-b border-hld-border/60 last:border-b-0 transition-colors ${
                  i === active ? 'bg-hld-cyan/[0.08]' : 'hover:bg-hld-cyan/[0.03]'
                }`}
              >
                <span className="w-[16px] text-center text-[13px] text-hld-muted-text shrink-0">{c.glyph ?? '›'}</span>
                <span
                  className={`flex-1 min-w-0 truncate text-[11px] tracking-[0.04em] ${
                    i === active ? 'text-hld-cyan font-bold' : 'text-hld-text'
                  }`}
                >
                  {c.label}
                </span>
                {c.hint && (
                  <span className="font-mono text-[9px] tracking-[0.08em] uppercase text-hld-muted-text shrink-0 truncate max-w-[45%]">
                    {c.hint}
                  </span>
                )}
                {c.shortcut && (
                  <span className="font-mono text-[9px] tracking-[0.08em] text-hld-muted-text shrink-0">{c.shortcut}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </ModalShell>
  );
}
