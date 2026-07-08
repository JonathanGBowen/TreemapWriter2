import { useState, type CSSProperties } from 'react';
import { useStore } from '../../state';
import { revisionReady } from '../../lib/revision-helpers';
import { Pip } from '../shared/Pip';
import { SourcePicker } from './SourcePicker';
import { DirectiveComposer } from './DirectiveComposer';
import { useRevisionActions } from './use-revision-actions';
import { useSourceAudit } from './use-source-audit';

const cyanBr = { '--br-color': 'var(--color-hld-cyan)' } as CSSProperties;
const eyebrow = 'font-mono uppercase tracking-[0.14em] text-[9px] text-hld-muted-text mb-2';

const SOURCE_HINT: Record<string, string> = {
  assembly: 'to assemble from',
  citations: 'to check against',
  revision: 'reference works, notes, style · optional',
};

/** The "no more, no less" config core: sources → directive → one lit Generate. */
export function ReviseConfig() {
  const selectedIds = useStore((s) => s.selectedSourceIds);
  const directive = useStore((s) => s.directive);
  const mode = useStore((s) => s.revisionMode);
  const isProcessing = useStore((s) => s.isProcessing);
  const localAgentEnabled = useStore((s) => s.localAgentEnabled);
  const auditPacing = useStore((s) => s.auditPacing);
  const setAuditPacing = useStore((s) => s.setAuditPacing);
  const { generate, generateDeep } = useRevisionActions();
  const { runAudit } = useSourceAudit();
  const [deep, setDeep] = useState(false);
  const [perSource, setPerSource] = useState(false);
  // Bounded + gated: the deep pass runs the local agent (which gathers cross-section
  // context first) but routes through the same review/accept gate. Only offered when
  // the experimental Local agent is on.
  const useDeep = deep && localAgentEnabled;
  // The batch audit is a citations-mode run mode: one deep read per source.
  const useAudit = perSource && mode === 'citations';

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
      {localAgentEnabled && (
        <button
          type="button"
          onClick={() => setDeep((d) => !d)}
          aria-pressed={deep}
          className="flex items-center gap-2 self-start font-mono text-[9px] uppercase tracking-[0.1em] text-hld-muted-text hover:text-hld-cyan transition-colors"
          title="Run the local agent so it gathers cross-section + history context before proposing. It still only proposes — you accept each edit."
        >
          <Pip status={deep ? 'cyan' : 'idle'} size="sm" live={deep} />
          deep pass — agent gathers cross-section + history context
        </button>
      )}
      {mode === 'citations' && (
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => setPerSource((v) => !v)}
            aria-pressed={perSource}
            className="flex items-center gap-2 self-start font-mono text-[9px] uppercase tracking-[0.1em] text-hld-muted-text hover:text-hld-cyan transition-colors"
            title="One focused pass per selected source: read it rigorously, then audit the document's usage — and non-usage — of it. Proposals collect below, grouped by source; each is still accepted individually."
          >
            <Pip status={perSource ? 'cyan' : 'idle'} size="sm" live={perSource} />
            per-source audit — read each source, then check its use
          </button>
          {perSource && (
            <button
              type="button"
              onClick={() => setAuditPacing(auditPacing === 'stepped' ? 'continuous' : 'stepped')}
              aria-pressed={auditPacing === 'stepped'}
              className="ml-5 flex items-center gap-2 self-start font-mono text-[8.5px] uppercase tracking-[0.1em] text-hld-muted-text hover:text-hld-cyan transition-colors"
              title="Pause for review after each source instead of running straight through."
            >
              <Pip status={auditPacing === 'stepped' ? 'cyan' : 'idle'} size="sm" />
              pause after each source
            </button>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={useAudit ? runAudit : useDeep ? generateDeep : generate}
        disabled={!ready || isProcessing}
        style={cyanBr}
        className="bracketed w-full flex items-center justify-center gap-2 px-2.5 py-3 border border-hld-cyan bg-hld-cyan/10 text-hld-cyan hover:bg-hld-cyan/20 hover:shadow-[0_0_16px_rgba(0,232,245,0.4)] disabled:opacity-35 disabled:cursor-not-allowed font-mono text-[10.5px] font-bold uppercase tracking-[0.12em] transition-all"
      >
        {useAudit
          ? '◆ Audit sources · one by one'
          : useDeep
            ? '◆ Generate · deep pass'
            : '◆ Generate proposals'}
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
