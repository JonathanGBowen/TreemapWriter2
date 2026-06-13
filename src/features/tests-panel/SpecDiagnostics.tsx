import React, { useState } from "react";
import {
  CheckCircle, AlertCircle, AlertTriangle, Circle, HelpCircle, Crosshair, Target,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SectionFunction, MoveResult, MoveStatus, DiagnosticResult, ReadinessLevel } from "../../types";
import { SECTION_FUNCTIONS } from "../../lib/constants";

// --- Status UI Helpers ---

export const STATUS_CONFIG: Record<MoveStatus, { icon: LucideIcon; color: string; bg: string; label: string }> = {
  present: {
    icon: CheckCircle,
    color: 'text-hld-green',
    bg: 'bg-hld-green/10 border-hld-green/30',
    label: 'Done'
  },
  partial: {
    icon: AlertTriangle,
    color: 'text-hld-yellow',
    bg: 'bg-hld-yellow/10 border-hld-yellow/30',
    label: 'Partial'
  },
  missing: {
    icon: Circle,
    color: 'text-hld-magenta',
    bg: 'bg-hld-magenta/10 border-hld-magenta/30',
    label: 'Missing'
  },
  unclear: {
    icon: HelpCircle,
    color: 'text-hld-purple',
    bg: 'bg-hld-purple/10 border-hld-purple/30',
    label: 'Unclear'
  },
};

const READINESS_CONFIG: Record<ReadinessLevel, { color: string; bg: string; label: string }> = {
  'draft': { color: 'text-hld-magenta', bg: 'bg-[#1a050f] border-hld-magenta', label: 'Draft' },
  'developing': { color: 'text-hld-yellow', bg: 'bg-[rgba(255,230,0,0.05)] border-hld-yellow', label: 'Developing' },
  'nearly-there': { color: 'text-hld-cyan', bg: 'bg-[rgba(0,232,245,0.05)] border-hld-cyan', label: 'Nearly There' },
  'solid': { color: 'text-hld-green', bg: 'bg-[rgba(0,232,112,0.05)] border-hld-green', label: 'Solid' },
};

export const FunctionBadge: React.FC<{ fn: SectionFunction }> = ({ fn }) => {
  const info = SECTION_FUNCTIONS.find(f => f.id === fn);
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-widest bg-hld-cyan/15 text-hld-cyan border border-hld-cyan/30" title={info?.desc}>
      <Target size={10} />
      {info?.label || fn}
    </span>
  );
};

const MoveResultCard: React.FC<{ result: MoveResult; index: number }> = ({ result, index }) => {
  const [expanded, setExpanded] = useState(result.status !== 'present');
  const config = STATUS_CONFIG[result.status];

  return (
    <div className="border bg-hld-surface2 border-hld-border p-[8px]">
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between cursor-pointer mb-[4px] border-b border-transparent hover:border-hld-border transition-colors pb-1"
      >
        <span className={`text-[9px] font-mono font-bold tracking-[0.14em] uppercase flex items-center gap-[4px] ${config.color}`}>
          <div className="w-[4px] h-[4px] bg-current rotate-45 shadow-[0_0_6px_currentColor]"></div>
          {config.label}
        </span>
        <span className="text-[7px] font-mono tracking-[0.14em] text-hld-muted uppercase">MOVE {index + 1}</span>
      </div>

      <div className="text-[10px] text-hld-text font-sans leading-[1.6]">
        {result.moveDescription}
      </div>

      {expanded && result.status !== 'present' && (
        <div className="mt-[6px] pt-[6px] border-t border-hld-border/50 animate-in fade-in duration-200 space-y-[6px]">
          {result.location && (
            <div className={`text-[10px] font-sans leading-[1.6] opacity-80 ${config.color}`}>
              <span className="font-mono text-[8px] uppercase tracking-[0.1em] mr-1">Where:</span>
              {result.location}
            </div>
          )}
          {result.diagnosis && (
            <div className={`text-[10px] font-sans leading-[1.6] opacity-80 ${config.color}`}>
               {result.diagnosis}
            </div>
          )}
          {result.suggestedAction && (
            <div className="mt-[8px] bg-[#121c2e] p-[8px] border border-hld-cyan/20">
              <span className="text-[7px] font-mono uppercase tracking-[0.15em] text-hld-cyan block mb-[2px]">ACTION</span>
              <div className="text-[10px] font-sans leading-[1.6] text-hld-cyan/90">
                 {result.suggestedAction}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/** The "=== DIAGNOSTIC RESULTS ===" block, extracted verbatim from TestsPanel. */
export const SpecDiagnostics: React.FC<{ diagnostic: DiagnosticResult }> = ({ diagnostic }) => (
  <div className="space-y-[14px] animate-in fade-in slide-in-from-bottom-4 duration-500 pt-[10px] mt-[10px] border-t border-hld-border">
    {/* Readiness Banner + Next Priority */}

    <div className="flex justify-between items-center mb-[8px] pb-[4px]">
      <div className="text-[10px] font-mono tracking-[0.15em] font-bold text-hld-text flex items-center gap-[6px]">
        <span className="text-hld-cyan">▰</span> DIAGNOSTICS
      </div>
      <div className={`text-[8px] font-mono tracking-[0.14em] font-bold uppercase ${READINESS_CONFIG[diagnostic.overallReadiness].color}`}>
        {READINESS_CONFIG[diagnostic.overallReadiness].label}
      </div>
    </div>

    <div className="space-y-[14px]">
      {/* Next Priority — the most important thing */}
      <div className="p-[10px] bg-[#0c1520] border border-hld-border">
        <div className="text-[7px] font-mono uppercase tracking-[0.15em] text-hld-cyan mb-[4px] flex items-center gap-1">
          <Crosshair size={10} /> Next Priority
        </div>
        <div className="text-[10px] text-hld-cyan/90 font-sans leading-[1.6]">
          {diagnostic.nextPriority}
        </div>
      </div>
    </div>

    {/* Move-by-Move Results */}
    <div className="space-y-[8px]">
      <div className="text-[7px] font-mono uppercase tracking-[0.15em] text-hld-muted">
        Move-by-Move Breakdown
      </div>
      {diagnostic.moveResults.map((result, i) => (
        <MoveResultCard key={result.moveId} result={result} index={i} />
      ))}
    </div>

    {/* Coherence Notes */}
    {diagnostic.coherenceNotes.length > 0 && (
      <div className="space-y-[8px]">
        <div className="text-[7px] font-mono uppercase tracking-[0.15em] text-hld-muted mb-[4px]">
          Coherence Notes
        </div>
        {diagnostic.coherenceNotes.map((note, i) => (
          <div key={i} className="text-[10px] bg-transparent p-[8px] border border-hld-border text-hld-text flex gap-[8px] font-sans leading-[1.6]">
            <AlertCircle size={12} className="text-hld-muted shrink-0 mt-0.5" />
            {note}
          </div>
        ))}
      </div>
    )}
  </div>
);
