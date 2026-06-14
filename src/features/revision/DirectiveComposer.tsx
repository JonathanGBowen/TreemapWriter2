import { useStore } from '../../state';
import type { AssemblySubMode, RevisionMode } from '../../types';

const PRESETS = [
  'Tighten the argument; cut hedging.',
  'Surface every unsupported claim.',
  'Improve flow between paragraphs.',
];

// Literal class strings (no template construction) so Tailwind's JIT sees them.
const MODE_ON: Record<RevisionMode, string> = {
  revision: 'border-hld-cyan bg-hld-cyan/10 text-hld-cyan',
  assembly: 'border-hld-assembly bg-hld-assembly/10 text-hld-assembly',
};

/** Revision/Assembly mode, the Verbatim/Woven sub-mode, the directive, and presets. */
export function DirectiveComposer() {
  const mode = useStore((s) => s.revisionMode);
  const subMode = useStore((s) => s.revisionSubMode);
  const directive = useStore((s) => s.directive);
  const setMode = useStore((s) => s.setRevisionMode);
  const setSubMode = useStore((s) => s.setRevisionSubMode);
  const setDirective = useStore((s) => s.setRevisionDirective);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex gap-1.5">
        {(['revision', 'assembly'] as RevisionMode[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setMode(k)}
            className={`flex-1 px-2 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em] border transition-all ${
              mode === k ? MODE_ON[k] : 'border-hld-border text-hld-muted-text'
            }`}
          >
            {k}
          </button>
        ))}
      </div>

      {mode === 'assembly' && (
        <div className="flex gap-1.5">
          {(['verbatim', 'woven'] as AssemblySubMode[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setSubMode(k)}
              className={`flex-1 px-2 py-1 font-mono text-[8.5px] font-semibold uppercase tracking-[0.1em] border transition-all ${
                subMode === k
                  ? 'border-hld-assembly/50 bg-hld-assembly/10 text-hld-assembly'
                  : 'border-hld-border text-hld-muted-text'
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      )}

      <textarea
        value={directive}
        onChange={(e) => setDirective(e.target.value)}
        rows={3}
        placeholder="What should this revision accomplish?"
        className="bg-hld-bg border border-hld-border focus:border-hld-cyan outline-none text-hld-text font-mono text-[12px] px-2.5 py-2 resize-none leading-[1.5] focus:shadow-[0_0_12px_rgba(0,232,245,0.2)]"
      />

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDirective(d)}
            className="px-1.5 py-1 border border-hld-border text-hld-muted-text hover:text-hld-cyan font-mono text-[8.5px] tracking-[0.04em] transition-colors"
          >
            + {d.length > 30 ? `${d.slice(0, 28)}…` : d}
          </button>
        ))}
      </div>
    </div>
  );
}
