import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { X } from 'lucide-react';
import type { DialogueMessage } from '../../types';
import { useStore } from '../../state';
import { stripDepositBlock, type DialogueOpening } from '../../lib/dialogue-openings';
import { Bubble, Composer, TypingPulse } from '../shared/dialogue';
import { useOpeningDialogue, latestDeposit } from './use-opening-dialogue';

/** Depleting turn budget as diamond pips (HLD health-chunk idiom — state via shape). */
const TurnPips: React.FC<{ spent: number; budget: number }> = ({ spent, budget }) => (
  <span className="inline-flex items-center gap-[5px]" aria-hidden>
    {Array.from({ length: budget }, (_, i) => (
      <span
        key={i}
        className={`w-[5px] h-[5px] rotate-45 ${i < spent ? 'bg-hld-border' : 'bg-hld-cyan'}`}
      />
    ))}
  </span>
);

/** One exit chip — the lit way back into the manuscript. */
const ExitChip: React.FC<{ onClick: () => void; children: React.ReactNode; lit?: boolean; title?: string }> = ({
  onClick,
  children,
  lit,
  title,
}) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    style={lit ? ({ '--br-color': 'var(--color-hld-cyan)' } as CSSProperties) : undefined}
    className={
      lit
        ? 'bracketed hld-lit px-[14px] py-[10px] font-mono uppercase tracking-[0.12em] text-[10px] font-bold'
        : 'px-[12px] py-[9px] border border-hld-border text-hld-muted-text-2 font-mono uppercase tracking-[0.12em] text-[9px] hover:text-hld-cyan hover:border-hld-cyan transition-colors'
    }
  >
    {children}
  </button>
);

export const OpeningDialogue: React.FC<{ opening: DialogueOpening }> = ({ opening }) => {
  const messages = useStore((s) => s.openingMessages);
  const currentMemo = useStore((s) => s.memorandum);
  const { send, applyDeposit, toSession, acceptMemorandum, dismiss, isStreaming, streamedText } =
    useOpeningDialogue();
  const [memoAccepted, setMemoAccepted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const spent = messages.filter((m) => m.role === 'user').length;
  const depleted = spent >= opening.turnBudget;
  const deposit = useMemo(() => latestDeposit(messages), [messages]);

  // Model turns render with their fenced deposit stripped (the chip shows it).
  const shown: DialogueMessage[] = useMemo(
    () => messages.map((m) => (m.role === 'model' ? { ...m, text: stripDepositBlock(m.text) || m.text } : m)),
    [messages],
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, isStreaming, streamedText.length, deposit]);

  // A refined turn may propose a DIFFERENT standing-intent note; re-arm the
  // accept when the proposed text changes so the newer revision is acceptable.
  useEffect(() => {
    setMemoAccepted(false);
  }, [deposit?.memorandum]);

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-hld-surface-3">
      {/* Focus banner: the occasion + turn budget + a quiet way out. */}
      <div className="mx-4 mt-4 mb-0 pl-[12px] pr-[10px] py-[11px] border-l-2 border-hld-cyan/40 bg-hld-cyan/[0.04] shrink-0 flex items-start justify-between gap-[10px]">
        <div className="min-w-0">
          <div className="text-[9px] font-mono uppercase tracking-[0.12em] text-hld-cyan mb-[5px]">{opening.label}</div>
          <TurnPips spent={spent} budget={opening.turnBudget} />
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close this dialogue"
          title="Close — nothing is saved from an opening except its deposit"
          className="text-hld-muted-text hover:text-hld-text transition-colors shrink-0"
        >
          <X size={13} />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-[12px]">
        {shown.map((m, i) => (
          <Bubble key={i} message={m} partnerLabel="Interlocutor" />
        ))}
        {isStreaming &&
          (streamedText ? (
            <Bubble message={{ role: 'model', text: stripDepositBlock(streamedText) || '…' }} partnerLabel="Interlocutor" />
          ) : (
            <TypingPulse />
          ))}
      </div>

      <div className="p-4 pt-0 flex flex-col gap-[10px] shrink-0">
        {deposit?.memorandum && deposit.memorandum.trim() !== currentMemo.trim() && (
          // A proposed Memorandum revision — default-skip, shown verbatim, one
          // quiet accept (the bounded-agency contract applied to memory, §IV).
          <div className="flex items-start gap-[8px] border border-hld-border bg-hld-surface-2/40 px-[10px] py-[8px]">
            <div className="min-w-0 flex-1">
              <div className="font-mono text-[8px] tracking-[0.12em] uppercase text-hld-muted-text mb-[4px]">
                Proposed memorandum
              </div>
              <div className="text-[11px] font-sans text-hld-text whitespace-pre-wrap line-clamp-4">
                {deposit.memorandum}
              </div>
            </div>
            <button
              type="button"
              disabled={memoAccepted}
              onClick={() => { acceptMemorandum(deposit.memorandum!); setMemoAccepted(true); }}
              className="shrink-0 self-center px-[10px] py-[6px] border border-hld-border text-hld-muted-text-2 font-mono uppercase tracking-[0.12em] text-[8px] hover:text-hld-cyan hover:border-hld-cyan transition-colors disabled:opacity-40"
              title="Save this as the standing-intent note (skip to ignore)"
            >
              {memoAccepted ? 'noted' : '✎ note it'}
            </button>
          </div>
        )}
        {deposit ? (
          // Converged: the exit outshines everything. The transcript stays
          // readable above; the way back into the prose is the only lit action.
          <div className="flex flex-wrap items-center gap-[8px]">
            <ExitChip
              lit
              title={
                deposit.goodEnough
                  ? 'Good enough for what the whole needs — move on'
                  : 'Land in the text and pick up the work'
              }
              onClick={() => applyDeposit(deposit)}
            >
              {deposit.goodEnough ? '→ good enough · move on' : '→ back to the text'}
            </ExitChip>
            {deposit.wish && (
              <ExitChip title="Start a session with this as the wish" onClick={() => toSession(deposit)}>
                → session
              </ExitChip>
            )}
          </div>
        ) : null}
        <Composer
          canSend={!isStreaming}
          onSend={(t) => void send(t)}
          autoFocus
          placeholder={depleted ? 'One more, if you need it…' : 'Answer the interlocutor…'}
        />
        {depleted && !deposit && (
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-hld-muted-text text-right">
            Ask for the deposit, or add one more turn.
          </div>
        )}
      </div>
    </div>
  );
};
