import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useStore } from '../../state';
import { makeSourceId } from '../../state/revision-state';
import { Pip } from '../shared/Pip';

/** Glyph cycle for pasted sources (HLD style; mirrors the prototype's source kinds). */
const GLYPHS = ['✒', '⚐', '❡', '◎'];
const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
const inputCls =
  'bg-hld-bg border border-hld-border focus:border-hld-cyan outline-none text-hld-text font-mono text-[11px] px-2 py-1.5';

/** Inline paste form for a new ephemeral source (label + body). */
function AddSourceForm({ onAdd, onCancel }: { onAdd: (label: string, content: string) => void; onCancel: () => void }) {
  const [label, setLabel] = useState('');
  const [content, setContent] = useState('');
  return (
    <div className="flex flex-col gap-1.5 border border-hld-border bg-hld-bg p-2">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Label (e.g. Advisor notes)"
        className={inputCls}
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={4}
        placeholder="Paste the source text the engine may quote from…"
        className={`${inputCls} resize-none leading-[1.5]`}
      />
      <div className="flex justify-end gap-1.5">
        <button
          type="button"
          onClick={onCancel}
          className="px-2.5 py-1 border border-hld-border text-hld-muted-text hover:text-hld-text font-mono text-[9px] uppercase tracking-[0.12em]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onAdd(label, content)}
          disabled={!content.trim()}
          className="px-2.5 py-1 border border-hld-cyan/40 text-hld-cyan hover:bg-hld-cyan/10 disabled:opacity-35 disabled:cursor-not-allowed font-mono text-[9px] uppercase tracking-[0.12em]"
        >
          Add
        </button>
      </div>
    </div>
  );
}

/**
 * Ephemeral (session-only) source materials. The writer pastes advisor notes /
 * reviewer reports / reading notes here; sources are not persisted. Each chip
 * toggles selection; the engine quotes only from selected sources.
 */
export function SourcePicker() {
  const sources = useStore((s) => s.revisionSources);
  const selectedIds = useStore((s) => s.selectedSourceIds);
  const toggleSource = useStore((s) => s.toggleRevisionSource);
  const addSource = useStore((s) => s.addRevisionSource);
  const removeSource = useStore((s) => s.removeRevisionSource);
  const [adding, setAdding] = useState(false);

  const submit = (label: string, content: string) => {
    if (!content.trim()) return;
    addSource({
      id: makeSourceId(),
      kind: 'Source',
      label: label.trim() || 'Pasted source',
      glyph: GLYPHS[sources.length % GLYPHS.length],
      content: content.trim(),
    });
    setAdding(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {sources.map((s) => {
          const on = selectedIds.includes(s.id);
          return (
            <div
              key={s.id}
              onClick={() => toggleSource(s.id)}
              title={s.content.slice(0, 200)}
              className={`group flex items-center gap-1.5 px-2 py-1.5 border font-mono text-[9.5px] cursor-pointer transition-all ${
                on
                  ? 'border-hld-cyan/55 bg-hld-cyan/10 text-hld-cyan shadow-[0_0_10px_rgba(0,232,245,0.12)]'
                  : 'border-hld-border text-hld-muted-text hover:text-hld-text'
              }`}
            >
              <span className="text-[11px]" style={{ opacity: on ? 1 : 0.6 }}>
                {s.glyph}
              </span>
              <span className="font-semibold truncate max-w-[140px]">{s.label}</span>
              <span className="text-[8px] opacity-55">{wordCount(s.content)}</span>
              <Pip status={on ? 'cyan' : 'idle'} size="sm" />
              <button
                type="button"
                aria-label="Remove source"
                onClick={(e) => {
                  e.stopPropagation();
                  removeSource(s.id);
                }}
                className="opacity-0 group-hover:opacity-100 text-hld-muted-text hover:text-hld-magenta transition-opacity"
              >
                <X size={10} />
              </button>
            </div>
          );
        })}
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 px-2 py-1.5 border border-dashed border-hld-border text-hld-muted-text hover:text-hld-cyan hover:border-hld-cyan/40 font-mono text-[9.5px] uppercase tracking-[0.08em] transition-colors"
          >
            <Plus size={10} /> Add source
          </button>
        )}
      </div>

      {adding && <AddSourceForm onAdd={submit} onCancel={() => setAdding(false)} />}
    </div>
  );
}
