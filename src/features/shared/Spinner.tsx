import type { CSSProperties } from 'react';

/**
 * The one in-flight spinner — a thin rotating ring in a state hue. Replaces the
 * hand-rolled `rounded-full border-t animate-spin` spans that were duplicated
 * across the report/loader surfaces. Carries an accessible "Loading" label (the
 * inline copies had none). For button-busy states the lucide `Loader2` icon
 * stays the idiom; this is for standalone "working…" panels.
 */
type SpinnerHue = 'cyan' | 'purple' | 'green' | 'yellow' | 'magenta';

// Literal class pairs so Tailwind's JIT sees them (no dynamic class names).
const HUE_CLASS: Record<SpinnerHue, string> = {
  cyan: 'border-hld-cyan/25 border-t-hld-cyan',
  purple: 'border-hld-feat-running/30 border-t-hld-feat-running',
  green: 'border-hld-green/25 border-t-hld-green',
  yellow: 'border-hld-yellow/25 border-t-hld-yellow',
  magenta: 'border-hld-magenta/25 border-t-hld-magenta',
};

interface SpinnerProps {
  /** Diameter in px. */
  size?: number;
  hue?: SpinnerHue;
  className?: string;
  style?: CSSProperties;
  /** Accessible label; defaults to "Loading". */
  label?: string;
}

export function Spinner({ size = 12, hue = 'cyan', className = '', style, label = 'Loading' }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={`inline-block rounded-full border-[1.5px] animate-spin ${HUE_CLASS[hue]} ${className}`}
      style={{ width: size, height: size, ...style }}
    />
  );
}
