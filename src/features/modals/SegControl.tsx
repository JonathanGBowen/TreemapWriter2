import { useRef } from 'react';
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';

/**
 * Shared HLD segmented control (the modal "DEPTH" / "SCOPE" instrument).
 * One bordered row, hairline separators; the selected option is cyan (palette
 * 3C: selection is always "you," never content-magenta) with a tinted bg +
 * bracketed corners. Arrow keys move the selection (roving tabindex, radiogroup
 * semantics).
 */
export interface SegOption {
  glyph: ReactNode;
  label: string;
  fine?: ReactNode;
}

interface SegControlProps {
  options: SegOption[];
  value: number;
  onChange: (index: number) => void;
  ariaLabel?: string;
}

export function SegControl({ options, value, onChange, ariaLabel }: SegControlProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onColor = 'var(--color-hld-cyan)';
  const onBg = 'rgba(0,232,245,0.08)';
  const onInset = 'inset 0 0 14px rgba(0,232,245,0.06)';

  const onKey = (e: KeyboardEvent, i: number) => {
    let next = i;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % options.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + options.length) % options.length;
    else return;
    e.preventDefault();
    onChange(next);
    refs.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex border border-hld-border">
      {options.map((opt, i) => {
        const on = i === value;
        const selStyle = on
          ? ({ '--br-color': onColor, color: onColor, background: onBg, boxShadow: onInset } as CSSProperties)
          : undefined;
        return (
          <button
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(i)}
            onKeyDown={(e) => onKey(e, i)}
            style={selStyle}
            className={`flex-1 text-center px-[6px] pt-[10px] pb-[8px] border-l border-hld-border first:border-l-0 cursor-pointer transition-colors ${
              on ? 'bracketed' : 'hover:text-hld-text'
            }`}
          >
            <span className={`block text-[12px] leading-none mb-[4px] tracking-[0.1em] ${on ? '' : 'text-hld-muted-text'}`}>
              {opt.glyph}
            </span>
            <span className={`block font-mono text-[10px] font-bold tracking-[0.12em] uppercase ${on ? '' : 'text-hld-muted-text'}`}>
              {opt.label}
            </span>
            {opt.fine != null && (
              <span className="block font-mono text-[8px] tracking-[0.08em] uppercase mt-[3px] text-hld-muted-text opacity-85">
                {opt.fine}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
