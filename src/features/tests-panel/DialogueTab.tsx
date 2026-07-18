import React, { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { FlaskConical, MessagesSquare, Send } from "lucide-react";
import type { DialogueMessage } from "../../types";
import { useStore } from "../../state";
import { useCurrentSection } from '../shared/use-current-section';
import { useAnalysisActions } from "./use-analysis-actions";
import { DisabledHint } from "../shared/DisabledHint";

/** Left edge = your sentence (faint cyan); a muted panel = the partner's. The
 *  who-labels are monochrome — the position already says who's speaking (P4). */
const Bubble: React.FC<{ message: DialogueMessage }> = ({ message }) => {
  const me = message.role === 'user';
  return (
    <div
      className={`max-w-[86%] px-[12px] py-[11px] text-[12.5px] font-sans leading-relaxed whitespace-pre-wrap text-hld-text ${
        me ? 'ml-auto border-l-2 border-hld-cyan/40 bg-hld-cyan/5' : 'mr-auto border border-hld-border bg-hld-surface-2'
      }`}
    >
      <span className="block font-mono text-[9px] uppercase tracking-[0.12em] mb-[5px] text-hld-muted-text-2">{me ? 'You' : 'Partner'}</span>
      {message.text}
    </div>
  );
};

/** Pre-first-chunk indicator: three pulsing status squares. */
const TypingPulse: React.FC = () => (
  <div className="flex gap-[5px] p-[8px] w-fit border border-hld-border bg-hld-surface-2">
    {[0, 1, 2].map(i => (
      <div
        key={i}
        className="w-[4px] h-[4px] rotate-45 bg-hld-cyan animate-pulse"
        style={{ animationDelay: `${i * 150}ms` }}
      />
    ))}
  </div>
);

const Transcript: React.FC<{
  scrollRef: React.RefObject<HTMLDivElement | null>;
  messages: DialogueMessage[];
  isStreaming: boolean;
  streamedText: string;
}> = ({ scrollRef, messages, isStreaming, streamedText }) => (
  <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-[12px]">
    {messages.map((m, i) => (
      <Bubble key={i} message={m} />
    ))}
    {isStreaming && (
      streamedText
        ? <Bubble message={{ role: 'model', text: streamedText }} />
        : <TypingPulse />
    )}
  </div>
);

const DialogueEmptyState: React.FC<{ onOpenAnalysis: () => void }> = ({ onOpenAnalysis }) => (
  <div className="flex-1 overflow-y-auto p-4 bg-hld-surface-3 flex flex-col items-center justify-center text-center text-hld-muted-text-2">
    <MessagesSquare size={32} className="mb-2 opacity-50" />
    <p className="font-mono uppercase tracking-[0.12em] text-[9px] mb-1">No dialogue</p>
    <p className="text-[12px] font-sans text-hld-muted-text-2 mb-3">Interrogate part of an analysis to begin.</p>
    <button
      onClick={onOpenAnalysis}
      className="px-[14px] py-[8px] bg-transparent border border-hld-border text-hld-muted-text-2 font-mono uppercase tracking-[0.12em] text-[9px] font-semibold hover:text-hld-cyan hover:border-hld-cyan transition-all"
    >
      From analysis
    </button>
  </div>
);

const DialogueComposer: React.FC<{
  canSend: boolean;
  canRefactor: boolean;
  canClear: boolean;
  isStreaming: boolean;
  isProcessing: boolean;
  onSend: (text: string) => void;
  onRefactor: () => void;
  onClear: () => void;
}> = ({ canSend, canRefactor, canClear, isStreaming, isProcessing, onSend, onRefactor, onClear }) => {
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!canSend || !input.trim()) return;
    onSend(input);
    setInput('');
  };

  return (
    <div className="p-4 pt-0 flex flex-col gap-[10px] shrink-0">
      <div className="flex gap-[8px]">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSend(); }}
          placeholder="Critique or question..."
          className="flex-1 min-w-0 p-[11px] text-[13px] border border-hld-border bg-hld-surface-3 text-hld-text outline-none focus:border-hld-cyan font-sans placeholder-hld-muted/50"
        />
        <button
          onClick={handleSend}
          disabled={!canSend || !input.trim()}
          className="w-[40px] flex items-center justify-center border border-hld-border text-hld-muted-text-2 hover:text-hld-cyan hover:bg-hld-cyan/10 hover:border-hld-cyan transition-all disabled:opacity-35 disabled:cursor-not-allowed shrink-0"
          title="Send"
        >
          <Send size={13} />
        </button>
      </div>
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
};

export const DialogueTab: React.FC = () => {
  const testSuite = useStore(s => s.testSuite);
  const isProcessing = useStore(s => s.isProcessing);
  const setTestsPanelTab = useStore(s => s.setTestsPanelTab);
  const currentSection = useCurrentSection();
  const { sendDialogueMessage, concludeAndRefactor, discardDialogue, streaming } = useAnalysisActions();
  const scrollRef = useRef<HTMLDivElement>(null);

  const state = currentSection ? testSuite[currentSection.id]?.analysis : undefined;
  const messages = state?.dialogue ?? [];
  const context = state?.dialogueContext ?? null;
  const isStreaming = !!(streaming && currentSection && streaming.sectionId === currentSection.id);
  const streamedText = isStreaming ? streaming.text : '';

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, isStreaming, streamedText.length]);

  if (!currentSection) return null;

  if (!context && messages.length === 0) {
    return <DialogueEmptyState onOpenAnalysis={() => setTestsPanelTab('analysis')} />;
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

      <DialogueComposer
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
