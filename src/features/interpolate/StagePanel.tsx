import { useStore } from '../../state';
import type { Section, SectionSpec } from '../../types';
import { useInterpolateActions } from './use-interpolate-actions';
import { SpecChat } from './SpecChat';
import { SteerInput } from './SteerInput';
import { SpecPreview } from './SpecPreview';
import { DisabledHint } from '../shared/DisabledHint';

const findTitle = (nodes: Section[], id: string): string | null => {
  for (const n of nodes) {
    if (n.id === id) return n.title;
    const f = findTitle(n.children, id);
    if (f) return f;
  }
  return null;
};

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

/** The completed-walk state: every level's spec is in the document. */
function DoneState({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 px-6">
      <span className="text-hld-cyan text-[28px]">✦</span>
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-hld-text">All levels specified</p>
      <p className="text-[12px] font-sans text-hld-muted-text-2 max-w-[36ch] leading-relaxed">
        Every level’s spec is in your document, ready to diagnose against. Close to return to writing.
      </p>
      <button
        type="button"
        onClick={onClose}
        className="hld-lit px-3 py-[9px] font-mono text-[10px] uppercase tracking-[0.12em]"
      >
        ‹ Done — back to writing
      </button>
    </div>
  );
}

/**
 * The center of the workspace: the current stage's parent-context header, the
 * interaction (collaborative chat when the Agent SDK is routed here, otherwise the
 * steer-note + generate path), the editable proposal, and Accept & continue.
 */
export function StagePanel() {
  const interpStages = useStore((s) => s.interpStages);
  const stageCursor = useStore((s) => s.stageCursor);
  const stageWork = useStore((s) => s.stageWork);
  const specCache = useStore((s) => s.specCache);
  const sections = useStore((s) => s.sections);
  const setStageSteer = useStore((s) => s.setStageSteer);
  const setProposedSpec = useStore((s) => s.setProposedSpec);
  const closeInterpolate = useStore((s) => s.closeInterpolate);

  const { isCollaborative, streaming, generateLevel, developLevel, acceptLevel } = useInterpolateActions();

  const stage = interpStages[stageCursor];
  if (!stage) return <DoneState onClose={closeInterpolate} />;

  const work = stageWork[stage.id] ?? { steer: '', messages: [], proposed: {}, status: 'idle' as const };
  const hasProposal = Object.keys(work.proposed).length > 0;
  const busy = work.status === 'generating' || work.status === 'streaming';
  const isStreaming = streaming?.stageId === stage.id;
  const streamedText = isStreaming ? streaming.text : '';

  const titleFor = (id: string) => (id === 'root' ? 'Whole document' : findTitle(sections, id) ?? id);

  const parentSummary =
    stage.kind === 'root'
      ? 'The top of the hierarchy — its thesis and macro-arcs constrain every chapter below.'
      : stage.level === 1
        ? specCache['root']
          ? `Constrained by the document spec: “${truncate(specCache['root'].mainClaim, 90)}”`
          : 'Constrained by the document spec above.'
        : 'Constrained by the accepted parent-section specs above.';

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-[18px] py-[11px] border-b border-hld-border shrink-0">
        <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-hld-cyan">
          {stage.label}
          {stage.kind === 'level' ? ` · level ${stage.level}` : ''}
        </div>
        <div className="text-[12px] font-sans text-hld-muted-text-2 mt-[2px]">{parentSummary}</div>
      </div>

      <div className="flex-1 min-h-0 flex">
        <div className="w-[40%] min-w-[340px] max-w-[560px] border-r border-hld-border flex flex-col min-h-0 bg-hld-surface-3">
          {isCollaborative ? (
            <SpecChat
              messages={work.messages}
              status={work.status}
              streamedText={streamedText}
              isStreaming={!!isStreaming}
              onSend={(text) => void developLevel(stage.id, text)}
            />
          ) : (
            <SteerInput
              steer={work.steer}
              status={work.status}
              hasProposal={hasProposal}
              onSteerChange={(text) => setStageSteer(stage.id, text)}
              onGenerate={() => void generateLevel(stage.id)}
            />
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          <div className="px-[16px] py-[9px] border-b border-hld-border flex items-center justify-between gap-3 shrink-0">
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-hld-muted-text">
              Proposed — editable
            </span>
            <DisabledHint
              when={!hasProposal && !busy}
              hint="Generate or develop this level's specs first, then accept to continue."
            >
              <button
                type="button"
                onClick={() => void acceptLevel(stage.id)}
                disabled={!hasProposal || busy}
                className="hld-lit px-3 py-[7px] font-mono text-[10px] uppercase tracking-[0.12em] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Accept &amp; continue ›
              </button>
            </DisabledHint>
          </div>
          <SpecPreview
            stage={stage}
            proposed={work.proposed}
            titleFor={titleFor}
            onEditSpec={(sectionId: string, spec: SectionSpec) => setProposedSpec(stage.id, sectionId, spec)}
          />
        </div>
      </div>
    </div>
  );
}
