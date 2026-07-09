import { useState } from 'react';
import type { DirectiveSuggestion } from '../../types';
import { useSuggestDirectives } from './use-suggest-directives';
import { Spinner } from '../shared/Spinner';

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
        className="self-start flex items-center gap-1.5 px-2 py-1 border border-hld-feat-running/40 text-hld-feat-running hover:bg-hld-feat-running/10 disabled:opacity-40 disabled:cursor-not-allowed font-mono text-[9px] uppercase tracking-[0.1em] transition-all"
      >
        {loading && (
          <Spinner hue="purple" size={10} />
        )}
        {loading ? 'Thinking…' : '✦ Suggest directives'}
      </button>
      {items.map((s, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onPick(s.directive)}
          className="text-left border border-hld-border hover:border-hld-feat-running/40 bg-hld-bg p-2 transition-colors group"
        >
          <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-hld-feat-running mb-1">
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
