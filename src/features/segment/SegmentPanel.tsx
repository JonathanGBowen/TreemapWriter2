import { useStore } from '../../state';
import type { SegmentEdit } from '../../types';
import type { ProposedEdit } from '../../state/segment-state';
import { useSegmentActions } from './use-segment-actions';
import { Pip } from '../shared/Pip';
import { DisabledHint } from '../shared/DisabledHint';

const KIND_META: Record<SegmentEdit['kind'], { glyph: string; label: string }> = {
  insert: { glyph: '+', label: 'insert' },
  split: { glyph: '⊣', label: 'split' },
  retitle: { glyph: '✎', label: 'retitle' },
  relevel: { glyph: '↕', label: 'relevel' },
  merge: { glyph: '⊖', label: 'merge' },
};

const editTitle = (e: SegmentEdit): string => ('title' in e ? e.title : '');
const editLevel = (e: SegmentEdit): number | undefined => ('level' in e ? e.level : undefined);
const editSummary = (e: SegmentEdit): string | undefined => ('summary' in e ? e.summary : undefined);
const canRetitle = (k: SegmentEdit['kind']) => k === 'insert' || k === 'split' || k === 'retitle';

/** The completed-descent state: the new structure is in the document. */
function DoneState({ onClose, onContinue }: { onClose: () => void; onContinue: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 px-6">
      <span className="text-hld-cyan text-[28px]">⑂</span>
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-hld-text">All natural parts found</p>
      <p className="text-[12px] font-sans text-hld-muted-text-2 max-w-[38ch] leading-relaxed">
        The headings are in your document, cut at the joints. Hand the structure to the spec sweep, or close to return to writing.
      </p>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onContinue} className="hld-lit px-3 py-[9px] font-mono text-[10px] uppercase tracking-[0.12em]">
          Continue to specs ›
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-[9px] border border-hld-border text-hld-muted-text-2 hover:text-hld-cyan font-mono text-[10px] uppercase tracking-[0.12em]"
        >
          ‹ Done
        </button>
      </div>
    </div>
  );
}

/** Pre-generation: invite the author to find the seams at this level. */
function GeneratePrompt({ depth, onGenerate }: { depth: number; onGenerate: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 px-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-hld-cyan">
        {depth === 0 ? 'Find the top-level parts' : 'Divide each part further'}
      </p>
      <p className="text-[12px] font-sans text-hld-muted-text-2 max-w-[40ch] leading-relaxed">
        Find the natural joints at this level — only where they are clear. The count of parts falls out of where the joints are.
      </p>
      <button type="button" onClick={onGenerate} className="hld-lit px-3 py-[10px] font-mono text-[10px] uppercase tracking-[0.12em]">
        ▸ Articulate this level
      </button>
    </div>
  );
}

/** One reviewable proposed edit. Clicking the row toggles accept/reject. */
function EditRow({ depth, pe }: { depth: number; pe: ProposedEdit }) {
  const toggle = useStore((s) => s.toggleSegmentEdit);
  const setTitle = useStore((s) => s.setSegmentEditTitle);
  const { edit, status } = pe;
  const meta = KIND_META[edit.kind];
  const rejected = status === 'rejected';
  const lvl = editLevel(edit);
  const summary = editSummary(edit);

  return (
    <div className={`border border-hld-border px-[12px] py-[10px] flex flex-col gap-[6px] ${rejected ? 'opacity-40' : ''}`}>
      <div className="flex items-center gap-[8px]">
        <button
          type="button"
          onClick={() => toggle(depth, pe.id)}
          aria-label={rejected ? 'Include this edit' : 'Reject this edit'}
          className={`w-[18px] h-[18px] shrink-0 border flex items-center justify-center text-[11px] leading-none ${
            rejected ? 'border-hld-border text-hld-muted-text' : 'border-hld-cyan/50 text-hld-cyan bg-hld-cyan/10'
          }`}
        >
          {rejected ? '' : '✓'}
        </button>
        <span className="font-mono text-[12px] w-[16px] text-center text-hld-muted-text-2 shrink-0" title={meta.label}>
          {meta.glyph}
        </span>
        <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-hld-muted-text shrink-0">
          {meta.label}
          {typeof lvl === 'number' ? ` · H${lvl}` : ''}
        </span>
        <span className="ml-auto font-mono text-[8px] tracking-[0.1em] text-hld-muted-text shrink-0">
          {Math.round((edit.confidence ?? 0) * 100)}%
        </span>
      </div>

      {canRetitle(edit.kind) ? (
        <input
          value={editTitle(edit)}
          onChange={(e) => setTitle(depth, pe.id, e.target.value)}
          className="w-full px-[8px] py-[5px] text-[13px] font-sans border border-hld-border bg-hld-surface-3 text-hld-text outline-none focus:border-hld-cyan"
          placeholder="Heading title"
        />
      ) : (
        <div className="text-[12px] font-mono text-hld-muted-text-2 truncate" title={edit.anchor}>
          {edit.anchor}
        </div>
      )}

      {edit.kind === 'retitle' && (
        <div className="text-[10px] font-mono text-hld-muted-text truncate" title={edit.anchor}>
          was: {edit.anchor}
        </div>
      )}
      {summary && <div className="text-[12px] font-sans italic text-hld-muted-text-2 leading-relaxed">{summary}</div>}
      {edit.rationale && (
        <div className="text-[11px] font-sans text-hld-muted-text leading-relaxed">{edit.rationale}</div>
      )}
    </div>
  );
}

/** The center of the workspace: the current level's proposed edits + accept. */
export function SegmentPanel() {
  const cursor = useStore((s) => s.segmentCursor);
  const levels = useStore((s) => s.segmentLevels);
  const segmentDone = useStore((s) => s.segmentDone);
  const baseLevel = useStore((s) => s.baseLevel);
  const setAll = useStore((s) => s.setSegmentLevelEditStatus);
  const closeSegment = useStore((s) => s.closeSegment);
  const { generateLevel, acceptLevel, continueToSpecs } = useSegmentActions();

  if (segmentDone) return <DoneState onClose={closeSegment} onContinue={continueToSpecs} />;

  const level = levels[cursor];
  const targetLevel = level?.targetLevel ?? baseLevel + cursor;

  if (!level || level.status === 'idle') {
    return (
      <div className="flex-1 min-h-0 flex flex-col">
        <GeneratePrompt depth={cursor} onGenerate={() => void generateLevel(cursor)} />
      </div>
    );
  }

  if (level.status === 'generating') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <Pip status="cyan" pulse />
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-hld-muted-text">Finding the joints…</p>
      </div>
    );
  }

  if (level.status === 'error') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
        <Pip status="magenta" />
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-hld-magenta">Articulation failed</p>
        <button type="button" onClick={() => void generateLevel(cursor)} className="hld-lit px-3 py-[9px] font-mono text-[10px] uppercase tracking-[0.12em]">
          ↻ Try again
        </button>
      </div>
    );
  }

  if (level.status === 'empty') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
        <span className="text-hld-cyan text-[22px]">◎</span>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-hld-text">Already a whole here</p>
        <p className="text-[12px] font-sans text-hld-muted-text-2 max-w-[36ch] leading-relaxed">
          No clear seam at this level — dividing further would make shards, not parts.
        </p>
        <button type="button" onClick={() => void acceptLevel(cursor)} className="hld-lit px-3 py-[9px] font-mono text-[10px] uppercase tracking-[0.12em]">
          Continue ›
        </button>
      </div>
    );
  }

  // proposed
  const accepted = level.edits.filter((e) => e.status === 'accepted').length;
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-[18px] py-[11px] border-b border-hld-border shrink-0 flex items-center justify-between gap-3">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-hld-cyan">
            Level {targetLevel} · proposed
          </div>
          <div className="text-[12px] font-sans text-hld-muted-text-2 mt-[2px]">
            {accepted} of {level.edits.length} edits will apply · {level.spanCount}{' '}
            {level.spanCount === 1 ? 'part examined' : 'parts examined'}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" onClick={() => setAll(cursor, 'accepted')} className="px-2 py-1 border border-hld-border text-hld-muted-text-2 hover:text-hld-cyan font-mono text-[9px] uppercase tracking-[0.1em]">
            All
          </button>
          <button type="button" onClick={() => setAll(cursor, 'rejected')} className="px-2 py-1 border border-hld-border text-hld-muted-text-2 hover:text-hld-cyan font-mono text-[9px] uppercase tracking-[0.1em]">
            None
          </button>
          <DisabledHint when={level.edits.length === 0} hint="Nothing proposed for this level.">
            <button
              type="button"
              onClick={() => void acceptLevel(cursor)}
              className="hld-lit px-3 py-[7px] font-mono text-[10px] uppercase tracking-[0.12em]"
            >
              Accept &amp; continue ›
            </button>
          </DisabledHint>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-[18px] py-[14px] flex flex-col gap-[10px]">
        {level.edits.map((pe) => (
          <EditRow key={pe.id} depth={cursor} pe={pe} />
        ))}
      </div>
    </div>
  );
}
