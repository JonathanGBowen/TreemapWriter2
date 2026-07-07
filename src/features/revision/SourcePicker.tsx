import { useRef, useState } from 'react';
import { Library, Plus, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { useStore } from '../../state';
import { makeSourceId } from '../../state/document-state';
import { parseCslJson, referenceToSourceContent } from '../../lib/bibImport';
import { SOURCE_ACCEPT, extractSourceText } from '../../lib/docExtract';
import {
  DEFAULT_SOURCE_ROLE,
  SOURCE_ROLES,
  roleGlyph,
  roleLabel,
  sourceRoleMeta,
} from '../../lib/source-roles';
import type { SourceRole } from '../../types';
import { Pip } from '../shared/Pip';

const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
/** ~4 chars per token; warn when one source alone eats a big chunk of any window. */
const LARGE_SOURCE_CHARS = 120_000;

/** Take the single picked file (if any) and reset the input so re-picking re-fires. */
function takePickedFile(e: React.ChangeEvent<HTMLInputElement>): File | null {
  const file = e.target.files?.[0] ?? null;
  e.target.value = '';
  return file;
}
const inputCls =
  'bg-hld-bg border border-hld-border focus:border-hld-cyan outline-none text-hld-text font-mono text-[11px] px-2 py-1.5';

/** The 4-way role picker: how the engine will treat this source. */
function RolePicker({ role, onPick }: { role: SourceRole; onPick: (r: SourceRole) => void }) {
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

/** Inline paste form for a new ephemeral source (role + label + body). */
function AddSourceForm({
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

/**
 * Ephemeral (session-only) source materials. The writer pastes / uploads reference
 * works, advisor notes, reviewer reports, or a bibliography here; sources are not
 * persisted. Each source carries a typed ROLE (see lib/source-roles) that drives how
 * the engine treats it — a reference work is integrated with a citation, guidance is
 * applied, a bibliography supplies citation metadata, a voice sample is matched. Each
 * chip toggles selection; the engine uses only selected sources.
 */
export function SourcePicker() {
  const sources = useStore((s) => s.sources);
  const selectedIds = useStore((s) => s.selectedSourceIds);
  const toggleSource = useStore((s) => s.toggleRevisionSource);
  const addSource = useStore((s) => s.addSource);
  const removeSource = useStore((s) => s.removeSource);
  const selectSource = useStore((s) => s.selectSource);
  const deselectSource = useStore((s) => s.deselectSource);
  const [adding, setAdding] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bibRef = useRef<HTMLInputElement>(null);

  // Add a source with an explicit role + optional upload metadata; `kind` is the
  // human display label from the role, `glyph` is the role's glyph (role-coded
  // chips). A freshly added source is selected by default — it's why you added it.
  const add = (
    label: string,
    content: string,
    role: SourceRole,
    meta?: { origin?: 'paste' | 'upload' | 'bibliography'; fileName?: string; mime?: string },
  ) => {
    if (!content.trim()) return;
    const id = makeSourceId();
    addSource({
      id,
      role,
      kind: roleLabel(role),
      label: label.trim() || `Pasted ${roleLabel(role).toLowerCase()}`,
      glyph: roleGlyph(role),
      content: content.trim(),
      origin: meta?.origin ?? 'paste',
      fileName: meta?.fileName,
      mime: meta?.mime,
      addedAt: Date.now(),
    });
    selectSource(id);
  };

  // Sources are persisted domain data, but adding one is a plain state mutation — so,
  // like structural-part discovery, we write through explicitly (best-effort; the save
  // guardrail surfaces a real failure via the banner/toast).
  const persist = () => {
    void useStore.getState().saveCurrentState();
  };

  const submit = (label: string, content: string, role: SourceRole) => {
    add(label, content, role);
    persist();
    setAdding(false);
  };

  const remove = (id: string) => {
    removeSource(id);
    deselectSource(id);
    persist();
  };

  // Upload a PDF / DOCX / text file as a REFERENCE work: extract its text client-side
  // (pdfjs / mammoth for binaries, dynamically imported), show progress on the global
  // activity pill + a stable-id toast, then add it as a persisted source. An uploaded
  // document is almost always a work to draw on and cite.
  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = takePickedFile(e);
    if (!file) return;
    const label = file.name.replace(/\.(pdf|docx|md|markdown|txt)$/i, '');
    const toastId = `extract-${file.name}`;
    const { beginOp, endOp } = useStore.getState();
    const opId = beginOp({ label: `Extracting ${file.name}…`, workspace: 'revision' });
    toast.loading(`Extracting text from ${file.name}…`, { id: toastId });
    try {
      const text = await extractSourceText(file);
      add(label, text, 'reference', { origin: 'upload', fileName: file.name, mime: file.type });
      persist();
      toast.success(`Added ${file.name} (${wordCount(text).toLocaleString()} words)`, { id: toastId });
      if (text.length > LARGE_SOURCE_CHARS) {
        toast.warning(
          `${file.name} is large (~${Math.round(text.length / 4000)}k tokens). It may exceed a small model's context window when selected.`,
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Could not read ${file.name}.`, { id: toastId });
    } finally {
      endOp(opId);
    }
  };

  // Import a Zotero CSL-JSON export as BIBLIOGRAPHIC sources: one chip per reference,
  // its content an APA entry (+ abstract) the engine can cite and use to build an
  // accurate References section. The parse is pure (lib/bibImport); a malformed file
  // simply yields no chips.
  const onImportBib = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = takePickedFile(e);
    if (!file) return;
    const refs = parseCslJson(await file.text());
    if (!refs.length) {
      toast.error('No references found in that file (expected a Zotero CSL-JSON export).');
      return;
    }
    for (const ref of refs) {
      add(`${ref.labelStem} (${ref.year})`, referenceToSourceContent(ref), 'bibliographic', {
        origin: 'bibliography',
        fileName: file.name,
      });
    }
    persist();
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
              title={`${roleLabel(s.role)} — ${sourceRoleMeta[s.role].hint}\n\n${s.content.slice(0, 200)}`}
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
              <span className="text-[8px] uppercase tracking-[0.1em] opacity-70 border-l border-hld-border pl-1.5">
                {s.origin === 'upload' && s.fileName ? s.fileName.split('.').pop()?.toUpperCase() : roleLabel(s.role)}
              </span>
              <span className="text-[8px] opacity-55">{wordCount(s.content)}</span>
              <Pip status={on ? 'cyan' : 'idle'} size="sm" />
              <button
                type="button"
                aria-label="Remove source"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(s.id);
                }}
                className="opacity-0 group-hover:opacity-100 text-hld-muted-text hover:text-hld-magenta transition-opacity"
              >
                <X size={10} />
              </button>
            </div>
          );
        })}
        {!adding && (
          <>
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex items-center gap-1 px-2 py-1.5 border border-dashed border-hld-border text-hld-muted-text hover:text-hld-cyan hover:border-hld-cyan/40 font-mono text-[9.5px] uppercase tracking-[0.08em] transition-colors"
            >
              <Plus size={10} /> Add source
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              title="Upload a PDF, DOCX, or text/markdown file as a reference work — its text is extracted and saved with the project"
              className="flex items-center gap-1 px-2 py-1.5 border border-dashed border-hld-border text-hld-muted-text hover:text-hld-cyan hover:border-hld-cyan/40 font-mono text-[9.5px] uppercase tracking-[0.08em] transition-colors"
            >
              <Upload size={10} /> Upload file
            </button>
            <input
              ref={fileRef}
              type="file"
              accept={SOURCE_ACCEPT}
              className="hidden"
              onChange={onUpload}
            />
            <button
              type="button"
              onClick={() => bibRef.current?.click()}
              title="Import a Zotero CSL-JSON export as bibliographic sources"
              className="flex items-center gap-1 px-2 py-1.5 border border-dashed border-hld-border text-hld-muted-text hover:text-hld-cyan hover:border-hld-cyan/40 font-mono text-[9.5px] uppercase tracking-[0.08em] transition-colors"
            >
              <Library size={10} /> Import bibliography
            </button>
            <input
              ref={bibRef}
              type="file"
              accept=".json,.csljson"
              className="hidden"
              onChange={onImportBib}
            />
          </>
        )}
      </div>

      {adding && <AddSourceForm onAdd={submit} onCancel={() => setAdding(false)} />}
    </div>
  );
}
