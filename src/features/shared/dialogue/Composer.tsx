import React, { useState } from 'react';
import { Send } from 'lucide-react';

/**
 * The single-line dialogue composer — deliberately one line (Enter sends,
 * IME-guarded): the shape itself discourages essay-writing at the AI. There is
 * no unseeded variant; a surface must have something to talk *about* before it
 * mounts a composer (the no-lobby rule, docs/dialogue-design.md §II).
 */
export const Composer: React.FC<{
  canSend: boolean;
  onSend: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** Quiet controls rendered after Send (e.g. a distill-now affordance). */
  trailing?: React.ReactNode;
}> = ({ canSend, onSend, placeholder = 'Critique or question...', autoFocus, trailing }) => {
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!canSend || !input.trim()) return;
    onSend(input);
    setInput('');
  };

  return (
    <div className="flex gap-[8px]">
      <input
        value={input}
        autoFocus={autoFocus}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSend();
        }}
        placeholder={placeholder}
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
      {trailing}
    </div>
  );
};
