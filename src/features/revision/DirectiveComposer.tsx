import { useEffect, useState } from 'react';
import { useStore } from '../../state';
import { resolveModelChoice } from '../../services/ai/resolve-model-choice';
import { guardContextFit } from '../shared/context-guard';
import { useCurrentSection } from '../shared/use-current-section';
import type { AssemblySubMode, RevisionMode } from '../../types';
import { DirectiveSuggestions } from './DirectiveSuggestions';
import { DirectiveDialogue } from './DirectiveDialogue';

const PRESETS = [
  'Tighten the argument; cut hedging.',
  'Surface every unsupported claim.',
  'Improve flow between paragraphs.',
];

// Literal class strings (no template construction) so Tailwind's JIT sees them.
const MODE_ON: Record<RevisionMode, string> = {
  revision: 'border-hld-cyan bg-hld-cyan/10 text-hld-cyan',
  assembly: 'border-hld-yellow bg-hld-yellow/10 text-hld-yellow',
  citations: 'border-hld-feat-confidence bg-hld-feat-confidence/10 text-hld-feat-confidence',
};

/** Revision/Assembly/Citations mode, the Verbatim/Woven sub-mode, the directive, and presets. */
export function DirectiveComposer() {
  const mode = useStore((s) => s.revisionMode);
  const subMode = useStore((s) => s.revisionSubMode);
  const directive = useStore((s) => s.directive);
  const setMode = useStore((s) => s.setRevisionMode);
  const setSubMode = useStore((s) => s.setRevisionSubMode);
  const setDirective = useStore((s) => s.setRevisionDirective);
  const setSelectedId = useStore((s) => s.setSelectedId);
  const currentSection = useCurrentSection();
  const [dialogueOpen, setDialogueOpen] = useState(false);

  // The dialogue sends the prose each turn — pre-flight it once, on open.
  const openDialogue = () => {
    if (!currentSection) return;
    const { modelConfig, globalModelDefault, modelCatalog } = useStore.getState();
    const choice = resolveModelChoice('directiveDialogueTurn', modelConfig, globalModelDefault);
    if (
      !guardContextFit({
        catalog: modelCatalog,
        choice,
        text: currentSection.fullContent,
        what: 'This section',
        setting: 'Directive dialogue',
      })
    ) {
      return;
    }
    setDialogueOpen(true);
  };

  // Citations is a whole-document audit (citations + a References section span the
  // doc), so entering it switches scope to the whole document. One-shot on the
  // transition into citations; we never auto-revert — the rail's Whole Document
  // row lets the user navigate back to a section to check just that one.
  useEffect(() => {
    if (mode === 'citations' && useStore.getState().selectedId !== 'root') {
      setSelectedId('root');
    }
  }, [mode, setSelectedId]);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex gap-1.5">
        {(['revision', 'assembly', 'citations'] as RevisionMode[]).map((k) => (
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
                  ? 'border-hld-yellow/50 bg-hld-yellow/10 text-hld-yellow'
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

      {dialogueOpen ? (
        <DirectiveDialogue
          onConfirm={(d) => {
            setDirective(d);
            setDialogueOpen(false);
          }}
          onClose={() => setDialogueOpen(false)}
        />
      ) : (
        <>
          <div className="flex items-start gap-1.5">
            <div className="flex-1 min-w-0">
              <DirectiveSuggestions onPick={setDirective} />
            </div>
            <button
              type="button"
              onClick={openDialogue}
              title="A short Socratic exchange that extracts what this revision must accomplish"
              className="px-2 py-1 border border-hld-border text-hld-muted-text hover:text-hld-cyan hover:border-hld-cyan/40 font-mono text-[9px] uppercase tracking-[0.1em] transition-colors shrink-0"
            >
              ⟡ Find the directive
            </button>
          </div>

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
        </>
      )}
    </div>
  );
}
