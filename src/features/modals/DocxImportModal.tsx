// .docx import target chooser.
//
// After a Word document is converted to markdown (App.handleImportDocx), this
// asks where it should land: into the current project (overwrites, like the
// Markdown import) or as a brand-new project. Self-mounting and flag-gated like
// the other modals; the converted payload lives in ui-state (`docxImport`).

import React, { useState } from 'react';
import { X, FileText, Loader2, AlertCircle } from 'lucide-react';
import { useStore } from '../../store';

interface DocxImportModalProps {
  /** Import the converted markdown into the current project (overwrites). */
  onIntoCurrent: (markdown: string) => void;
  /** Create a new project from the converted markdown. */
  onAsNew: (markdown: string, fileName: string) => Promise<boolean>;
}

export const DocxImportModal: React.FC<DocxImportModalProps> = ({ onIntoCurrent, onAsNew }) => {
  const isOpen = useStore((s) => s.showDocxImportModal);
  const docxImport = useStore((s) => s.docxImport);
  const setShow = useStore((s) => s.setShowDocxImportModal);
  const setDocxImport = useStore((s) => s.setDocxImport);
  const [busy, setBusy] = useState(false);

  if (!isOpen || !docxImport) return null;

  const dismiss = () => {
    setShow(false);
    setDocxImport(null);
  };

  const intoCurrent = () => {
    const md = docxImport.markdown;
    dismiss();
    onIntoCurrent(md); // handleImportMarkdown shows its own overwrite confirm
  };

  const asNew = async () => {
    setBusy(true);
    try {
      await onAsNew(docxImport.markdown, docxImport.fileName);
    } finally {
      setBusy(false);
      dismiss();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-auto">
      <div className="absolute inset-0 bg-[#000000]/60 backdrop-blur-sm" onClick={busy ? undefined : dismiss} />

      <div className="relative w-[520px] flex flex-col bg-hld-bg border border-hld-border shadow-[0_0_40px_rgba(0,232,245,0.1)] overflow-hidden font-sans pointer-events-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-[12px_16px] bg-hld-surface border-b border-hld-border">
          <div className="flex items-center gap-[10px]">
            <FileText className="text-hld-cyan" size={16} />
            <h2 className="text-[12px] font-bold text-hld-text font-mono uppercase tracking-[0.1em]">
              Import Word document
            </h2>
          </div>
          <button
            onClick={dismiss}
            disabled={busy}
            className="text-hld-muted hover:text-hld-magenta transition-colors disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-4">
          <p className="text-[12px] text-hld-muted leading-relaxed">
            Converted <span className="font-mono text-hld-cyan break-all">{docxImport.fileName}</span>. Where should it go?
          </p>

          <div className="bg-hld-surface border border-hld-border/60 p-3 flex gap-2 items-start">
            <AlertCircle className="w-4 h-4 text-hld-muted shrink-0 mt-0.5" />
            <div className="text-[11px] text-hld-muted leading-relaxed">
              Headings, lists, tables, bold/italic and links carry over. Tracked changes,
              comments, citation fields and equations may be lost or flattened.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t flex justify-end gap-2 border-hld-border bg-hld-surface">
          <button
            onClick={dismiss}
            disabled={busy}
            className="px-4 py-2 bg-transparent border border-hld-border text-hld-text text-[11px] font-mono uppercase tracking-[0.1em] hover:bg-hld-surface2 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={intoCurrent}
            disabled={busy}
            className="px-4 py-2 bg-transparent border border-hld-cyan/60 text-hld-cyan text-[11px] font-mono uppercase tracking-[0.1em] hover:bg-hld-cyan/10 transition-colors disabled:opacity-50"
          >
            Into current project
          </button>
          <button
            onClick={asNew}
            disabled={busy}
            className="px-4 py-2 bg-hld-cyan text-hld-bg text-[11px] font-mono uppercase tracking-[0.1em] hover:bg-hld-cyan/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : null}
            As new project
          </button>
        </div>
      </div>
    </div>
  );
};
