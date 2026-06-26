import type { ReactNode } from "react";
import { Settings } from "lucide-react";
import type { Section, DiagnosticResult } from "../../types";
import { summarizeReadiness, type ReadinessSummary } from "./diagnostic-config";
import { Pip } from "../shared/Pip";

/** The ONE readiness encoder: four steps filled to `summary.filled`, hollow ◇◇◇◇
 *  when undiagnosed. Filled steps route through the canonical `Pip` (square, no
 *  rest glow — readiness is a static state); the wrapper carries a text label so
 *  colour is never the only channel (P4). */
function ReadinessMeter({ summary }: { summary: ReadinessSummary }) {
  return (
    <div className="flex gap-[6px] shrink-0" role="img" aria-label={`Readiness: ${summary.label}`}>
      {Array.from({ length: summary.total }).map((_, i) =>
        i < summary.filled ? (
          <Pip key={i} status={summary.pip} size="lg" />
        ) : (
          <span key={i} aria-hidden className="w-[8px] h-[8px] rotate-45 border border-hld-muted" />
        )
      )}
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
