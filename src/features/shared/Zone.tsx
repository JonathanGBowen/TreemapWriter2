import type { ReactNode } from 'react';

/**
 * Hairline = structure. A zone is an eyebrow + a 1px rule, never a box.
 * `meta` renders quiet muted text on the right; `children` renders raw
 * (use it for an interactive right-aligned control such as a function chip).
 */
interface ZoneProps {
  label?: string;
  meta?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function Zone({ label, meta, children, className = '' }: ZoneProps) {
  return (
    <div className={`flex items-center gap-[10px] ${className}`.trim()}>
      {label && (
        <span className="font-mono text-[10px] font-semibold tracking-[0.14em] uppercase text-hld-muted-text-2 shrink-0">
          {label}
        </span>
      )}
      <span className="h-px flex-1 bg-hld-border" />
      {meta != null && (
        <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-hld-muted-text shrink-0">
          {meta}
        </span>
      )}
      {children}
    </div>
  );
}
