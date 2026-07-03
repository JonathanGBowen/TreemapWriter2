// The quick-capture surface (Arpeggio Phase 3): thought-capture is sacred. The
// Cmd/Ctrl+I chord opens this from anywhere; type, Enter, gone — a stray idea parked
// in under thirty seconds with zero navigation. Self-gates on `captureOpen`. Enter
// saves (Shift+Enter for a newline); Escape cancels. The item lands in the inbox tray.

import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../state';

export function InboxCapture() {
  const open = useStore((s) => s.captureOpen);
  const close = useStore((s) => s.closeCapture);
  const addInboxItem = useStore((s) => s.addInboxItem);
  const [text, setText] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setText('');
      // Autofocus the field the moment it appears (recognition over recall).
      const t = window.setTimeout(() => ref.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  if (!open) return null;

  const save = () => {
    void addInboxItem(text);
    close();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[18vh] bg-black/40"
      onClick={close}
    >
      <div
        className="w-[min(560px,92vw)] bg-hld-surface border border-hld-border rounded-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-[8px] px-[14px] h-[34px] border-b border-hld-border">
          <span aria-hidden className="w-[5px] h-[5px] rotate-45 bg-hld-cyan" />
          <span className="font-mono text-[9px] tracking-[0.16em] uppercase text-hld-muted-text">Capture</span>
          <span className="ml-auto font-mono text-[8px] tracking-[0.1em] uppercase text-hld-muted">Enter to park · Esc to cancel</span>
        </div>
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              close();
            } else if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              save();
            }
          }}
          rows={3}
          placeholder="A thought that arrived at the wrong moment…"
          className="w-full resize-none bg-transparent px-[14px] py-[12px] text-[14px] leading-relaxed text-hld-text placeholder:text-hld-muted focus:outline-none font-sans"
        />
      </div>
    </div>
  );
}
