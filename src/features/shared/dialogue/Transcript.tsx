import React from 'react';
import type { DialogueMessage } from '../../../types';

/** Left edge = your sentence (faint cyan); a muted panel = the partner's. The
 *  who-labels are monochrome — the position already says who's speaking (P4). */
export const Bubble: React.FC<{ message: DialogueMessage; partnerLabel?: string }> = ({
  message,
  partnerLabel = 'Partner',
}) => {
  const me = message.role === 'user';
  return (
    <div
      className={`max-w-[86%] px-[12px] py-[11px] text-[12.5px] font-sans leading-relaxed whitespace-pre-wrap text-hld-text ${
        me ? 'ml-auto border-l-2 border-hld-cyan/40 bg-hld-cyan/5' : 'mr-auto border border-hld-border bg-hld-surface-2'
      }`}
    >
      <span className="block font-mono text-[9px] uppercase tracking-[0.12em] mb-[5px] text-hld-muted-text-2">
        {me ? 'You' : partnerLabel}
      </span>
      {message.text}
    </div>
  );
};

/** Pre-first-chunk indicator: three pulsing status squares. */
export const TypingPulse: React.FC = () => (
  <div className="flex gap-[5px] p-[8px] w-fit border border-hld-border bg-hld-surface-2">
    {[0, 1, 2].map((i) => (
      <div
        key={i}
        className="w-[4px] h-[4px] rotate-45 bg-hld-cyan animate-pulse"
        style={{ animationDelay: `${i * 150}ms` }}
      />
    ))}
  </div>
);

export const Transcript: React.FC<{
  scrollRef: React.RefObject<HTMLDivElement | null>;
  messages: DialogueMessage[];
  isStreaming: boolean;
  streamedText: string;
  partnerLabel?: string;
}> = ({ scrollRef, messages, isStreaming, streamedText, partnerLabel }) => (
  <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-[12px]">
    {messages.map((m, i) => (
      <Bubble key={i} message={m} partnerLabel={partnerLabel} />
    ))}
    {isStreaming &&
      (streamedText ? (
        <Bubble message={{ role: 'model', text: streamedText }} partnerLabel={partnerLabel} />
      ) : (
        <TypingPulse />
      ))}
  </div>
);
