// Living Sprints — the Guided Runner (Direction B), the centerpiece. The move's
// anatomy: overall-progress + magenta time bars; a header (eyebrow · Move N of M
// · §ref · controls); a 2-column body (giant countdown + MOVE + instruction
// checklist + editor | the Sequence rail); a strict-auto-advance footer. The
// reinstate move shows the ReinstatePanel in place of the editor. Cues (ambient
// hue + ding) are off by default and reduced-motion aware.

import { useEffect, useRef, useState } from 'react';
import { Music, Pause, Play, Plus, X } from 'lucide-react';
import type { Section, SprintPlan } from '../../../types';
import type { Reinstatement } from '../../../lib/reinstate';
import { formatClock } from '../../../lib/sprintPlan';
import { hexA, roleHue } from '../../../lib/sprintRoles';
import { useReducedMotion } from '../topo/useReducedMotion';
import { useSprintEngine } from './use-sprint-engine';
import { useSprintCues } from './use-sprint-cues';
import { SprintEditor } from './SprintEditor';
import { SprintSequenceRail } from './SprintSequenceRail';
import { ReinstatePanel } from './ReinstatePanel';

interface SprintRunnerProps {
  plan: SprintPlan;
  mode: 'goal' | 'content';
  section: Section;
  reinstatement: Reinstatement;
  lastTouchedDays: number | null;
  initialText: string;
  onSave: (text: string) => void;
  onClose: () => void;
}

export function SprintRunner({
  plan,
  mode,
  section,
  reinstatement,
  lastTouchedDays,
  initialText,
  onSave,
  onClose,
}: SprintRunnerProps) {
  const [text, setText] = useState(initialText);
  const textRef = useRef(initialText);
  textRef.current = text;

  const reduced = useReducedMotion();
  const cues = useSprintCues();
  const panelRef = useRef<HTMLDivElement>(null);

  const engine = useSprintEngine({
    plan,
    running: true,
    getBuffer: () => textRef.current,
    onPersist: (t) => onSave(t),
    onComplete: () => {
      onSave(textRef.current);
      onClose();
    },
    onDing: cues.ding,
  });

  const move = engine.move ?? plan.moves[0];
  const total = plan.moves.length;
  const isReinstate = move.role === 'reinstate';
  const isLast = engine.moveIndex >= total - 1;
  const accentHex = mode === 'content' ? '#f59e0b' : '#00e8f5';
  const moveHue = roleHue(move.role);

  const moveMs = move.durationSec * 1000;
  const timeFrac = moveMs > 0 ? Math.max(0, engine.timeLeftMs / moveMs) : 0;
  const overall = ((engine.moveIndex + (1 - timeFrac)) / total) * 100;

  // Brightness flash at each transition — the one "moment of consequence" juice.
  // Off when cues are off; disabled under reduced-motion.
  useEffect(() => {
    if (engine.moveIndex === 0 || !cues.cuesOn || reduced) return;
    panelRef.current?.animate(
      [{ filter: 'brightness(1.6)' }, { filter: 'brightness(1)' }],
      { duration: 420, easing: 'ease-out' },
    );
  }, [engine.moveIndex, cues.cuesOn, reduced]);

  const exit = () => {
    onSave(textRef.current);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) exit();
      }}
    >
      <div
        ref={panelRef}
        className="relative w-full max-w-5xl h-[86vh] min-h-[480px] flex flex-col bg-hld-bgDeep border border-hld-border overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Reactive ambient hue — only when cues are on (transition CSS-gated by reduced-motion). */}
        <div
          className="sprint-ambient pointer-events-none absolute inset-0 z-0"
          style={{
            background: cues.cuesOn
              ? `radial-gradient(ellipse 70% 80% at 25% 30%, ${hexA(moveHue, 0.14)} 0%, transparent 70%), radial-gradient(ellipse 50% 60% at 90% 90%, ${hexA(moveHue, 0.1)} 0%, transparent 70%)`
              : 'transparent',
          }}
        />

        {/* Overall progress + magenta time bar */}
        <div className="relative z-[2] h-[3px] bg-hld-bg">
          <div
            className="absolute top-0 left-0 h-full transition-[width] duration-300"
            style={{ width: `${overall}%`, background: accentHex, boxShadow: `0 0 10px ${accentHex}` }}
          />
        </div>
        <div className="relative z-[2] h-[2px] bg-[#1a0a13]">
          <div
            className="absolute top-0 left-0 h-full bg-hld-magenta transition-[width] duration-100"
            style={{ width: `${timeFrac * 100}%`, boxShadow: '0 0 10px rgba(255,16,96,0.8)' }}
          />
        </div>

        {/* Header */}
        <div className="relative z-[2] flex items-center justify-between px-[16px] py-[12px] border-b border-hld-border">
          <div className="flex flex-col gap-[3px] min-w-0">
            <span className="font-mono text-[9px] tracking-[0.18em] uppercase opacity-80" style={{ color: accentHex }}>
              {isReinstate ? 'Reinstate // Auto' : `${mode === 'content' ? 'Content' : 'Goal'} Sprint // Guided`}
            </span>
            <span className="font-mono text-[11px] text-hld-muted-text truncate">
              Move {engine.moveIndex + 1} of {total} · {section.title}
            </span>
          </div>
          <div className="flex items-center gap-[8px] shrink-0">
            <ToolBtn onClick={() => engine.addMinutes(2)} label="+2 min">
              <Plus size={11} /> 2m
            </ToolBtn>
            <ToolBtn onClick={engine.togglePause} label={engine.paused ? 'Resume' : 'Pause'}>
              {engine.paused ? <Play size={11} /> : <Pause size={11} />}
            </ToolBtn>
            <ToolBtn onClick={cues.toggleCues} label="Toggle cues" on={cues.cuesOn}>
              <Music size={11} /> {cues.cuesOn ? 'On' : 'Off'}
            </ToolBtn>
            <ToolBtn onClick={exit} label="Exit sprint">
              <X size={12} />
            </ToolBtn>
          </div>
        </div>

        {/* Body: countdown + move + checklist + editor | rail */}
        <div className="relative z-[2] flex-1 grid grid-cols-1 md:grid-cols-[1.55fr_1fr] grid-rows-[minmax(0,1fr)] min-h-0">
          <div className="flex flex-col min-h-0 p-[18px]">
            <div
              className="sprint-clock font-mono text-[64px] font-light leading-none text-white tabular-nums"
              style={{ textShadow: `0 0 24px ${hexA(moveHue, 0.18)}` }}
            >
              {formatClock(engine.timeLeftMs / 1000)}
            </div>
            <div className="flex items-center gap-[10px] mt-[14px]">
              <span style={{ background: moveHue }} className="inline-block w-[8px] h-[8px] rotate-45 shrink-0" />
              <h2 className="text-[22px] font-extrabold text-white uppercase tracking-tight leading-none">
                {move.title}
              </h2>
            </div>
            <div className="flex flex-col gap-[9px] mt-[14px] mb-[14px]">
              {move.instructions.map((line, i) => (
                <div key={i} className="flex gap-[10px] text-[12.5px] leading-snug text-hld-text">
                  <span
                    style={{ background: moveHue }}
                    className="inline-block w-[6px] h-[6px] rotate-45 shrink-0 mt-[5px]"
                  />
                  <span>{line}</span>
                </div>
              ))}
            </div>
            {isReinstate ? (
              <ReinstatePanel reinstatement={reinstatement} lastTouchedDays={lastTouchedDays} />
            ) : (
              <SprintEditor value={text} onChange={setText} onSubmit={engine.advance} />
            )}
          </div>
          <SprintSequenceRail moves={plan.moves} currentIndex={engine.moveIndex} />
        </div>

        {/* Strict-auto-advance note + manual advance (Begin / Next / Finish) */}
        <div className="relative z-[2] flex items-center justify-between gap-[12px] px-[16px] py-[9px] border-t border-hld-border bg-hld-bg/60">
          <span className="flex items-center gap-[9px] font-mono text-[9.5px] tracking-[0.08em] uppercase text-hld-muted-text">
            <span className="text-hld-magenta">⏻</span>
            Strict auto-advance — the timer forces the transition. No perfecting one move.
          </span>
          <button
            type="button"
            onClick={engine.advance}
            className="bracketed hld-lit shrink-0 px-[18px] py-[8px] font-mono text-[10px] font-bold tracking-[0.14em] uppercase"
          >
            {isReinstate ? 'Begin →' : isLast ? 'Finish →' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ToolBtn({
  onClick,
  label,
  on = false,
  children,
}: {
  onClick: () => void;
  label: string;
  on?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex items-center gap-[5px] font-mono text-[9px] tracking-[0.1em] uppercase px-[8px] py-[5px] bg-hld-bgDeep border transition-colors ${
        on ? 'text-hld-green border-hld-green/40' : 'text-hld-muted-text border-hld-border hover:text-hld-text'
      }`}
    >
      {children}
    </button>
  );
}
