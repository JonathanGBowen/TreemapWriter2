import { useMemo, useState } from 'react';
import { useStore } from '../../state';
import type { Section, SessionRecord } from '../../types';
import {
  accumulatedTotals,
  perNodeProgress,
  sessionDate,
  wordsOverTime,
} from './dashboardData';
import { WordsOverTimeChart } from './WordsOverTimeChart';

/** Build a `{ sectionId: title }` map from the live section tree. */
function titleMap(sections: Section[]): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (nodes: Section[]) => {
    for (const n of nodes) {
      out[n.id] = n.title;
      walk(n.children);
    }
  };
  walk(sections);
  return out;
}

const fmtWords = (n: number) => `${n >= 0 ? '+' : ''}${n.toLocaleString()}`;
const fmtDay = (day: string | null) =>
  day ? sessionDate(day).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

/**
 * The read-only Progress Dashboard body: accumulated totals, a cumulative
 * word-count trajectory, per-section attention, and the recent-sessions log.
 * Framed as evidence — no streaks, no targets, no pass/fail color.
 */
export function DashboardReport() {
  const sessions = useStore((s) => s.sessionLog);
  const sections = useStore((s) => s.sections);
  const ledger = useStore((s) => s.ledger);
  const titles = useMemo(() => titleMap(sections), [sections]);

  const ledgerPaid = ledger.filter((e) => e.status === 'paid').length;
  const totals = useMemo(() => accumulatedTotals(sessions), [sessions]);
  const nodes = useMemo(() => perNodeProgress(sessions).slice(0, 12), [sessions]);
  const series = useMemo(() => wordsOverTime(sessions), [sessions]);

  return (
    <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8 max-w-4xl mx-auto w-full">
      {/* Accumulated totals — evidence, not a report card. */}
      <section className="flex flex-col gap-3">
        <p className="font-mono text-[11px] text-hld-muted-text">
          {totals.sessionCount === 0 ? (
            'Your sessions will accumulate here as evidence of the work you have done.'
          ) : (
            <>
              Since <span className="text-hld-text">{fmtDay(totals.firstSessionDay)}</span>, you have written{' '}
              <span className="text-hld-cyan">{fmtWords(totals.totalWordDelta)}</span> words across{' '}
              <span className="text-hld-text">{totals.sessionCount}</span>{' '}
              {totals.sessionCount === 1 ? 'session' : 'sessions'}.
            </>
          )}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Debts paid" value={ledgerPaid.toLocaleString()} />
          <Stat label="Sessions" value={totals.sessionCount.toLocaleString()} />
          <Stat label="Words (all time)" value={fmtWords(totals.totalWordDelta)} />
          <Stat label="Hours" value={totals.totalHours.toFixed(1)} />
        </div>
      </section>

      {/* Words over time. */}
      <section className="flex flex-col gap-2">
        <SectionLabel>Words over time</SectionLabel>
        <div className="border border-hld-border bg-hld-surface-3 p-2">
          <WordsOverTimeChart points={series} />
        </div>
      </section>

      {/* Per-node attention. */}
      {nodes.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionLabel>Where the work went</SectionLabel>
          <div className="flex flex-col">
            {nodes.map((n) => (
              <div key={n.nodeId} className="flex items-baseline justify-between gap-3 py-1.5 border-b border-hld-border/40">
                <span className="font-mono text-[11px] text-hld-text truncate">
                  {titles[n.nodeId] ?? n.nodeId}
                </span>
                <span className="font-mono text-[10px] text-hld-muted-text shrink-0">
                  <span className="text-hld-cyan">{fmtWords(n.words)}</span> words ·{' '}
                  {n.sessions} {n.sessions === 1 ? 'session' : 'sessions'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent sessions. */}
      <section className="flex flex-col gap-2">
        <SectionLabel>Recent sessions</SectionLabel>
        {sessions.length === 0 ? (
          <p className="font-mono text-[10px] tracking-[0.1em] uppercase text-hld-muted-text py-4">
            No sessions yet
          </p>
        ) : (
          <div className="flex flex-col">
            {sessions.map((s) => (
              <SessionRow key={s.id} session={s} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-hld-border bg-hld-surface-3 px-3 py-2.5">
      <div className="font-mono text-[16px] text-hld-text leading-tight">{value}</div>
      <div className="font-mono text-[8px] tracking-[0.12em] uppercase text-hld-muted-text mt-1">{label}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[9px] tracking-[0.16em] uppercase text-hld-muted-text">{children}</div>
  );
}

function SessionRow({ session }: { session: SessionRecord }) {
  const [open, setOpen] = useState(false);
  const stepsDone = session.steps.filter((st) => st.completed).length;
  const date = sessionDate(session.id).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className="border-b border-hld-border/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-baseline justify-between gap-3 py-2 text-left hover:bg-hld-cyan/[0.03] transition-colors"
      >
        <span className="min-w-0 flex items-baseline gap-2">
          <span className="font-mono text-[9px] text-hld-muted-text shrink-0 w-[92px]">{date}</span>
          <span className="font-mono text-[11px] text-hld-text truncate">{session.goal.wish}</span>
          {session.source === 'sprint' && (
            <span className="font-mono text-[8px] tracking-[0.1em] uppercase text-hld-muted-text shrink-0">sprint</span>
          )}
        </span>
        <span className="font-mono text-[10px] text-hld-muted-text shrink-0">
          {session.steps.length > 0 && <>{stepsDone}/{session.steps.length} · </>}
          <span className="text-hld-cyan">{fmtWords(session.wordDelta)}</span> · {session.durationMinutes}m
        </span>
      </button>
      {open && (
        <div className="pb-3 pl-[100px] pr-2 flex flex-col gap-2 font-mono text-[10px] text-hld-muted-text">
          {session.goal.obstacle && (
            <div>Obstacle: <span className="text-hld-text">{session.goal.obstacle}</span></div>
          )}
          {session.goal.plan && (
            <div>Plan: <span className="text-hld-text">{session.goal.plan}</span></div>
          )}
          {session.steps.length > 0 && (
            <div className="flex flex-col gap-0.5">
              {session.steps.map((st) => (
                <div key={st.id} className={st.completed ? 'text-hld-text' : ''}>
                  {st.completed ? '✓' : '○'} {st.description}
                </div>
              ))}
            </div>
          )}
          {session.carryForward.length > 0 && (
            <div className="flex flex-col gap-0.5">
              <div className="text-hld-muted-text/70">Carried forward:</div>
              {session.carryForward.map((c) => (
                <div key={c.stepId} className="text-hld-text">→ {c.nextAction}</div>
              ))}
            </div>
          )}
          {session.reflection && <div className="italic">{session.reflection}</div>}
        </div>
      )}
    </div>
  );
}
