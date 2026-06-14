/** The gold confidence numeral (N/5) with its eyebrow — the engine's trust signal. */
export function Confidence({ score, large = false }: { score: number; large?: boolean }) {
  return (
    <div className="flex flex-col items-end leading-none shrink-0">
      <div className="flex items-baseline gap-0.5">
        <span
          className={`font-mono font-bold text-hld-gold ${large ? 'text-[22px]' : 'text-[15px]'}`}
          style={{ textShadow: '0 0 6px rgba(255,204,0,0.55)' }}
        >
          {score.toFixed(1)}
        </span>
        <span className="font-mono text-[9px] text-hld-muted-text">/5</span>
      </div>
      <span className="font-mono uppercase tracking-[0.14em] text-[7.5px] text-hld-muted-text mt-[3px]">
        confidence
      </span>
    </div>
  );
}
