import { useState } from 'react';
import type { DirectiveSuggestion } from '../../types';
import { useSuggestDirectives } from './use-suggest-directives';

/**
 * AI-suggested directives (ported from the engine's SUGGESTION flow). Proposes
 * 2–3 distinct strategic directives, flavored by the active evaluator persona;
 * clicking one fills the directive box.
 */
export function DirectiveSuggestions({ onPick }: { onPick: (directive: string) => void }) {
  const suggestDirectives = useSuggestDirectives();
  const [items, setItems] = useState<DirectiveSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    setItems(await suggestDirectives());
    setLoading(false);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={run}
        disabled={loading}
        className="self-start flex items-center gap-1.5 px-2 py-1 border border-hld-purple/40 text-hld-purple hover:bg-hld-purple/10 disabled:opacity-40 disabled:cursor-not-allowed font-mono text-[9px] uppercase tracking-[0.1em] transition-all"
      >
        {loading && (
          <span className="w-2.5 h-2.5 rounded-full border-[1.5px] border-hld-purple/30 border-t-hld-purple animate-spin" />
        )}
        {loading ? 'Thinking…' : '✦ Suggest directives'}
      </button>
      {items.map((s, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onPick(s.directive)}
          className="text-left border border-hld-border hover:border-hld-purple/40 bg-hld-bg p-2 transition-colors group"
        >
          <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-hld-purple mb-1">
            {s.title}
          </div>
          <div className="font-mono text-[10px] leading-[1.5] text-hld-muted-text group-hover:text-hld-text line-clamp-3">
            {s.directive}
          </div>
        </button>
      ))}
    </div>
  );
}
