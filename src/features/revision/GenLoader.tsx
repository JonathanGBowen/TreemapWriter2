/** Generating-phase loader. The line is load-bearing: it states the guarantee. */
export function GenLoader() {
  return (
    <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
      <span className="w-3 h-3 rounded-full border-[1.5px] border-hld-cyan/25 border-t-hld-cyan animate-spin" />
      <div className="font-mono uppercase tracking-[0.14em] text-[9px] text-hld-cyan">
        Tracing sources…
      </div>
      <div className="font-mono text-[9px] text-hld-muted-text max-w-[240px] leading-[1.6]">
        Every proposal will carry a verbatim quote from your sources. No claim without a receipt.
      </div>
    </div>
  );
}
