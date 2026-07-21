import React, { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

/**
 * The ONE sanctioned confirmation dialog (per VISION: destructive actions are
 * undoable, not confirmable — project delete is the sole exception). Unlike
 * the self-mounting modals it is prop-driven: App owns `confirmState` and
 * threads `requestConfirm` to callers, so this can stack above any open modal
 * (z-[110] vs the shells' z-[100]). Hand-rolled frame for that reason, but in
 * the same square-corner HLD grammar as ModalShell.
 */
export interface ConfirmModalProps {
  isOpen: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({ isOpen, message, onConfirm, onCancel }: ConfirmModalProps) {
  // ESC cancels — same key grammar as ModalShell. ENTER deliberately does
  // NOT confirm: this dialog only guards deletion.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4 animate-in fade-in duration-150"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="relative bg-hld-surface border border-hld-border shadow-[0_24px_60px_rgba(0,0,0,0.7)] w-full max-w-sm flex flex-col">
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'var(--color-hld-yellow)', boxShadow: '0 0 12px var(--color-hld-yellow)' }}
        />
        <div className="flex items-center gap-3 px-[18px] pt-[14px] pb-[12px] border-b border-hld-border">
          <AlertCircle className="text-hld-yellow shrink-0" size={16} />
          <div className="font-mono text-[13px] font-bold tracking-[0.1em] uppercase text-hld-text">
            Confirm action
          </div>
        </div>
        <p className="p-[18px] text-[12px] text-hld-muted-text leading-relaxed">{message}</p>
        <div className="flex items-center gap-3 px-[18px] py-[12px] border-t border-hld-border">
          <button
            type="button"
            onClick={onCancel}
            className="ml-auto bg-transparent border-none text-hld-muted-text hover:text-hld-text font-mono text-[9px] tracking-[0.12em] uppercase cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{ '--br-color': 'var(--color-hld-yellow)' } as React.CSSProperties}
            className="bracketed px-[20px] py-[10px] font-mono text-[10px] font-bold tracking-[0.14em] uppercase text-hld-yellow border border-hld-yellow/40 hover:bg-hld-yellow/10 transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
