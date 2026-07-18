import { useEffect, useRef } from 'react';
import { useStore } from '../../../state';
import { ModalShell } from '../shared/ModalShell';
import { RolePicker } from '../../revision/RolePicker';
import { useSourceExegesis } from '../../revision/use-source-exegesis';
import { sourceRoleMeta } from '../../../lib/source-roles';
import { isExegesisStale } from '../../../lib/source-edit';
import { countWords } from '../../../lib/utils';
import type { SourceDocument } from '../../../types';

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

        <ExegesisZone source={source} />
      </div>
    </ModalShell>
  );
}

/**
 * The source's exegetical reconstruction: generate (streamed live), read, and
 * regenerate when the source text has drifted since it was reconstructed. Stale
 * is annotated, never auto-deleted — regenerating is the writer's call.
 */
function ExegesisZone({ source }: { source: SourceDocument }) {
  const { run, running, streaming } = useSourceExegesis();
  // In flight ANYWHERE — a run started before this modal was closed and reopened
  // is still this source's run; offering a second one would duplicate it.
  const inFlight = useStore((s) => s.exegesisRunning.includes(source.id));
  const stale = isExegesisStale(source);
  // Metadata only: an APA entry + abstract can't ground a faithful reconstruction.
  const metadataOnly = source.role === 'bibliographic';

  return (
    <div className="flex flex-col gap-2 border-t border-hld-border pt-3 mt-1">
      <div className="flex items-center justify-between">
        <div className="font-mono uppercase tracking-[0.14em] text-[9px] text-hld-muted-text">
          ◈ exegesis — the argument reconstructed
        </div>
        {!inFlight && !metadataOnly && (
          <button
            type="button"
            onClick={() => void run(source)}
            className="px-2 py-1 border border-hld-cyan/40 text-hld-cyan hover:bg-hld-cyan/10 font-mono text-[9px] uppercase tracking-[0.12em] transition-colors"
          >
            {source.exegesis ? '⟲ Reconstruct again' : '◈ Reconstruct'}
          </button>
        )}
      </div>

      {running ? (
        <div className="border border-hld-border bg-hld-bg px-2.5 py-2 max-h-64 overflow-y-auto font-mono text-[11px] leading-[1.6] text-hld-text whitespace-pre-wrap">
          {streaming || <span className="text-hld-muted-text">reading the source…</span>}
        </div>
      ) : inFlight ? (
        <div className="font-mono text-[8.5px] text-hld-muted-text uppercase tracking-[0.08em]">
          reconstructing — the result will appear here when it lands
        </div>
      ) : source.exegesis ? (
        <>
          <div className="border border-hld-border bg-hld-bg px-2.5 py-2 max-h-64 overflow-y-auto font-mono text-[11px] leading-[1.6] text-hld-text whitespace-pre-wrap">
            {source.exegesis.content}
          </div>
          <div
            className={`font-mono text-[8.5px] uppercase tracking-[0.08em] ${
              stale ? 'text-hld-muted-text-2' : 'text-hld-muted'
            }`}
          >
            {stale
              ? '⟲ source changed since reconstruction'
              : `reconstructed ${new Date(source.exegesis.createdAt).toLocaleDateString()}`}
          </div>
        </>
      ) : metadataOnly ? (
        <div className="font-mono text-[8.5px] text-hld-muted uppercase tracking-[0.08em]">
          metadata-only source — import the full text to reconstruct it
        </div>
      ) : (
        <div className="font-mono text-[8.5px] text-hld-muted uppercase tracking-[0.08em]">
          none yet — a faithful reconstruction of this source's moves, commitments, and terms
        </div>
      )}
    </div>
  );
}
