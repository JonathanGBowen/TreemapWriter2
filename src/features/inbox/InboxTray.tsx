// The capture-inbox tray (Arpeggio Phase 3): parked thoughts, each routed to its
// home — appended to a section's prose, or promoted to a germ W₁ part (a node that
// exists pre-prose). A right-side drawer, self-gating on `inboxOpen`. Consuming an
// item removes it (the inbox stays a to-route queue, never an archive).

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useStore } from '../../state';
import { useStructuralPartsActions } from '../structure/use-structural-parts-actions';
import type { InboxItem, Section } from '../../types';

interface FlatSection {
  id: string;
  label: string;
}

function flattenSections(sections: Section[]): { flat: FlatSection[]; contentById: Map<string, string> } {
  const flat: FlatSection[] = [];
  const contentById = new Map<string, string>();
  const walk = (nodes: Section[]) =>
    nodes.forEach((n) => {
      flat.push({ id: n.id, label: `${'  '.repeat(Math.max(0, n.level - 1))}${n.title}` });
      contentById.set(n.id, n.content);
      walk(n.children);
    });
  walk(sections);
  return { flat, contentById };
}

/** One inbox item with its two destination actions + discard. */
function InboxRow({
  item,
  flat,
  onAppend,
  onPromote,
  onDiscard,
}: {
  item: InboxItem;
  flat: FlatSection[];
  onAppend: (id: string) => void;
  onPromote: () => void;
  onDiscard: () => void;
}) {
  const [target, setTarget] = useState('');
  return (
    <li className="border-b border-hld-border/50 px-[14px] py-[10px]">
      <div className="flex items-start gap-[8px]">
        <p
          draggable
          onDragStart={(e) => {
            // Drag a parked thought straight onto the W₁ canvas → a germ node at the
            // drop (the canvas reads both, mints the part, and consumes the item).
            e.dataTransfer.setData('text/plain', item.text);
            e.dataTransfer.setData('application/x-inbox-id', item.id);
            e.dataTransfer.effectAllowed = 'copy';
          }}
          title="Drag onto the canvas to make a germ node"
          className="flex-1 text-[12px] leading-snug text-hld-text whitespace-pre-wrap break-words cursor-grab active:cursor-grabbing"
        >
          {item.text}
        </p>
        <button
          type="button"
          onClick={onDiscard}
          aria-label="Discard this captured thought"
          title="Discard"
          className="text-hld-muted hover:text-hld-magenta shrink-0 mt-[1px] transition-colors"
        >
          <X size={11} />
        </button>
      </div>
      <div className="mt-[6px] flex items-center gap-[6px] flex-wrap">
        <button
          type="button"
          onClick={onPromote}
          title="Promote to a germ W₁ part (a node that exists before its prose)"
          className="font-mono text-[8px] tracking-[0.1em] uppercase text-hld-muted hover:text-hld-purple transition-colors"
        >
          → germ part
        </button>
        <span className="text-hld-border">·</span>
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          title="Append this thought to a section's prose"
          className="bg-hld-bg border border-hld-border text-hld-text font-mono text-[8px] tracking-[0.04em] px-[4px] py-[1px] max-w-[150px]"
        >
          <option value="">— to section —</option>
          {flat.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        <button
          type="button"
          disabled={!target}
          onClick={() => target && onAppend(target)}
          title="Append to the chosen section"
          className={`font-mono text-[8px] tracking-[0.1em] uppercase transition-colors ${target ? 'text-hld-muted hover:text-hld-cyan' : 'text-hld-muted/40'}`}
        >
          append
        </button>
      </div>
    </li>
  );
}

export function InboxTray({ onSaveContent }: { onSaveContent: (sectionId: string, newContent: string) => void }) {
  const open = useStore((s) => s.inboxOpen);
  const close = useStore((s) => s.closeInbox);
  const inbox = useStore((s) => s.inbox);
  const sections = useStore((s) => s.sections);
  const removeInboxItem = useStore((s) => s.removeInboxItem);
  const { promoteToGermPart } = useStructuralPartsActions();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  const { flat, contentById } = useMemo(() => flattenSections(sections), [sections]);

  if (!open) return null;

  const append = (item: InboxItem, sectionId: string) => {
    const content = contentById.get(sectionId);
    if (content === undefined) return;
    // `newContent` must include the section's own extent (its heading line + body).
    onSaveContent(sectionId, `${content}\n\n${item.text}`);
    void removeInboxItem(item.id);
  };
  const promote = (item: InboxItem) => {
    void promoteToGermPart(item.text);
    void removeInboxItem(item.id);
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-[360px] max-w-full flex flex-col bg-hld-surface border-l border-hld-border text-hld-text font-sans shadow-2xl">
      <header className="shrink-0 flex items-center gap-[8px] px-[16px] h-[44px] border-b border-hld-border">
        <span aria-hidden className="w-[5px] h-[5px] rotate-45 bg-hld-cyan" />
        <span className="font-mono text-[11px] tracking-[0.16em] uppercase text-hld-muted-text">Inbox · {inbox.length}</span>
        <button type="button" onClick={close} aria-label="Close the inbox" className="ml-auto text-hld-muted hover:text-hld-text transition-colors">
          <X size={14} />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto">
        {inbox.length === 0 ? (
          <div className="p-[24px] font-mono text-[10px] tracking-[0.12em] uppercase text-hld-muted leading-[1.8]">
            The inbox is empty. Press ⌘/Ctrl+I from anywhere to park a stray thought — route it to a
            section or a germ part later.
          </div>
        ) : (
          <ul>
            {inbox.map((item) => (
              <InboxRow
                key={item.id}
                item={item}
                flat={flat}
                onAppend={(id) => append(item, id)}
                onPromote={() => promote(item)}
                onDiscard={() => void removeInboxItem(item.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
