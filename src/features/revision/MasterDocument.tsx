import { useEffect, useMemo, useRef } from 'react';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { GFM, Table } from '@lezer/markdown';
import { EditorView } from '@codemirror/view';
import { hldExtensions, hldTheme } from '../../lib/editorTheme';
import { findProposalOffset } from '../../lib/revision-helpers';
import { useStore } from '../../state';
import { useCurrentSection } from '../tests-panel/use-current-section';
import {
  revisionPreviewExtensions,
  setPreviewEffect,
  type PreviewPayload,
} from './revision-preview';

/**
 * The selected section as a read-only "master document". Proposed edits preview
 * in place via CodeMirror decorations (revision-preview.ts) — they never mutate
 * the text; only Accept (which rewrites localContent) does. The doc re-derives
 * from the section's fullContent, so an accepted edit shows as applied (green)
 * once the draft updates.
 */
export function MasterDocument() {
  const current = useCurrentSection();
  const proposals = useStore((s) => s.proposals);
  const previewIds = useStore((s) => s.previewIds);
  const previewAll = useStore((s) => s.previewAll);
  const activeId = useStore((s) => s.activeProposalId);
  const togglePreview = useStore((s) => s.toggleProposalPreview);
  const setActive = useStore((s) => s.setActiveProposal);

  const cmRef = useRef<ReactCodeMirrorRef>(null);
  const value = current?.fullContent ?? '';

  const payload: PreviewPayload = useMemo(
    () => ({
      proposals: proposals.map((p) => ({
        id: p.id,
        original_text: p.original_text,
        proposed_text: p.proposed_text,
        status: p._status,
        previewing: p._status === 'pending' && (previewAll || previewIds.includes(p.id)),
        active: p.id === activeId,
      })),
      onToggle: (id: string) => {
        togglePreview(id);
        setActive(id);
      },
    }),
    [proposals, previewIds, previewAll, activeId, togglePreview, setActive],
  );

  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  useEffect(() => {
    cmRef.current?.view?.dispatch({ effects: setPreviewEffect.of(payload) });
  }, [payload]);

  // Scroll the active proposal's insertion point into view. Both entry points —
  // clicking a proposal card and clicking a highlighted span — funnel through
  // `activeProposalId`, so one effect covers both. Keyed on the active id (plus
  // the doc/proposals it reads) so it recenters on selection, not on every render.
  useEffect(() => {
    const view = cmRef.current?.view;
    if (!view || !activeId) return;
    const p = proposals.find((x) => x.id === activeId);
    if (!p) return;
    // A previewed/accepted edit may have replaced the original span; target the
    // text actually present in the doc.
    const target = p._status === 'accepted' ? p.proposed_text : p.original_text;
    const pos = findProposalOffset(value, target);
    if (pos < 0) return;
    view.dispatch({ effects: EditorView.scrollIntoView(pos, { y: 'center' }) });
  }, [activeId, proposals, value]);

  const extensions = useMemo(
    () => [
      markdown({
        base: markdownLanguage,
        codeLanguages: languages,
        addKeymap: false,
        extensions: [Table, GFM],
      }),
      ...hldExtensions,
      EditorView.lineWrapping,
      ...revisionPreviewExtensions,
    ],
    [],
  );

  if (!current) {
    return (
      <div className="flex-1 flex items-center justify-center text-hld-muted-text font-mono text-[11px] uppercase tracking-[0.14em]">
        — select a section in the rail to revise —
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0 overflow-y-auto bg-hld-bg">
      <div className="max-w-[760px] mx-auto px-10 py-8">
        <div className="font-mono uppercase tracking-[0.14em] text-[9px] text-hld-muted text-center mb-6">
          — master document · click any highlighted span to preview the edit —
        </div>
        <CodeMirror
          ref={cmRef}
          value={value}
          theme={hldTheme}
          extensions={extensions}
          basicSetup={false}
          editable={false}
          onCreateEditor={(view) =>
            view.dispatch({ effects: setPreviewEffect.of(payloadRef.current) })
          }
        />
      </div>
    </div>
  );
}
