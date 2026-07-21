import React, { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { FlaskConical, MessagesSquare } from "lucide-react";
import { useStore } from "../../state";
import { buildGapFocus } from "../../lib/gap-focus";
import { Composer, Transcript } from "../shared/dialogue";
import { DisabledHint } from "../shared/DisabledHint";
import { MemorandumDisclosure } from "../coach/MemorandumDisclosure";
import { useCurrentSection } from '../shared/use-current-section';
import { useAnalysisActions } from "./use-analysis-actions";
import { OpeningDialogue } from "./OpeningDialogue";

const DialogueEmptyState: React.FC<{ onOpenAnalysis: () => void; onGaps?: () => void }> = ({
  onOpenAnalysis,
  onGaps,
}) => (
  <div className="flex-1 overflow-y-auto p-4 bg-hld-surface-3 flex flex-col items-center justify-center text-center text-hld-muted-text-2 gap-3">
    <MessagesSquare size={32} className="opacity-50" />
    <p className="font-mono uppercase tracking-[0.12em] text-[9px] -mb-1">No dialogue</p>
    <p className="text-[12px] font-sans text-hld-muted-text-2">
      Interrogate part of an analysis to begin{onGaps ? ' — or take the structure’s open gaps to dialogue' : ''}.
    </p>
    <div className="flex gap-[8px]">
      <button
        onClick={onOpenAnalysis}
        className="px-[14px] py-[8px] bg-transparent border border-hld-border text-hld-muted-text-2 font-mono uppercase tracking-[0.12em] text-[9px] font-semibold hover:text-hld-cyan hover:border-hld-cyan transition-all"
      >
        From analysis
      </button>
      {onGaps && (
        <button
          onClick={onGaps}
          title="Seed a dialogue from the section's open gaps — mesh breaks, missing moves, the next demand"
          className="px-[14px] py-[8px] bg-transparent border border-hld-border text-hld-muted-text-2 font-mono uppercase tracking-[0.12em] text-[9px] font-semibold hover:text-hld-cyan hover:border-hld-cyan transition-all"
        >
          ⊕ Gaps
        </button>
      )}
    </div>
    <MemorandumDisclosure />
  </div>
);

const DialogueFooter: React.FC<{
  canSend: boolean;
  canRefactor: boolean;
  canClear: boolean;
  isStreaming: boolean;
  isProcessing: boolean;
  onSend: (text: string) => void;
  onRefactor: () => void;
  onClear: () => void;
}> = ({ canSend, canRefactor, canClear, isStreaming, isProcessing, onSend, onRefactor, onClear }) => (
  <div className="p-4 pt-0 flex flex-col gap-[10px] shrink-0">
    <Composer canSend={canSend} onSend={onSend} />
    <DisabledHint
      when={!canRefactor && !isStreaming && !isProcessing}
      hint="Have a back-and-forth first — ask a question and get a reply, then conclude."
      className="block w-full"
    >
      <button
        onClick={onRefactor}
        disabled={!canRefactor}
        className="w-full py-[13px] bracketed hld-lit font-mono uppercase tracking-[0.12em] text-[11px] font-bold flex items-center justify-center gap-2 disabled:opacity-35 disabled:cursor-not-allowed"
        style={{ "--br-color": "var(--color-hld-cyan)" } as CSSProperties}
        title="Synthesize this dialogue into a new analysis version"
      >
        {isProcessing ? <>Refactoring…</> : <><FlaskConical size={11} /> Conclude → new version</>}
      </button>
    </DisabledHint>
    {canClear && (
      <div className="flex justify-end">
        <button
          onClick={onClear}
          disabled={isStreaming}
          className="px-[2px] py-[4px] font-mono uppercase tracking-[0.12em] text-[10px] text-hld-muted-text hover:text-hld-yellow transition-colors disabled:opacity-35"
          title="Clear this dialogue (recoverable from Version History)"
        >
          Clear
        </button>
      </div>
    )}
  </div>
);

export const DialogueTab: React.FC = () => {
  const testSuite = useStore(s => s.testSuite);
  const sections = useStore(s => s.sections);
  const isProcessing = useStore(s => s.isProcessing);
  const setTestsPanelTab = useStore(s => s.setTestsPanelTab);
  const dialogueOpening = useStore(s => s.dialogueOpening);
  const currentSection = useCurrentSection();
  const { sendDialogueMessage, concludeAndRefactor, discardDialogue, interrogate, streaming } = useAnalysisActions();
  const scrollRef = useRef<HTMLDivElement>(null);

  const state = currentSection ? testSuite[currentSection.id]?.analysis : undefined;
  const messages = state?.dialogue ?? [];
  const context = state?.dialogueContext ?? null;
  const isStreaming = !!(streaming && currentSection && streaming.sectionId === currentSection.id);
  const streamedText = isStreaming ? streaming.text : '';

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, isStreaming, streamedText.length]);

  // An active anchored opening (re-entry / coach-plan / unstick) takes the tab —
  // it is section-independent and ephemeral, so it renders above the analysis
  // dialogue (whose persisted home on the testSuite is untouched). Placed after
  // all hooks so the rules of hooks hold regardless of which face renders. Keyed
  // by the opening id so a swap (e.g. mid-stream) remounts fresh rather than
  // inheriting the previous opening's stream/accept state.
  if (dialogueOpening) return <OpeningDialogue key={dialogueOpening.id} opening={dialogueOpening} />;

  if (!currentSection) return null;

  if (!context && messages.length === 0) {
    const gapFocus = buildGapFocus(currentSection.id, sections, testSuite);
    return (
      <DialogueEmptyState
        onOpenAnalysis={() => setTestsPanelTab('analysis')}
        onGaps={gapFocus ? () => interrogate(gapFocus) : undefined}
      />
    );
  }

  const canRefactor =
    !isStreaming && !isProcessing &&
    messages.some(m => m.role === 'user') &&
    messages.some(m => m.role === 'model');

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-hld-surface-3">
      {/* Focus banner: what this dialogue is pinned to — a quiet left-hairline. */}
      {context && (
        <div className="mx-4 mt-4 mb-0 pl-[12px] py-[11px] border-l-2 border-hld-border bg-hld-surface-2/40 shrink-0">
          <div className="text-[9px] font-mono uppercase tracking-[0.12em] text-hld-muted-text-2 mb-[5px]">Focus</div>
          <div className="text-[12px] text-hld-text font-sans leading-snug whitespace-pre-wrap line-clamp-3">
            {context}
          </div>
        </div>
      )}

      <Transcript scrollRef={scrollRef} messages={messages} isStreaming={isStreaming} streamedText={streamedText} />

      <DialogueFooter
        key={currentSection.id}
        canSend={!isStreaming && !isProcessing}
        canRefactor={canRefactor}
        canClear={messages.length > 0 || !!context}
        isStreaming={isStreaming}
        isProcessing={isProcessing}
        onSend={(text) => void sendDialogueMessage(text)}
        onRefactor={() => void concludeAndRefactor()}
        onClear={discardDialogue}
      />
    </div>
  );
};
