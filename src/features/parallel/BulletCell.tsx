import { useLayoutEffect, useRef } from 'react';
import { Plus, X } from 'lucide-react';
import type { BlockStatus } from '../../state/parallel-state';

/** A textarea that grows to fit its one-or-two-sentence distillation. */
function AutoTextarea({
  value,
  onChange,
  onBlur,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      rows={1}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      className={className}
    />
  );
}

const ACCENT = {
  a: 'focus:border-hld-cyan focus:shadow-[0_0_10px_rgba(0,232,245,0.15)]',
  b: 'focus:border-hld-green focus:shadow-[0_0_10px_rgba(0,232,117,0.15)]',
} as const;

/**
 * One reverse-outline bullet cell. Editable for prose (outlineA: correct
 * faithfulness; outlineB: edit the target). Non-prose blocks (heading/list/code)
 * are their own distillation and shown read-only. The outlineB column carries the
 * insert/delete affordances.
 */
export function BulletCell({
  value,
  editable,
  accent,
  status,
  placeholder,
  onChange,
  onBlur,
  onInsert,
  onDelete,
}: {
  value: string;
  editable: boolean;
  accent: 'a' | 'b';
  status?: BlockStatus;
  placeholder?: string;
  onChange?: (v: string) => void;
  onBlur?: () => void;
  onInsert?: () => void;
  onDelete?: () => void;
}) {
  const edited = accent === 'b' && (status === 'edited' || status === 'inserted');
  const base = `flex-1 min-w-0 px-3.5 py-2.5 border-r border-hld-border relative group ${
    edited ? 'bg-hld-green/[0.04]' : ''
  }`;

  if (!editable) {
    return (
      <div className={base}>
        <div className="font-mono text-[11px] leading-relaxed text-hld-muted-text/70 whitespace-pre-wrap break-words italic">
          {value}
        </div>
      </div>
    );
  }

  return (
    <div className={base}>
      <AutoTextarea
        value={value}
        onChange={(v) => onChange?.(v)}
        onBlur={onBlur}
        placeholder={placeholder}
        className={`w-full resize-none bg-transparent outline-none border border-transparent text-hld-text font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap break-words ${ACCENT[accent]} rounded-sm px-1 -mx-1`}
      />
      {accent === 'b' && (
        <div className="absolute -bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            title="Insert a new point after this one"
            onClick={onInsert}
            className="w-[18px] h-[18px] flex items-center justify-center border border-hld-border bg-hld-surface-2 text-hld-muted-text hover:text-hld-green hover:border-hld-green/40 transition-colors"
          >
            <Plus size={11} />
          </button>
          <button
            type="button"
            title="Delete this point (and its paragraph)"
            onClick={onDelete}
            className="w-[18px] h-[18px] flex items-center justify-center border border-hld-border bg-hld-surface-2 text-hld-muted-text hover:text-hld-magenta hover:border-hld-magenta/40 transition-colors"
          >
            <X size={11} />
          </button>
        </div>
      )}
    </div>
  );
}
