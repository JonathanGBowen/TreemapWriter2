import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { useStore } from "../../state";
import { computeAllStrain } from "../../lib/strain-metrics";
import type { SectionStrain, StrainSignal, StrainSignalKind } from "../../lib/strain-metrics";

const KIND_LABEL: Record<StrainSignalKind, string> = {
  'unmet-incoming': 'unmet incoming',
  'dangling-outgoing': 'dangling outgoing',
  'center-of-gravity': 'center of gravity',
  adrift: 'adrift from whole',
  recapitulative: 'recapitulative move',
  ballast: 'weight vs. work',
};

/** Directed neighbour suffix, in words ("← Chapter 1" / "→ Methods"). */
function relation(sig: StrainSignal): string {
  if (!sig.relatedTitle) return '';
  if (sig.direction === 'upstream') return ` ← ${sig.relatedTitle}`;
  if (sig.direction === 'downstream') return ` → ${sig.relatedTitle}`;
  return ` · ${sig.relatedTitle}`;
}

/** Band shown as a cool indigo diamond (filled=high, hollow=medium) AND the word — never
 *  colour alone. No warm/alarm hue: tension reads as a pull, not a danger. */
function BandMark({ band }: { band: 'medium' | 'high' }) {
  const filled = band === 'high';
  return (
    <span className="inline-flex items-center gap-[5px] shrink-0">
      <span
        aria-hidden
        className="w-[7px] h-[7px] rotate-45"
        style={filled
          ? { background: 'var(--color-hld-feat-tone)' }
          : { border: '1px solid var(--color-hld-feat-tone)' }}
      />
      <span className="font-mono text-[9px] tracking-[0.1em] uppercase text-hld-muted-text">{band}</span>
    </span>
  );
}

function StrainRow({ s, selected, onSelect, onDismiss }: {
  s: SectionStrain;
  selected: boolean;
  onSelect: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  return (
    <li className="border-b border-hld-border/50 last:border-b-0">
      <div className="flex items-start gap-[8px] py-[8px] px-[2px]">
        <button
          type="button"
          onClick={() => onSelect(s.sectionId)}
          className={`flex-1 text-left min-w-0 ${selected ? 'text-hld-cyan' : 'text-hld-text hover:text-hld-cyan'} transition-colors`}
        >
          <div className="flex items-center gap-[8px]">
            <BandMark band={s.band as 'medium' | 'high'} />
            <span className="text-[12px] font-sans truncate">{s.title}</span>
          </div>
          <ul className="mt-[4px] flex flex-col gap-[3px]">
            {s.signals.map((sig, i) => (
              <li key={i} className="text-[11px] leading-snug font-sans text-hld-muted-text-2 pl-[12px] border-l border-hld-border">
                <span className="font-mono text-[9px] tracking-[0.08em] uppercase text-hld-muted-text mr-[5px]">{KIND_LABEL[sig.kind]}</span>
                {sig.source === 'ai' && (
                  <span className="font-mono text-[8px] tracking-[0.1em] uppercase text-hld-feat-tone/80 mr-[5px]" title="from an AI diagnostic, not the deterministic mesh check">ai</span>
                )}
                {sig.detail}
                {relation(sig) && <span className="text-hld-muted-text">{relation(sig)}</span>}
              </li>
            ))}
          </ul>
        </button>
        <button
          type="button"
          onClick={() => onDismiss(s.sectionId)}
          aria-label={`Dismiss structural tension for ${s.title}`}
          title="Dismiss (returns on reload)"
          className="text-hld-muted hover:text-hld-magenta shrink-0 mt-[2px] transition-colors"
        >
          <X size={11} />
        </button>
      </div>
    </li>
  );
}

/**
 * The Structural-Tension Register — the document's unpaid commitments / located gaps,
 * named as directed findings (docs/gestalt-design-II.md L3b). A quiet, keyboard- and
 * screen-reader-accessible companion to the treemap that externalizes the whole without
 * touching the map. Silent when there is no tension; deterministic-first; dismissable.
 */
export function StrainRegister({ onSelect }: { onSelect: (id: string) => void }) {
  const sections = useStore((s) => s.sections);
  const testSuite = useStore((s) => s.testSuite);
  const selectedId = useStore((s) => s.selectedId);
  const dismissedStrainIds = useStore((s) => s.dismissedStrainIds);
  const dismissStrain = useStore((s) => s.dismissStrain);
  const [open, setOpen] = useState(false);

  const strained = useMemo(() => {
    const { strained } = computeAllStrain(sections, testSuite);
    return strained.filter((s) => !dismissedStrainIds.includes(s.sectionId));
  }, [sections, testSuite, dismissedStrainIds]);

  if (strained.length === 0) return null;

  const count = strained.length;
  const summary = `${count} ${count === 1 ? 'section' : 'sections'} under structural tension (unpaid commitments)`;

  return (
    <section role="region" aria-label="Structural tension register" className="shrink-0">
      <h3 className="sr-only">{summary}</h3>
      <button
        type="button"
        onClick={() => setOpen((x) => !x)}
        aria-expanded={open}
        className="w-full flex items-center gap-[7px] py-[7px] px-[2px] font-mono text-[10px] tracking-[0.12em] uppercase text-hld-muted-text hover:text-hld-feat-tone transition-colors"
      >
        <span aria-hidden className="w-[6px] h-[6px] rotate-45 bg-hld-feat-tone/80 shrink-0" />
        <span>Structural tension · {count}</span>
        <span aria-hidden className={`ml-auto text-[10px] transition-transform ${open ? 'rotate-90' : ''}`}>▸</span>
      </button>
      {open && (
        <ul className="max-h-[180px] overflow-y-auto">
          {strained.map((s) => (
            <StrainRow
              key={s.sectionId}
              s={s}
              selected={s.sectionId === selectedId}
              onSelect={onSelect}
              onDismiss={dismissStrain}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
