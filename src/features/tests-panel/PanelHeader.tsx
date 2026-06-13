import type { Section, DiagnosticResult } from "../../types";
import { Pip } from "../shared/Pip";
import { READINESS, statusPip, type ReadinessInfo } from "./diagnostic-config";

/** Four readiness diamonds, filled to `level`; hollow ◇◇◇◇ when undiagnosed. */
function ReadinessPips({ readiness }: { readiness: ReadinessInfo | null }) {
  return (
    <div className="flex flex-col items-end gap-[4px] shrink-0">
      <div className="flex gap-[5px]">
        {[0, 1, 2, 3].map((i) => {
          const filled = readiness != null && i < readiness.level;
          return (
            <span
              key={i}
              className={`w-[7px] h-[7px] rotate-45 ${filled ? '' : 'border border-hld-muted'}`}
              style={filled ? { background: `var(--color-hld-${readiness!.pip})`, boxShadow: `0 0 6px var(--color-hld-${readiness!.pip})` } : undefined}
            />
          );
        })}
      </div>
      {readiness && (
        <span className="font-mono text-[8px] tracking-[0.14em] uppercase" style={{ color: `var(--color-hld-${readiness.pip})` }}>
          {readiness.label}
        </span>
      )}
    </div>
  );
}

/** Orientation header: where am I, how ready. Replaces the panel title + gear. */
export function PanelHeader({ section, status, diagnostic }: { section: Section; status: string; diagnostic?: DiagnosticResult }) {
  const readiness = diagnostic ? READINESS[diagnostic.overallReadiness] : null;
  return (
    <div className="px-[14px] py-[11px] border-b border-hld-border flex items-center gap-[10px] shrink-0">
      <Pip status={readiness ? readiness.pip : statusPip(status)} pulse={status === 'running'} />
      <div className="flex-1 min-w-0">
        <div className="font-mono text-[8px] tracking-[0.16em] uppercase text-hld-muted-text mb-[3px]">Section</div>
        <div className="font-mono text-[11px] font-bold tracking-[0.08em] uppercase truncate text-hld-text">{section.title}</div>
      </div>
      <ReadinessPips readiness={readiness} />
    </div>
  );
}
