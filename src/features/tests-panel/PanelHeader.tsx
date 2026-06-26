import type { ReactNode } from "react";
import { Settings } from "lucide-react";
import type { Section, DiagnosticResult } from "../../types";
import { READINESS, type ReadinessInfo } from "./diagnostic-config";

/** Four readiness diamonds, filled to `level`; hollow ◇◇◇◇ when undiagnosed.
 *  The diamonds carry the hue; the label beside them stays monochrome (P4). */
function ReadinessMeter({ readiness }: { readiness: ReadinessInfo | null }) {
  return (
    <div className="flex gap-[6px] shrink-0">
      {[0, 1, 2, 3].map((i) => {
        const filled = readiness != null && i < readiness.level;
        return (
          <span
            key={i}
            className={`w-[8px] h-[8px] rotate-45 ${filled ? '' : 'border border-hld-muted'}`}
            style={filled ? { background: `var(--color-hld-${readiness!.pip})`, boxShadow: `0 0 6px var(--color-hld-${readiness!.pip})` } : undefined}
          />
        );
      })}
    </div>
  );
}

/** Orientation header (P5): where am I · how ready · what's done. Shared by the
 *  Spec and Analysis tabs; `meta` is the contextual right-aligned subline
 *  (Spec: "{done} of {total} moves done"; Analysis: the version caption). */
export function PanelHeader({ section, diagnostic, meta, onOpenSettings, settingsLabel }: { section: Section; diagnostic?: DiagnosticResult; meta?: ReactNode; onOpenSettings?: () => void; settingsLabel?: string }) {
  const readiness = diagnostic ? READINESS[diagnostic.overallReadiness] : null;
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
            className="shrink-0 -mr-[2px] p-[2px] text-hld-muted-text-2 hover:text-hld-cyan transition-colors"
          >
            <Settings size={14} />
          </button>
        )}
      </div>
      <div className="mt-[12px] flex items-center gap-[10px]">
        <ReadinessMeter readiness={readiness} />
        {readiness && (
          <span className="font-mono text-[11px] tracking-[0.12em] uppercase font-semibold text-hld-text">
            {readiness.label}
          </span>
        )}
        {meta != null && <span className="ml-auto min-w-0 truncate text-[11px] text-hld-muted-text-2">{meta}</span>}
      </div>
    </div>
  );
}
