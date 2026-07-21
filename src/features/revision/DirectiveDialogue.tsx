// Socratic directive extraction — a short, streaming inquiry-rule dialogue that
// converges on the pass's primary intent and hands one engine-ready directive to
// the directive box. Ephemeral by design (the transcript dies with the panel);
// renders through the shared dialogue kit, inline in the config column so the
// master document stays visible.

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Pip } from '../shared/Pip';
import { Bubble, Composer, TypingPulse, useDialogueStream } from '../shared/dialogue';
import { aiProvider } from '../../services/ai-provider-registry';
import { extractDirectiveFromTurn } from '../../lib/revision-helpers';
import { useStore } from '../../state';
import { useCurrentSection } from '../tests-panel/use-current-section';
import type { DialogueMessage } from '../../types';

const OPENING = 'What is pulling you to revise this — what feels wrong, or unfinished?';

/** Mutex/live-bubble key: one directive dialogue exists at a time, by design. */
const STREAM_KEY = 'directive-dialogue';

/** A model turn with its fenced directive block removed (shown in the confirm box instead). */
const bubbleText = (text: string): string =>
  text.replace(/```(?:json)?[\s\S]*?```/gi, '').trim() || 'The directive is ready below.';

interface DirectiveDialogueProps {
  onConfirm: (directive: string) => void;
  onClose: () => void;
}

export function DirectiveDialogue({ onConfirm, onClose }: DirectiveDialogueProps) {
  const currentSection = useCurrentSection();
  const [messages, setMessages] = useState<DialogueMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saveToLibrary, setSaveToLibrary] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { streaming: liveTurn, runTurn } = useDialogueStream();
  const streaming = liveTurn?.key === STREAM_KEY;
  const streamedText = streaming ? liveTurn.text : '';

  const hasUserTurn = messages.some((m) => m.role === 'user');

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, streaming, streamedText.length, finalizing]);

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || streaming || !currentSection) return;
    const next = [...messages, { role: 'user' as const, text }];
    setMessages(next);
    setError(null);
    const st = useStore.getState();
    const sourceSummaries = st.sources
      .filter((s) => st.selectedSourceIds.includes(s.id))
      .map((s) => ({ label: s.label, role: s.role }));
    await runTurn({
      key: STREAM_KEY,
      stream: aiProvider.directiveDialogueTurn({
        sectionTitle: currentSection.title,
        sectionText: currentSection.fullContent,
        mode: st.revisionMode,
        sourceSummaries,
        currentDirective: st.directive,
        messages: next,
        config: st.promptsConfig,
      }),
      // The transcript is ephemeral; a half-streamed reply is noise, not data.
      commitPartial: false,
      onCommit: (acc) => {
        setMessages((m) => [...m, { role: 'model', text: acc }]);
        // The partner signals convergence with a fenced {directive} block — when it
        // lands, move straight to the confirm box (prefilled, still editable).
        const extracted = extractDirectiveFromTurn(acc);
        if (extracted) {
          setDraft(extracted);
          setFinalizing(true);
        }
      },
      onError: (e) => {
        console.error('[DirectiveDialogue] turn failed', e);
        setError('Partner unavailable — type the directive directly in the box above.');
      },
    });
  };

  const beginFinalize = () => {
    const lastModel = [...messages].reverse().find((m) => m.role === 'model');
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    setDraft((lastModel && extractDirectiveFromTurn(lastModel.text)) || lastUser?.text || '');
    setFinalizing(true);
  };

  const confirm = () => {
    const directive = draft.trim();
    if (!directive) return;
    if (saveToLibrary) {
      const words = directive.split(/\s+/);
      const label = words.slice(0, 6).join(' ') + (words.length > 6 ? '…' : '');
      useStore
        .getState()
        .setRevisionInstructions((prev) => [
          ...prev,
          { id: `instr_${Date.now()}`, label, body: directive },
        ]);
    }
    onConfirm(directive);
  };

  return (
    <div className="flex flex-col gap-2.5 border border-hld-cyan/30 bg-hld-cyan/[0.03] p-2.5">
      <div className="flex items-center justify-between">
        <div className="font-mono uppercase tracking-[0.14em] text-[9px] text-hld-cyan">
          ⟡ find the directive
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialogue"
          className="text-hld-muted-text hover:text-hld-text transition-colors"
        >
          <X size={12} />
        </button>
      </div>

      <div ref={scrollRef} className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
        <Bubble message={{ role: 'model', text: OPENING }} />
        {messages.map((m, idx) => (
          <Bubble key={idx} message={m.role === 'model' ? { ...m, text: bubbleText(m.text) } : m} />
        ))}
        {streaming && (streamedText ? <Bubble message={{ role: 'model', text: bubbleText(streamedText) }} /> : <TypingPulse />)}
      </div>

      {error && (
        <div className="text-[11px] text-hld-yellow bg-hld-yellow/10 border border-hld-yellow/30 px-2.5 py-1.5">
          {error}
        </div>
      )}

      {finalizing ? (
        <div className="flex flex-col gap-2 border border-hld-cyan/30 bg-hld-cyan/[0.04] p-2.5">
          <div className="font-mono text-[9px] tracking-[0.14em] uppercase text-hld-cyan">
            The directive
          </div>
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            className="w-full bg-hld-bg border border-hld-border text-hld-text font-mono text-[12px] leading-[1.5] px-2.5 py-2 outline-none focus:border-hld-cyan/40 resize-none"
          />
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setFinalizing(false)}
              className="bg-transparent border border-hld-border text-hld-muted-text hover:text-hld-text font-mono text-[9px] tracking-[0.12em] uppercase px-2.5 py-1.5 transition-colors"
            >
              ← Keep talking
            </button>
            <button
              type="button"
              onClick={() => setSaveToLibrary((v) => !v)}
              aria-pressed={saveToLibrary}
              title="Also keep this as a reusable Instruction in the library"
              className="flex items-center gap-1.5 font-mono text-[8.5px] uppercase tracking-[0.1em] text-hld-muted-text hover:text-hld-cyan transition-colors"
            >
              <Pip status={saveToLibrary ? 'cyan' : 'idle'} size="sm" live={saveToLibrary} />
              save to library
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={!draft.trim()}
              className="ml-auto px-3 py-1.5 border border-hld-cyan/40 text-hld-cyan hover:bg-hld-cyan/10 disabled:opacity-40 disabled:cursor-not-allowed font-mono text-[9px] font-bold uppercase tracking-[0.12em] transition-colors"
            >
              Use this directive →
            </button>
          </div>
        </div>
      ) : (
        <Composer
          canSend={!streaming && !!currentSection}
          onSend={(text) => void send(text)}
          placeholder="Answer the partner…"
          trailing={
            <button
              type="button"
              onClick={beginFinalize}
              disabled={!hasUserTurn || streaming}
              title="Distill the conversation into the directive now"
              className="px-2.5 border border-hld-border text-hld-muted-text hover:text-hld-cyan hover:border-hld-cyan/40 font-mono text-[9px] uppercase tracking-[0.1em] transition-colors disabled:opacity-35 disabled:cursor-not-allowed shrink-0"
            >
              Use this →
            </button>
          }
        />
      )}
    </div>
  );
}
