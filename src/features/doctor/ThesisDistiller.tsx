import { useStore } from '../../state';
import type { ThesisOption } from '../../types';

const TYPE_META: Record<ThesisOption['type'], { label: string; glyph: string; gloss: string }> = {
  mirror: { label: 'The Mirror', glyph: '◎', gloss: 'Reflecting your explicit content' },
  pivot: { label: 'The Pivot', glyph: '⤨', gloss: 'Unifying the tension' },
  risk: { label: 'The Risk', glyph: '⚑', gloss: 'The bolder implication' },
};

/**
 * The Thesis Distiller's 3-card picker (Mirror / Pivot / Risk) — the ported
 * app's one true click-to-select, kept: one click adopts the option as the
 * working thesis. Shared by the ThesisBar and wizard step 1.
 */
export function ThesisDistiller({ onPick }: { onPick?: () => void }) {
  const options = useStore((s) => s.doctorThesisOptions);
  const setThesis = useStore((s) => s.setDoctorThesis);
  const setOptions = useStore((s) => s.setDoctorThesisOptions);

  if (!options || options.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {options.map((o, i) => {
        const meta = TYPE_META[o.type];
        return (
          <button
            key={`${o.type}-${i}`}
            type="button"
            onClick={() => {
              setThesis(o.thesis, 'distilled');
              setOptions(null);
              onPick?.();
            }}
            className="text-left p-3 border border-hld-border bg-hld-surface hover:border-hld-cyan hover:bg-hld-cyan/5 transition-all group"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-hld-cyan text-[13px]">{meta.glyph}</span>
              <span className="font-mono uppercase tracking-[0.14em] text-[9px] font-bold text-hld-text group-hover:text-hld-cyan">
                {meta.label}
              </span>
            </div>
            <div className="font-mono text-[9px] text-hld-muted-text mb-2">{o.description || meta.gloss}</div>
            <div className="font-sans text-[12px] text-slate-300 leading-relaxed">{o.thesis}</div>
          </button>
        );
      })}
    </div>
  );
}
