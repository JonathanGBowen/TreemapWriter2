import type { CSSProperties } from 'react';
import { useStore } from '../../state';
import { revisionReady } from '../../lib/revision-helpers';
import { SourcePicker } from './SourcePicker';
import { DirectiveComposer } from './DirectiveComposer';
import { useRevisionActions } from './use-revision-actions';

const cyanBr = { '--br-color': 'var(--color-hld-cyan)' } as CSSProperties;
const eyebrow = 'font-mono uppercase tracking-[0.14em] text-[9px] text-hld-muted-text mb-2';

const SOURCE_HINT: Record<string, string> = {
  assembly: 'to assemble from',
  citations: 'to check against',
  revision: 'to cite from · optional',
};

/** The "no more, no less" config core: sources → directive → one lit Generate. */
export function ReviseConfig() {
  const selectedIds = useStore((s) => s.selectedSourceIds);
  const directive = useStore((s) => s.directive);
  const mode = useStore((s) => s.revisionMode);
  const isProcessing = useStore((s) => s.isProcessing);
  const { generate } = useRevisionActions();

  // revision needs a directive (can be sourceless); assembly + citations need sources.
  const ready = revisionReady(mode, selectedIds.length, directive);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className={eyebrow}>① sources {SOURCE_HINT[mode]}</div>
        <SourcePicker />
      </div>
      <div>
        <div className={eyebrow}>② directive</div>
        <DirectiveComposer />
      </div>
      <button
        type="button"
        onClick={generate}
        disabled={!ready || isProcessing}
        style={cyanBr}
        className="bracketed w-full flex items-center justify-center gap-2 px-2.5 py-3 border border-hld-cyan bg-hld-cyan/10 text-hld-cyan hover:bg-hld-cyan/20 hover:shadow-[0_0_16px_rgba(0,232,245,0.4)] disabled:opacity-35 disabled:cursor-not-allowed font-mono text-[10.5px] font-bold uppercase tracking-[0.12em] transition-all"
      >
        ◆ Generate proposals
      </button>
      <div className="font-mono text-[8.5px] text-hld-muted text-center uppercase tracking-[0.08em]">
        {selectedIds.length === 0 && mode === 'revision'
          ? 'no sources — grounding in the document'
          : `${selectedIds.length} source${selectedIds.length === 1 ? '' : 's'} selected${
              mode === 'citations' ? ' · whole document' : ''
            }`}
      </div>
    </div>
  );
}
