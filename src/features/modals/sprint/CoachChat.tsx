// Living Sprints — the conversational coach (chat / hybrid styles). A streaming
// back-and-forth that converges on the session goal via the inquiry rule (ask,
// don't tell). When the writer is ready, "Build my steps" confirms a one-line
// goal (prefilled from their last turn) and hands the whole transcript forward
// as extra context for the plan generator. Mirrors DialogueTab's streaming idiom.

import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { Pip } from '../../shared/Pip';
import { aiProvider } from '../../../services/ai-provider-registry';
import type { DialogueMessage, PromptsConfig, SectionSpec, SprintGoalFraming } from '../../../types';
import type { ModelChoice } from '../../../services/ai/model-types';

interface CoachChatProps {
  goalModel: 'woop' | 'plain';
  sectionTitle: string;
  spec?: SectionSpec;
  modelChoice: ModelChoice;
  config: PromptsConfig;
  onReady: (framing: SprintGoalFraming, transcript: string) => void;
  onBack?: () => void;
}

function openingLine(goalModel: 'woop' | 'plain'): string {
  return goalModel === 'woop'
    ? `Let's find the goal. What's the one thing that has to be true by the end of this sprint?`
    : `What's the one thing that has to be true by the end of this sprint?`;
}

export function CoachChat({ goalModel, sectionTitle, spec, modelChoice, config, onReady, onBack }: CoachChatProps) {
  const [messages, setMessages] = useState<DialogueMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamedText, setStreamedText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [wishDraft, setWishDraft] = useState('');
  const [finalizing, setFinalizing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const hasUserTurn = messages.some((m) => m.role === 'user');

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, streaming, streamedText.length, finalizing]);

  const send = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    const next = [...messages, { role: 'user' as const, text }];
    setMessages(next);
    setInput('');
    setStreaming(true);
    setStreamedText('');
    setError(null);
    try {
      let acc = '';
      for await (const chunk of aiProvider.coachSprintTurn({
        sectionTitle,
        spec,
        goalModel,
        messages: next,
        config,
        modelChoice,
      })) {
        acc += chunk;
        setStreamedText(acc);
      }
      setMessages((m) => [...m, { role: 'model', text: acc }]);
    } catch (e) {
      console.error('[CoachChat] turn failed', e);
      setError('Coach unavailable — you can still write your goal below and build steps.');
    } finally {
      setStreaming(false);
      setStreamedText('');
    }
  };

  const beginFinalize = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    setWishDraft(lastUser?.text ?? '');
    setFinalizing(true);
  };

  const confirm = () => {
    const wish = wishDraft.trim();
    if (!wish) return;
    const transcript = messages
      .map((m) => `${m.role === 'user' ? 'Writer' : 'Coach'}: ${m.text}`)
      .join('\n');
    onReady({ model: goalModel, wish }, transcript);
  };

  return (
    <div className="flex flex-col gap-[12px]">
      <div ref={scrollRef} className="flex flex-col gap-[10px] max-h-[42vh] overflow-y-auto pr-1">
        {/* Static opening coach line (not part of the API history). */}
        <CoachBubble text={openingLine(goalModel)} />
        {messages.map((m, idx) =>
          m.role === 'user' ? <UserBubble key={idx} text={m.text} /> : <CoachBubble key={idx} text={m.text} />,
        )}
        {streaming && (streamedText ? <CoachBubble text={streamedText} /> : <TypingPulse />)}
      </div>

      {error && (
        <div className="text-[11.5px] text-hld-yellow bg-hld-yellow/10 border border-hld-yellow/30 px-3 py-2">
          {error}
        </div>
      )}

      {finalizing ? (
        <div className="flex flex-col gap-[10px] border border-hld-cyan/30 bg-hld-cyan/[0.04] p-[12px]">
          <div className="font-mono text-[9px] tracking-[0.14em] uppercase text-hld-cyan">
            Your goal for this sprint
          </div>
          <textarea
            autoFocus
            value={wishDraft}
            onChange={(e) => setWishDraft(e.target.value)}
            rows={2}
            className="w-full bg-hld-surface-2 border border-hld-border text-hld-text text-[12.5px] leading-relaxed p-[10px] outline-none focus:border-hld-cyan/40 resize-none font-sans"
          />
          <div className="flex items-center gap-[10px]">
            <button
              type="button"
              onClick={() => setFinalizing(false)}
              className="bg-transparent border border-hld-border text-hld-muted-text hover:text-hld-text font-mono text-[9px] tracking-[0.12em] uppercase px-[14px] py-[10px] transition-colors"
            >
              ← Keep talking
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={!wishDraft.trim()}
              className="bracketed hld-lit ml-auto px-[20px] py-[10px] font-mono text-[10px] font-bold tracking-[0.14em] uppercase disabled:opacity-40"
            >
              Break into steps →
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex gap-[8px]">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) void send();
              }}
              placeholder="Answer the coach…"
              className="flex-1 min-w-0 p-[11px] text-[13px] border border-hld-border bg-hld-surface-2 text-hld-text outline-none focus:border-hld-cyan font-sans placeholder-hld-muted/50"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={!input.trim() || streaming}
              className="w-[40px] flex items-center justify-center border border-hld-border text-hld-muted-text hover:text-hld-cyan hover:border-hld-cyan transition-all disabled:opacity-35 disabled:cursor-not-allowed shrink-0"
              title="Send"
            >
              <Send size={13} />
            </button>
          </div>
          <div className="flex items-center gap-[10px]">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="bg-transparent border border-hld-border text-hld-muted-text hover:text-hld-text font-mono text-[9px] tracking-[0.12em] uppercase px-[14px] py-[10px] transition-colors"
              >
                ← Back
              </button>
            )}
            <button
              type="button"
              onClick={beginFinalize}
              disabled={!hasUserTurn || streaming}
              className="bracketed hld-lit ml-auto px-[20px] py-[10px] font-mono text-[10px] font-bold tracking-[0.14em] uppercase disabled:opacity-40"
            >
              Build my steps →
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function CoachBubble({ text }: { text: string }) {
  return (
    <div className="mr-auto max-w-[88%] text-[12.5px] leading-relaxed bg-hld-yellow/[0.05] border border-hld-yellow/20 text-[#e9e3c0] px-[12px] py-[9px] whitespace-pre-wrap">
      <div className="flex items-center gap-[6px] font-mono text-[8px] tracking-[0.16em] uppercase text-hld-yellow mb-[5px]">
        <Pip status="yellow" size="sm" /> Coach
      </div>
      {text}
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="ml-auto max-w-[88%] text-[12.5px] leading-relaxed border-l-2 border-hld-cyan/40 bg-hld-cyan/5 text-hld-text px-[12px] py-[9px] whitespace-pre-wrap">
      <div className="font-mono text-[8px] tracking-[0.16em] uppercase text-hld-muted-text mb-[5px]">You</div>
      {text}
    </div>
  );
}

function TypingPulse() {
  return (
    <div className="mr-auto flex gap-[5px] p-[8px] w-fit border border-hld-border bg-hld-surface-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-[4px] h-[4px] rotate-45 bg-hld-yellow animate-pulse"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  );
}
