import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import type { DialogueMessage } from '../../types';
import type { StageStatus } from '../../state/interpolation-state';
import { AgentTraceTicker } from '../shared/AgentTraceTicker';

/** Left edge = your words (faint cyan); a muted panel = the agent's. Position says who. */
const Bubble = ({ message }: { message: DialogueMessage }) => {
  const me = message.role === 'user';
  return (
    <div
      className={`max-w-[90%] px-[12px] py-[11px] text-[12.5px] font-sans leading-relaxed whitespace-pre-wrap text-hld-text ${
        me ? 'ml-auto border-l-2 border-hld-cyan/40 bg-hld-cyan/5' : 'mr-auto border border-hld-border bg-hld-surface2'
      }`}
    >
      <span className="block font-mono text-[9px] uppercase tracking-[0.12em] mb-[5px] text-hld-muted-text-2">
        {me ? 'You' : 'Agent'}
      </span>
      {message.text}
    </div>
  );
};

/** Pre-first-chunk indicator: three pulsing squares. */
const TypingPulse = () => (
  <div className="flex gap-[5px] p-[8px] w-fit border border-hld-border bg-hld-surface2">
    {[0, 1, 2].map((i) => (
      <div key={i} className="w-[4px] h-[4px] rotate-45 bg-hld-cyan animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
    ))}
  </div>
);

/**
 * The collaborative transcript for a level: stream the agent's reasoning + proposal,
 * refine it conversationally. Mirrors the Dialogue tab; the parsed JSON proposal lands
 * in the editable preview beside this (so the chat stays prose-only here).
 */
export function SpecChat({
  messages,
  status,
  streamedText,
  isStreaming,
  onSend,
}: {
  messages: DialogueMessage[];
  status: StageStatus;
  streamedText: string;
  isStreaming: boolean;
  onSend: (text: string) => void;
}) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, isStreaming, streamedText.length]);

  const send = () => {
    if (isStreaming) return;
    onSend(input);
    setInput('');
  };

  const empty = messages.length === 0 && !isStreaming;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-[16px] flex flex-col gap-[12px]">
        {empty ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-hld-muted-text-2 gap-3">
            <p className="text-[12px] font-sans max-w-[30ch] leading-relaxed">
              Develop this level’s specification together with the agent. It proposes, you steer.
            </p>
            <button
              type="button"
              onClick={() => onSend('')}
              className="hld-lit px-3 py-[9px] font-mono text-[10px] uppercase tracking-[0.12em]"
            >
              ✦ Propose specs
            </button>
          </div>
        ) : (
          <>
            {messages.map((m, i) => (
              <Bubble key={i} message={m} />
            ))}
            {isStreaming && (streamedText ? <Bubble message={{ role: 'model', text: streamedText }} /> : <TypingPulse />)}
          </>
        )}
      </div>

      <div className="px-[16px] pb-[8px]">
        <AgentTraceTicker kinds={['developSpecLevel']} />
      </div>

      {!empty && (
        <div className="p-[16px] pt-0 flex gap-[8px] shrink-0">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) send(); }}
            placeholder={status === 'streaming' ? 'Streaming…' : 'Refine — sharpen a claim, change a function, flag a tension…'}
            disabled={isStreaming}
            className="flex-1 min-w-0 p-[11px] text-[13px] border border-hld-border bg-[#080d13] text-hld-text outline-none focus:border-hld-cyan font-sans placeholder-hld-muted/50 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={send}
            disabled={isStreaming || !input.trim()}
            className="w-[40px] flex items-center justify-center border border-hld-border text-hld-muted-text-2 hover:text-hld-cyan hover:bg-hld-cyan/10 hover:border-hld-cyan transition-all disabled:opacity-35 disabled:cursor-not-allowed shrink-0"
            title="Send"
          >
            <Send size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
