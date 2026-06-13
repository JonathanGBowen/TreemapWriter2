import type { CSSProperties } from 'react';

/**
 * The one state vocabulary, as a single component.
 * green = done/safe · yellow = attention · magenta = missing/failing ·
 * cyan = active · purple = secondary · idle = untouched (hollow) · dim = inert.
 * Backed by the `.hld-pip*` primitives in index.css.
 */
export type PipStatus = 'idle' | 'green' | 'yellow' | 'magenta' | 'cyan' | 'purple' | 'dim';

const STATUS_CLASS: Record<PipStatus, string> = {
  idle: 'hld-pip-idle',
  green: 'hld-pip-green',
  yellow: 'hld-pip-yellow',
  magenta: 'hld-pip-magenta',
  cyan: 'hld-pip-cyan',
  purple: 'hld-pip-purple',
  dim: 'hld-pip-dim',
};

interface PipProps {
  status: PipStatus;
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Accessible label; also surfaces as a native tooltip. */
  title?: string;
}

export function Pip({ status, size = 'md', pulse = false, className = '', style, title }: PipProps) {
  const sizeClass = size === 'sm' ? 'hld-pip-sm' : size === 'lg' ? 'hld-pip-lg' : '';
  const classes = ['hld-pip', STATUS_CLASS[status], sizeClass, pulse ? 'hld-pip-pulse' : '', className]
    .filter(Boolean)
    .join(' ');
  return <span className={classes} style={style} title={title} aria-hidden={title ? undefined : true} />;
}
