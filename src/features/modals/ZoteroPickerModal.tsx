// The live Zotero picker (desktop only): browse the local library over Zotero 7's
// local API, multi-select items, and import them as sources — metadata as
// bibliographic chips, attachment full text as reference works. Degrades to one
// quiet hint when Zotero isn't reachable; the file-import buttons remain the
// fallback (and the browser's only) path.

import { useEffect, useRef, useState } from 'react';
import { RotateCcw, Search } from 'lucide-react';
import { useStore } from '../../state';
import { ModalShell } from './ModalShell';
import { Pip, type PipStatus } from '../shared/Pip';
import { Spinner } from '../shared/Spinner';
import { listCollections, searchItems, zoteroAvailable, type ZoteroCollection } from '../../services/zotero';
import { itemDisplay, type ZoteroApiItem } from '../../lib/zoteroImport';
import { useZoteroImport } from '../revision/use-zotero-import';

type Phase = 'probing' | 'unavailable' | 'ready';
type ItemState = 'working' | 'done' | 'failed';

const ITEM_PIP: Record<ItemState, PipStatus> = { working: 'cyan', done: 'green', failed: 'magenta' };

export function ZoteroPickerModal() {
  const open = useStore((s) => s.showZoteroPickerModal);
  const setShow = useStore((s) => s.setShowZoteroPickerModal);

  const [phase, setPhase] = useState<Phase>('probing');
  const [collections, setCollections] = useState<ZoteroCollection[]>([]);
  const [collectionKey, setCollectionKey] = useState('');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<ZoteroApiItem[]>([]);
  const [listing, setListing] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<Map<string, { state: ItemState; note?: string }>>(
    new Map(),
  );
  const [importing, setImporting] = useState(false);
  const { importBibliography, importFullText } = useZoteroImport();
  // Stale-response guard for overlapping list requests.
  const listSeq = useRef(0);

  const probe = async () => {
    setPhase('probing');
    if (await zoteroAvailable()) {
      setPhase('ready');
      try {
        setCollections(await listCollections());
      } catch {
        setCollections([]);
      }
      void list(collectionKey, q);
    } else {
      setPhase('unavailable');
    }
  };

  const list = async (colKey: string, query: string) => {
    const seq = ++listSeq.current;
    setListing(true);
    setListError(null);
    try {
      const found = await searchItems({ collectionKey: colKey || undefined, q: query });
      if (seq !== listSeq.current) return;
      setItems(found);
    } catch (e) {
      if (seq !== listSeq.current) return;
      setItems([]);
      setListError(e instanceof Error ? e.message : 'Listing failed.');
    } finally {
      if (seq === listSeq.current) setListing(false);
    }
  };

  // Probe on each open; reset per-session pick state.
  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    setProgress(new Map());
    void probe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;
  const close = () => setShow(false);

  const toggle = (key: string) => {
    if (importing) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const picked = items.filter((i) => selected.has(i.key));

  const runBibliography = () => {
    importBibliography(picked);
    close();
  };

  const runFullText = async () => {
    setImporting(true);
    setProgress(new Map(picked.map((i) => [i.key, { state: 'working' as ItemState }])));
    try {
      await importFullText(picked, (key, state, note) => {
        setProgress((prev) => new Map(prev).set(key, { state, note }));
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <ModalShell
      eyebrow="Glass Box"
      title="Zotero library"
      sub="localhost:23119 · local API"
      onClose={close}
      footer={
        phase === 'ready' ? (
          <>
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-hld-muted-text">
              {selected.size} selected
            </span>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={runBibliography}
                disabled={!selected.size || importing}
                title="One bibliographic chip per item: an APA entry (+ abstract) the engine cites and builds References from"
                className="px-3 py-2 border border-hld-border text-hld-muted-text hover:text-hld-cyan hover:border-hld-cyan/40 disabled:opacity-35 disabled:cursor-not-allowed font-mono text-[9px] font-bold uppercase tracking-[0.12em] transition-colors"
              >
                ◎ Import metadata
              </button>
              <button
                type="button"
                onClick={() => void runFullText()}
                disabled={!selected.size || importing}
                title="Pull each item's attachment text (Zotero's own index first, then the file) as a reference work"
                className="px-3 py-2 border border-hld-cyan/40 text-hld-cyan hover:bg-hld-cyan/10 disabled:opacity-35 disabled:cursor-not-allowed font-mono text-[9px] font-bold uppercase tracking-[0.12em] transition-colors"
              >
                {importing ? 'Importing…' : '❡ Import full text'}
              </button>
            </div>
          </>
        ) : undefined
      }
      widthClass="max-w-2xl"
    >
      {phase === 'probing' && (
        <div className="flex items-center justify-center gap-2.5 py-10">
          <Spinner hue="cyan" size={14} />
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-hld-muted-text">
            reaching Zotero…
          </span>
        </div>
      )}

      {phase === 'unavailable' && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="font-mono text-[11px] leading-[1.6] text-hld-muted-text max-w-md">
            Zotero isn't reachable. Start Zotero 7 and enable "Allow other applications on this
            computer to communicate with Zotero" (Settings → Advanced). File import below still
            works.
          </div>
          <button
            type="button"
            onClick={() => void probe()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 border border-hld-border text-hld-muted-text hover:text-hld-cyan hover:border-hld-cyan/40 font-mono text-[9px] uppercase tracking-[0.12em] transition-colors"
          >
            <RotateCcw size={11} /> Retry
          </button>
        </div>
      )}

      {phase === 'ready' && (
        <div className="flex flex-col gap-2.5">
          <div className="flex gap-1.5">
            <select
              value={collectionKey}
              onChange={(e) => {
                setCollectionKey(e.target.value);
                void list(e.target.value, q);
              }}
              className="bg-hld-bg border border-hld-border focus:border-hld-cyan outline-none text-hld-text font-mono text-[10.5px] px-2 py-1.5 max-w-[45%]"
            >
              <option value="">All items</option>
              {collections.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) void list(collectionKey, q);
              }}
              placeholder="Search title · creator · year, then Enter…"
              className="flex-1 min-w-0 bg-hld-bg border border-hld-border focus:border-hld-cyan outline-none text-hld-text font-mono text-[10.5px] px-2 py-1.5"
            />
            <button
              type="button"
              onClick={() => void list(collectionKey, q)}
              title="Search"
              className="w-[30px] flex items-center justify-center border border-hld-border text-hld-muted-text hover:text-hld-cyan hover:border-hld-cyan transition-all shrink-0"
            >
              <Search size={12} />
            </button>
          </div>

          {listError && (
            <div className="text-[10.5px] text-hld-yellow bg-hld-yellow/10 border border-hld-yellow/30 px-2.5 py-1.5 font-mono">
              {listError}
            </div>
          )}

          <div className="flex flex-col max-h-[46vh] overflow-y-auto border border-hld-border divide-y divide-hld-border">
            {listing ? (
              <div className="flex items-center justify-center gap-2.5 py-8">
                <Spinner hue="cyan" size={12} />
              </div>
            ) : items.length === 0 ? (
              <div className="py-8 text-center font-mono text-[9px] uppercase tracking-[0.14em] text-hld-muted">
                no items
              </div>
            ) : (
              items.map((item) => {
                const on = selected.has(item.key);
                const d = itemDisplay(item);
                const p = progress.get(item.key);
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => toggle(item.key)}
                    aria-pressed={on}
                    title={p?.note}
                    className={`flex items-center gap-2 px-2.5 py-2 text-left transition-colors ${
                      on ? 'bg-hld-cyan/[0.07]' : 'hover:bg-hld-surface-2'
                    }`}
                  >
                    <Pip
                      status={p ? ITEM_PIP[p.state] : on ? 'cyan' : 'idle'}
                      size="sm"
                      live={p?.state === 'working'}
                      pulse={p?.state === 'working'}
                    />
                    <span
                      className={`flex-1 min-w-0 truncate font-mono text-[11px] ${
                        on ? 'text-hld-text' : 'text-hld-muted-text'
                      }`}
                    >
                      {d.title}
                    </span>
                    <span className="shrink-0 font-mono text-[8.5px] uppercase tracking-[0.08em] text-hld-muted">
                      {[d.stem, d.year].filter(Boolean).join(' · ')}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </ModalShell>
  );
}
