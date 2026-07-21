import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useStore } from '../../../state';
import { countWords } from '../../../lib/utils';
import { latestCarryForward } from '../../../lib/activity-brief';
import { useReentryOpening } from '../../coach/use-reentry-opening';
import type { CarryForward, SessionGoal, SessionStep } from '../../../types';
import { ModalShell } from '../shared/ModalShell';

/**
 * The session ceremony as a single flat modal — a skeletal check-in / check-out
 * (the full GMT/GROW ceremony is a later Feature 1 build). Self-mounting: it
 * subscribes to its own `showSessionModal` flag and renders nothing when closed.
 *
 * Which face it shows depends on whether a session is running: no active session
 * → check-in (set the Wish, optional WOOP + steps); active session → check-out
 * (review steps, see the word delta, capture a next-action for anything
 * unfinished). Warm and non-judgmental throughout; leaving is never blocked.
 */

let stepSeq = 0;
const newStepId = () => `step_${Date.now()}_${stepSeq++}`;

function CheckIn({ onClose }: { onClose: () => void }) {
  const startSession = useStore((s) => s.startSession);
  const sessionLog = useStore((s) => s.sessionLog);
  const loadSessions = useStore((s) => s.loadSessions);
  const prefill = useStore((s) => s.sessionPrefill);
  const setSessionPrefill = useStore((s) => s.setSessionPrefill);
  const openReentry = useReentryOpening();
  const [wish, setWish] = useState(prefill?.wish ?? '');
  const [outcome, setOutcome] = useState('');
  const [obstacle, setObstacle] = useState('');
  const [plan, setPlan] = useState('');
  const [stepsText, setStepsText] = useState(prefill?.firstStep ?? '');
  const [committing, setCommitting] = useState(false);

  // Consume a one-shot prefill handed off from a re-entry dialogue deposit.
  useEffect(() => {
    if (prefill) setSessionPrefill(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The last checked-out session's carry-forward — the app's own gap-capture,
  // re-surfaced here so returning writers meet where they left off (deterministic,
  // no AI). Ensure the records are loaded.
  useEffect(() => {
    if (sessionLog.length === 0) void loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const carry = useMemo(() => latestCarryForward(sessionLog), [sessionLog]);

  const begin = async () => {
    if (!wish.trim() || committing) return;
    setCommitting(true);
    const goal: SessionGoal = {
      wish: wish.trim(),
      outcome: outcome.trim() || null,
      obstacle: obstacle.trim() || null,
      plan: plan.trim() || null,
    };
    const steps: SessionStep[] = stepsText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((description) => ({
        id: newStepId(),
        description,
        estimatedMinutes: null,
        completed: false,
        implementationIntention: null,
      }));
    await startSession({ goal, steps, source: 'manual' });
    onClose();
  };

  return (
    <ModalShell
      eyebrow="Session · Check-in"
      title="What do you want to do this sitting?"
      sub="One wish is enough. Everything else is optional."
      onClose={onClose}
      onPrimary={begin}
      primaryLabel="Begin session"
      primaryDisabled={!wish.trim() || committing}
    >
      <div className="flex flex-col gap-4 font-mono text-[11px] text-hld-text">
        {/* Where you left off — carry-forward captured at the last check-out.
            Tap to make it the wish; the ⊕ takes it to a re-entry dialogue. */}
        {carry && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <div className="text-[9px] tracking-[0.1em] uppercase text-hld-muted-text">Where you left off</div>
              <button
                type="button"
                onClick={() => { onClose(); void openReentry(); }}
                title="Where was I? — a short dialogue over your recent activity"
                className="font-mono text-[9px] tracking-[0.1em] uppercase text-hld-muted-text hover:text-hld-cyan transition-colors"
              >
                ⊕ where was I?
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {carry.items.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setWish(c.nextAction)}
                  title="Make this the wish for this sitting"
                  className="text-left px-2 py-1.5 border border-hld-border hover:border-hld-cyan/50 text-hld-text hover:text-hld-cyan transition-colors"
                >
                  {c.nextAction}
                  {c.stepDescription && <span className="text-hld-muted-text"> · {c.stepDescription}</span>}
                </button>
              ))}
            </div>
          </div>
        )}
        <Field label="Wish — what do you want to accomplish?">
          <textarea
            autoFocus
            value={wish}
            onChange={(e) => setWish(e.target.value)}
            rows={2}
            placeholder="e.g. Draft the opening of the methods section"
            className={inputClass}
          />
        </Field>
        <Field label="Outcome — if it goes well, what will you have? (optional)">
          <textarea
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            rows={2}
            placeholder="A rough but complete first pass"
            className={inputClass}
          />
        </Field>
        <Field label="Obstacle — the main thing inside you that might get in the way? (optional)">
          <input
            value={obstacle}
            onChange={(e) => setObstacle(e.target.value)}
            placeholder="perfectionism · rereading · not knowing where to start"
            className={inputClass}
          />
        </Field>
        <Field label="Plan — if that comes up, then I will… (optional)">
          <input
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            placeholder={obstacle.trim() ? `If ${obstacle.trim()}, then I will…` : 'If [obstacle], then I will…'}
            className={inputClass}
          />
        </Field>
        <Field label="Steps — one per line (optional)">
          <textarea
            value={stepsText}
            onChange={(e) => setStepsText(e.target.value)}
            rows={3}
            placeholder={'Outline the three moves\nDraft move one\nStitch them together'}
            className={inputClass}
          />
        </Field>
      </div>
    </ModalShell>
  );
}

function CheckOut({ onClose }: { onClose: () => void }) {
  const session = useStore((s) => s.activeSession);
  const endSession = useStore((s) => s.endSession);
  const localContent = useStore((s) => s.localContent);
  const startTotal = useStore((s) => s.sessionStartTotalWords);
  const startedAt = useStore((s) => s.sessionStartedAt);

  const [done, setDone] = useState<Set<string>>(
    () => new Set((session?.steps ?? []).filter((st) => st.completed).map((st) => st.id)),
  );
  const [carry, setCarry] = useState<Record<string, string>>({});
  const [reflection, setReflection] = useState('');
  const [closing, setClosing] = useState(false);

  // Guard the rare interleaving where the session is cleared before unmount.
  if (!session) return null;

  const wordDelta = countWords(localContent) - startTotal;
  const minutes = startedAt ? Math.max(0, Math.round((Date.now() - startedAt) / 60000)) : 0;
  const incomplete = session.steps.filter((st) => !done.has(st.id));

  const close = async () => {
    if (closing) return;
    setClosing(true);
    const carryForward: CarryForward[] = incomplete
      .map((st) => ({ stepId: st.id, nextAction: (carry[st.id] ?? '').trim() }))
      .filter((c) => c.nextAction !== '');
    await endSession({
      completedStepIds: [...done],
      carryForward,
      reflection: reflection.trim() || null,
    });
    onClose();
  };

  return (
    <ModalShell
      eyebrow="Session · Check-out"
      title="Here's what happened this sitting"
      sub={session.goal.wish}
      onClose={onClose}
      onPrimary={close}
      primaryLabel="Close session"
      primaryDisabled={closing}
      widthClass="max-w-lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto bg-transparent border-none text-hld-muted-text hover:text-hld-text font-mono text-[9px] tracking-[0.12em] uppercase cursor-pointer transition-colors"
          >
            Leave running
          </button>
          <button
            type="button"
            onClick={close}
            disabled={closing}
            style={{ '--br-color': 'var(--color-hld-cyan)' } as CSSProperties}
            className="bracketed hld-lit px-[20px] py-[10px] font-mono text-[10px] font-bold tracking-[0.14em] uppercase disabled:opacity-40"
          >
            Close session
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4 font-mono text-[11px] text-hld-text">
        {/* Observational stats — accumulated evidence, never a score. */}
        <div className="flex gap-5 text-[10px] tracking-[0.08em] uppercase text-hld-muted-text">
          <span>
            <span className="text-hld-cyan">{wordDelta >= 0 ? '+' : ''}{wordDelta.toLocaleString()}</span> words
          </span>
          <span>
            <span className="text-hld-cyan">{done.size}/{session.steps.length}</span> steps
          </span>
          <span>
            <span className="text-hld-cyan">{minutes}</span> min
          </span>
        </div>

        {session.steps.length > 0 && (
          <Field label="Steps">
            <div className="flex flex-col gap-1.5">
              {session.steps.map((st) => (
                <label key={st.id} className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={done.has(st.id)}
                    onChange={(e) => {
                      const next = new Set(done);
                      if (e.target.checked) next.add(st.id);
                      else next.delete(st.id);
                      setDone(next);
                    }}
                    className="mt-0.5 accent-hld-cyan"
                  />
                  <span className={done.has(st.id) ? 'text-hld-muted-text line-through' : ''}>{st.description}</span>
                </label>
              ))}
            </div>
          </Field>
        )}

        {incomplete.length > 0 && (
          <Field label="What's the next concrete action for what's unfinished?">
            <div className="flex flex-col gap-2">
              {incomplete.map((st) => (
                <div key={st.id} className="flex flex-col gap-1">
                  <div className="text-[9px] text-hld-muted-text truncate">{st.description}</div>
                  <input
                    value={carry[st.id] ?? ''}
                    onChange={(e) => setCarry({ ...carry, [st.id]: e.target.value })}
                    placeholder="Next time, I'll start by…"
                    className={inputClass}
                  />
                </div>
              ))}
            </div>
          </Field>
        )}

        <Field label="Anything you want to note? (optional)">
          <textarea
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            rows={2}
            placeholder={
              session.goal.plan
                ? `You planned: "${session.goal.plan}" — did it come up?`
                : 'A line for future-you'
            }
            className={inputClass}
          />
        </Field>
      </div>
    </ModalShell>
  );
}

const inputClass =
  'w-full bg-hld-bg border border-hld-border px-2 py-1.5 font-mono text-[11px] text-hld-text placeholder:text-hld-muted-text/60 focus:border-hld-cyan/50 focus:outline-none resize-none';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[9px] tracking-[0.1em] uppercase text-hld-muted-text">{label}</div>
      {children}
    </div>
  );
}

export function SessionModal() {
  const isOpen = useStore((s) => s.showSessionModal);
  const setOpen = useStore((s) => s.setShowSessionModal);
  const hasActive = useStore((s) => s.activeSession !== null);
  const onClose = () => setOpen(false);

  if (!isOpen) return null;
  // CheckIn / CheckOut are distinct components, so flipping `hasActive`
  // remounts with fresh local state.
  return hasActive ? <CheckOut onClose={onClose} /> : <CheckIn onClose={onClose} />;
}
