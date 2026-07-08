import { useCallback } from 'react';
import { toast } from 'sonner';
import { useStore } from '../../state';
import { makeSourceId } from '../../state/document-state';
import {
  getAttachmentFile,
  getIndexedFulltext,
  getItemChildren,
} from '../../services/zotero';
import { referenceToSourceContent } from '../../lib/bibImport';
import { LARGE_SOURCE_CHARS, extractDocx, extractPdf } from '../../lib/docExtract';
import {
  itemLabel,
  itemToReference,
  mergeZoteroImports,
  pickBestAttachment,
  type IncomingZoteroSource,
  type ZoteroApiItem,
} from '../../lib/zoteroImport';
import { roleGlyph, roleLabel } from '../../lib/source-roles';

const errMessage = (e: unknown) => (e instanceof Error ? e.message : 'request failed');

/** Per-item progress signal for the picker's pip row. */
export type ZoteroItemProgress = (
  key: string,
  status: 'working' | 'done' | 'failed',
  note?: string,
) => void;

/**
 * Apply an import batch to the store: dedupe by zoteroKey+role (re-import
 * refreshes the existing source in place — which marks its exegesis stale —
 * instead of duplicating), mint ids for the fresh ones, select them, persist
 * once, and summarize.
 */
function applyIncoming(incoming: IncomingZoteroSource[]): { added: number; updated: number } {
  const st = useStore.getState();
  const { adds, updates } = mergeZoteroImports(st.sources, incoming);
  for (const u of updates) st.updateSource(u.id, { label: u.label, content: u.content });
  for (const a of adds) {
    const id = makeSourceId();
    st.addSource({
      id,
      role: a.role,
      kind: roleLabel(a.role),
      label: a.label,
      glyph: roleGlyph(a.role),
      content: a.content,
      origin: 'zotero',
      fileName: a.fileName,
      mime: a.mime,
      addedAt: Date.now(),
      zoteroKey: a.zoteroKey,
    });
    st.selectSource(id);
  }
  if (adds.length || updates.length) void useStore.getState().saveCurrentState();
  return { added: adds.length, updated: updates.length };
}

const summarize = (added: number, updated: number, failed: number) => {
  const parts = [
    added ? `${added} imported` : '',
    updated ? `${updated} updated` : '',
    failed ? `${failed} failed` : '',
  ].filter(Boolean);
  const msg = parts.length ? parts.join(' · ') : 'Nothing to import.';
  if (failed && !added && !updated) toast.error(msg);
  else toast.success(msg);
};

/**
 * The two import actions behind the Zotero picker. Bibliography import is
 * metadata-only (one `bibliographic` chip per item, the CSL-JSON file-import
 * shape); full-text import walks each item's attachments — Zotero's own
 * fulltext index first, then the raw file through the app's extractors — into
 * `reference` sources. Per-item failures never sink the batch.
 */
export const useZoteroImport = () => {
  const importBibliography = useCallback((items: ZoteroApiItem[]) => {
    const incoming: IncomingZoteroSource[] = [];
    let failed = 0;
    for (const item of items) {
      const ref = itemToReference(item);
      if (!ref) {
        failed += 1;
        continue;
      }
      incoming.push({
        zoteroKey: item.key,
        role: 'bibliographic',
        label: `${ref.labelStem} (${ref.year})`,
        content: referenceToSourceContent(ref),
      });
    }
    const { added, updated } = applyIncoming(incoming);
    summarize(added, updated, failed);
  }, []);

  const importFullText = useCallback(
    async (items: ZoteroApiItem[], onItem?: ZoteroItemProgress) => {
      const { beginOp, endOp } = useStore.getState();
      const opId = beginOp({ label: 'Importing from Zotero…', workspace: 'revision' });
      const incoming: IncomingZoteroSource[] = [];
      let failed = 0;
      try {
        for (const item of items) {
          onItem?.(item.key, 'working');
          try {
            const children = await getItemChildren(item.key);
            const att = pickBestAttachment(children);
            if (!att) throw new Error('no usable attachment');

            // Zotero's own index first — no parsing needed, works for any type
            // Zotero indexed (including HTML snapshots).
            let text = await getIndexedFulltext(att.key);
            let mime = att.contentType;
            if (!text) {
              if (att.contentType === 'text/html')
                throw new Error('snapshot not indexed by Zotero');
              const { buf, contentType } = await getAttachmentFile(att.key);
              const ct = contentType || att.contentType;
              mime = ct;
              if (ct.includes('pdf')) text = await extractPdf(buf);
              else if (ct.includes('wordprocessingml')) text = await extractDocx(buf);
              else if (ct.startsWith('text/')) text = new TextDecoder().decode(buf);
              else throw new Error(`unsupported attachment type (${ct || 'unknown'})`);
            }
            const clean = text.trim();
            if (!clean) throw new Error('no extractable text');

            incoming.push({
              zoteroKey: item.key,
              role: 'reference',
              label: itemLabel(item),
              content: clean,
              fileName: att.fileName,
              mime,
            });
            onItem?.(item.key, 'done');
            if (clean.length > LARGE_SOURCE_CHARS) {
              toast.warning(
                `${itemLabel(item)} is large (~${Math.round(clean.length / 4000)}k tokens). It may exceed a small model's context window when selected.`,
              );
            }
          } catch (e) {
            failed += 1;
            onItem?.(item.key, 'failed', errMessage(e));
          }
        }
        const { added, updated } = applyIncoming(incoming);
        summarize(added, updated, failed);
      } finally {
        endOp(opId);
      }
    },
    [],
  );

  return { importBibliography, importFullText };
};
