import type { ReactNode } from "react";
import { Settings } from "lucide-react";
import type { Section, DiagnosticResult } from "../../types";
import { summarizeReadiness, type ReadinessSummary } from "./diagnostic-config";

/** The ONE readiness encoder (palette 3C, Step 4): a single teal-fill bar,
 *  `summary.filled` of `summary.total` steps lit, empty track when undiagnosed.
 *  Teal reads as "you" everywhere else — readiness is a static self-assessment,
 *  not a next action, but it's still the one signature hue, not a hue ladder.
 *  The wrapper carries a text label so colour is never the only channel (P4). */
function ReadinessMeter({ summary }: { summary: ReadinessSummary }) {
  return (
    <div className="flex gap-[3px] w-[56px] h-[5px] shrink-0" role="img" aria-label={`Readiness: ${summary.label}`}>
      {Array.from({ length: summary.total }).map((_, i) => (
        <div
          key={i}
          aria-hidden
          className={`flex-1 ${i < summary.filled ? 'bg-[var(--readiness-fill)]' : 'bg-[var(--readiness-track)]'}`}
        />
      ))}
    </div>
  );
}

/** Orientation header (P5): where am I · how ready · what's done. Shared by the
 *  Spec and Analysis tabs; `meta` is the contextual right-aligned subline
 *  (Spec: "{done} of {total} moves done"; Analysis: the version caption). */
export function PanelHeader({ section, diagnostic, meta, onOpenSettings, settingsLabel }: { section: Section; diagnostic?: DiagnosticResult; meta?: ReactNode; onOpenSettings?: () => void; settingsLabel?: string }) {
  const summary = summarizeReadiness(diagnostic?.overallReadiness);
  return (
    <div className="px-[16px] pt-[16px] pb-[14px] border-b border-hld-border shrink-0">
      <div className="flex items-start gap-[10px]">
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[9px] tracking-[0.16em] uppercase text-hld-muted-text-2">Section</div>
          <div role="heading" aria-level={2} className="text-[15px] font-semibold tracking-[-0.01em] text-hld-text mt-[3px] leading-tight truncate">{section.title}</div>
        </div>
        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            title={settingsLabel ?? 'Settings'}
            aria-label={settingsLabel ?? 'Settings'}
            className="hld-tool shrink-0 -mr-[2px] text-hld-muted-text-2 hover:text-hld-cyan transition-colors"
          >
            <Settings size={14} />
          </button>
        )}
      </div>
      <div className="mt-[12px] flex items-center gap-[10px]">
        <ReadinessMeter summary={summary} />
        {summary.diagnosed && (
          <span className="font-mono text-[11px] tracking-[0.12em] uppercase font-semibold text-hld-text">
            {summary.label}
          </span>
        )}
        {meta != null && <span className="ml-auto min-w-0 truncate text-[11px] text-hld-muted-text-2">{meta}</span>}
      </div>
    </div>
  );
}
