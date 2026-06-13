import { useEffect } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { X } from 'lucide-react';

/**
 * Presentational HLD modal frame. It does NOT own openness — each modal keeps
 * its own `useStore(s => s.showXModal)` flag and passes `onClose` (per AGENTS.md
 * self-mounting rule). Square corners, top accent line + glow, quiet header,
 * scrolling body, footer. Backdrop dark, no blur, no rounded corners.
 *
 * ESC → onClose. ENTER → onPrimary (unless focus is in a textarea, or disabled).
 * Default footer = quiet CANCEL + one lit primary; pass `footer` to override
 * (e.g. the Projects modal's "Load demo / + New project" row).
 */
interface ModalShellProps {
  accent?: 'cyan' | 'magenta';
  eyebrow: string;
  title: ReactNode;
  sub?: ReactNode;
  onClose: () => void;
  onPrimary?: () => void;
  primaryLabel?: ReactNode;
  primaryDisabled?: boolean;
  footer?: ReactNode;
  widthClass?: string;
  children: ReactNode;
}

/** Default footer: quiet CANCEL pushed right + one lit primary. */
function DefaultFooter({
  litClass,
  accentColor,
  onClose,
  onPrimary,
  primaryLabel,
  primaryDisabled,
}: {
  litClass: string;
  accentColor: string;
  onClose: () => void;
  onPrimary: () => void;
  primaryLabel: ReactNode;
  primaryDisabled: boolean;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onClose}
        className="ml-auto bg-transparent border-none text-hld-muted-text hover:text-hld-text font-mono text-[9px] tracking-[0.12em] uppercase cursor-pointer transition-colors"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onPrimary}
        disabled={primaryDisabled}
        style={{ '--br-color': accentColor } as CSSProperties}
        className={`bracketed ${litClass} px-[20px] py-[10px] font-mono text-[10px] font-bold tracking-[0.14em] uppercase disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        {primaryLabel}
      </button>
    </>
  );
}

export function ModalShell({
  accent = 'cyan',
  eyebrow,
  title,
  sub,
  onClose,
  onPrimary,
  primaryLabel,
  primaryDisabled = false,
  footer,
  widthClass = 'max-w-md',
  children,
}: ModalShellProps) {
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Enter' && onPrimary && !primaryDisabled) {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT')) return;
        e.preventDefault();
        onPrimary();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onPrimary, primaryDisabled]);

  const accentColor = accent === 'magenta' ? 'var(--color-hld-magenta)' : 'var(--color-hld-cyan)';
  const litClass = accent === 'magenta' ? 'hld-lit-magenta' : 'hld-lit';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 animate-in fade-in duration-150"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`relative bg-hld-surface border border-hld-border shadow-[0_24px_60px_rgba(0,0,0,0.7)] w-full ${widthClass} flex flex-col max-h-[88vh]`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: accentColor, boxShadow: `0 0 12px ${accentColor}` }} />

        <div className="flex items-start gap-3 px-[18px] pt-[14px] pb-[12px] border-b border-hld-border">
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[8px] tracking-[0.18em] uppercase text-hld-muted-text mb-1">{eyebrow}</div>
            <div className="font-mono text-[13px] font-bold tracking-[0.1em] uppercase text-hld-text">{title}</div>
            {sub != null && <div className="font-mono text-[9px] tracking-[0.1em] uppercase text-hld-muted-text mt-1">{sub}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-[26px] h-[26px] flex items-center justify-center border border-hld-border text-hld-muted-text hover:text-hld-cyan hover:border-hld-cyan/40 transition-colors shrink-0"
          >
            <X size={13} />
          </button>
        </div>

        <div className="p-[18px] overflow-y-auto">{children}</div>

        {footer != null ? (
          <div className="flex items-center gap-3 px-[18px] py-[12px] border-t border-hld-border">{footer}</div>
        ) : onPrimary && primaryLabel != null ? (
          <div className="flex items-center gap-3 px-[18px] py-[12px] border-t border-hld-border">
            <DefaultFooter
              litClass={litClass}
              accentColor={accentColor}
              onClose={onClose}
              onPrimary={onPrimary}
              primaryLabel={primaryLabel}
              primaryDisabled={primaryDisabled}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
