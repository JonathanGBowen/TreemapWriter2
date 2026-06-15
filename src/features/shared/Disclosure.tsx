import { useState } from 'react';
import type { ReactNode } from 'react';
import { Pip, type PipStatus } from './Pip';

/**
 * A collapsed reading-index / detail row. Opens one block at a time.
 * `pip` shows a standing-state diamond at rest (e.g. magenta on Objections).
 * The chevron rotates; the row is the full-width toggle.
 */
interface DisclosureProps {
  label: ReactNode;
  count?: ReactNode;
  pip?: PipStatus;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}

export function Disclosure({ label, count, pip, defaultOpen = false, children, className = '' }: DisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-[10px] w-full border-t border-hld-border text-hld-muted-text-2 hover:text-hld-cyan font-mono text-[10px] font-semibold tracking-[0.12em] uppercase py-[13px] px-[2px] text-left transition-colors"
      >
        <span className={`inline-block text-[9px] transition-transform ${open ? 'rotate-90' : ''}`}>▸</span>
        {pip && <Pip status={pip} size="sm" />}
        {label}
        {count != null && <span className="ml-auto font-normal text-hld-muted tracking-[0.1em]">{count}</span>}
      </button>
      {open && <div className="px-[2px] pb-[16px] pt-[2px]">{children}</div>}
    </div>
  );
}
