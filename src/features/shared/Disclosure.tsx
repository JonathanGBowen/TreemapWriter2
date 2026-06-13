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
        className="flex items-center gap-[8px] w-full border-t border-hld-border text-hld-muted-text hover:text-hld-cyan font-mono text-[9px] font-bold tracking-[0.14em] uppercase py-[9px] px-[2px] text-left transition-colors"
      >
        <span className={`inline-block text-[8px] transition-transform ${open ? 'rotate-90' : ''}`}>▸</span>
        {pip && <Pip status={pip} size="sm" />}
        {label}
        {count != null && <span className="ml-auto font-normal tracking-[0.1em]">{count}</span>}
      </button>
      {open && <div className="px-[2px] pb-[12px] pt-[4px]">{children}</div>}
    </div>
  );
}
