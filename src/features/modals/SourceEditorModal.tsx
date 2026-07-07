import { useEffect, useRef } from 'react';
import { useStore } from '../../state';
import { ModalShell } from './ModalShell';
import { RolePicker } from '../revision/RolePicker';
import { sourceRoleMeta } from '../../lib/source-roles';
import { countWords } from '../../lib/utils';

const inputCls =
  'w-full bg-hld-bg border border-hld-border focus:border-hld-cyan outline-none text-hld-text font-mono text-[12px] px-2.5 py-2';

const ORIGIN_LABEL: Record<string, string> = {
  paste: 'pasted',
  upload: 'uploaded',
  bibliography: 'bibliography import',
  zotero: 'Zotero import',
};

/**
 * Edit one source document: role (recomputes the derived kind/glyph), label, and
 * the source text itself — so a mis-ingested source (e.g. rough draft notes
 * uploaded as a reference work) can be reclassified or corrected in place.
 * Auto-saves on every keystroke (undoable, not confirmable); the disk write is
 * debounced and flushed on close. Content edits mark an existing exegesis stale
 * (never delete it) — the exegesis zone itself lives below the source fields.
 */
export function SourceEditorModal() {
  const open = useStore((s) => s.showSourceEditorModal);
  const sourceId = useStore((s) => s.editingSourceId);
  const source = useStore((s) => s.sources.find((x) => x.id === sourceId));
  const updateSource = useStore((s) => s.updateSource);
  const setShow = useStore((s) => s.setShowSourceEditorModal);

  // Debounced write-through: state mutations are instant; the disk save waits for
  // a pause in typing and is flushed on close/unmount so nothing is lost.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  const scheduleSave = () => {
    dirty.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      dirty.current = false;
      void useStore.getState().saveCurrentState();
    }, 800);
  };
  const flushSave = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (dirty.current) {
      dirty.current = false;
      void useStore.getState().saveCurrentState();
    }
  };
  useEffect(() => flushSave, []);

  if (!open || !source) return null;

  const patch = (p: Parameters<typeof updateSource>[1]) => {
    updateSource(source.id, p);
    scheduleSave();
  };
  const close = () => {
    flushSave();
    setShow(false);
  };

  return (
    <ModalShell
      eyebrow="Glass Box"
      title="Edit source"
      onClose={close}
      onPrimary={close}
      primaryLabel="Done"
      widthClass="max-w-2xl"
    >
      <div className="flex flex-col gap-2.5">
        <RolePicker role={source.role} onPick={(r) => patch({ role: r })} />
        <div className="font-mono text-[8.5px] text-hld-muted-text leading-[1.4]">
          {sourceRoleMeta[source.role].hint}
        </div>
        <input
          value={source.label}
          onChange={(e) => patch({ label: e.target.value })}
          placeholder="Source label"
          className={inputCls}
        />
        <textarea
          value={source.content}
          onChange={(e) => patch({ content: e.target.value })}
          rows={14}
          placeholder="The source text the engine may draw on…"
          className={`${inputCls} resize-none leading-[1.5]`}
        />
        <div className="font-mono text-[8.5px] text-hld-muted uppercase tracking-[0.08em]">
          {[
            ORIGIN_LABEL[source.origin ?? 'paste'],
            source.fileName,
            `${countWords(source.content).toLocaleString()} words`,
            source.addedAt ? `added ${new Date(source.addedAt).toLocaleDateString()}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </div>
      </div>
    </ModalShell>
  );
}
