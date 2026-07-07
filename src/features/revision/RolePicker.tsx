import { useState } from 'react';
import { DEFAULT_SOURCE_ROLE, SOURCE_ROLES, sourceRoleMeta } from '../../lib/source-roles';
import type { SourceRole } from '../../types';

const inputCls =
  'bg-hld-bg border border-hld-border focus:border-hld-cyan outline-none text-hld-text font-mono text-[11px] px-2 py-1.5';

/** The 4-way role picker: how the engine will treat this source. */
export function RolePicker({ role, onPick }: { role: SourceRole; onPick: (r: SourceRole) => void }) {
  return (
    <div className="flex gap-1">
      {SOURCE_ROLES.map((r) => {
        const on = r === role;
        return (
          <button
            key={r}
            type="button"
            onClick={() => onPick(r)}
            title={sourceRoleMeta[r].hint}
            className={`flex-1 flex items-center justify-center gap-1 px-1.5 py-1 border font-mono text-[8.5px] uppercase tracking-[0.08em] transition-all ${
              on
                ? 'border-hld-cyan/55 bg-hld-cyan/10 text-hld-cyan'
                : 'border-hld-border text-hld-muted-text hover:text-hld-text'
            }`}
          >
            <span className="text-[10px]">{sourceRoleMeta[r].glyph}</span>
            {sourceRoleMeta[r].label}
          </button>
        );
      })}
    </div>
  );
}

/** Inline paste form for a new source (role + label + body). */
export function AddSourceForm({
  onAdd,
  onCancel,
}: {
  onAdd: (label: string, content: string, role: SourceRole) => void;
  onCancel: () => void;
}) {
  const [role, setRole] = useState<SourceRole>(DEFAULT_SOURCE_ROLE);
  const [label, setLabel] = useState('');
  const [content, setContent] = useState('');
  return (
    <div className="flex flex-col gap-1.5 border border-hld-border bg-hld-bg p-2">
      <RolePicker role={role} onPick={setRole} />
      <div className="font-mono text-[8.5px] text-hld-muted-text leading-[1.4]">{sourceRoleMeta[role].hint}</div>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder={role === 'reference' ? 'Label (e.g. Dewey 1922)' : 'Label (e.g. Advisor notes)'}
        className={inputCls}
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={4}
        placeholder="Paste the source text the engine may draw on…"
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
          onClick={() => onAdd(label, content, role)}
          disabled={!content.trim()}
          className="px-2.5 py-1 border border-hld-cyan/40 text-hld-cyan hover:bg-hld-cyan/10 disabled:opacity-35 disabled:cursor-not-allowed font-mono text-[9px] uppercase tracking-[0.12em]"
        >
          Add
        </button>
      </div>
    </div>
  );
}
