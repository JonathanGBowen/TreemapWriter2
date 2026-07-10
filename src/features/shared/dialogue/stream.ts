// Shared dialogue streaming — the one home for the consume-stream / partial-commit /
// in-flight-mutex idiom that every conversational surface used to hand-copy. The
// guard set is module-level (not hook state) so a stream started before a remount
// still blocks a second concurrent send (the use-analysis-actions lesson).

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { notifyAiError } from '../ai-error';

const inFlight = new Set<string>();

/** True while a dialogue turn streams under this key (survives remounts). */
export const dialogueInFlight = (key: string): boolean => inFlight.has(key);

export const dialogueErrMessage = (e: unknown): string =>
  e instanceof Error ? e.message : 'Check API key or try again';

export interface ConsumeCallbacks {
  /** Fed the accumulated text as each chunk lands (drives the live bubble). */
  onProgress: (text: string) => void;
  /** Lands the reply: the full text on success, any partial on error when `commitPartial`. */
  onCommit: (text: string) => void;
  /** The stream finished cleanly but yielded nothing. */
  onEmpty: () => void;
  /** The stream threw; `partial` is whatever had streamed before the failure. */
  onError: (e: unknown, partial: string) => void;
  /** Commit partial text on failure (default true — never discard streamed tokens). */
  commitPartial?: boolean;
}

/**
 * Core turn semantics, React-free (unit-tested): accumulate → commit full on
 * success; on error commit the partial (unless opted out) and report; error text
 * never enters the transcript.
 */
export async function consumeDialogueStream(
  stream: AsyncIterable<string>,
  cb: ConsumeCallbacks,
): Promise<void> {
  let partial = '';
  try {
    for await (const chunk of stream) {
      partial += chunk;
      cb.onProgress(partial);
    }
    if (partial) cb.onCommit(partial);
    else cb.onEmpty();
  } catch (e) {
    if ((cb.commitPartial ?? true) && partial) cb.onCommit(partial);
    cb.onError(e, partial);
  }
}

export interface RunTurnArgs {
  /** Mutex + live-bubble key: a section id, or a stable surface name. */
  key: string;
  stream: AsyncIterable<string>;
  /** Lands the reply (full on success; partial on error when `commitPartial`). */
  onCommit: (text: string) => void;
  /** Replaces the default notifyAiError toast (e.g. an inline error line). */
  onError?: (e: unknown, partial: string) => void;
  /** Commit any partial text on failure (default true). */
  commitPartial?: boolean;
  /** Toast shown when the model returns no text at all. */
  emptyMessage?: string;
}

/**
 * One streamed model turn behind a per-key mutex, with the accumulated text
 * exposed as `streaming` for the live bubble. Callers persist the user turn
 * BEFORE invoking (a crash loses only the regenerable reply) and check
 * `dialogueInFlight(key)` in any sibling action that must not race the stream.
 */
export function useDialogueStream() {
  const [streaming, setStreaming] = useState<{ key: string; text: string } | null>(null);

  const runTurn = useCallback(async (args: RunTurnArgs): Promise<void> => {
    const { key } = args;
    if (inFlight.has(key)) return;
    inFlight.add(key);
    setStreaming({ key, text: '' });
    try {
      await consumeDialogueStream(args.stream, {
        onProgress: (text) => setStreaming({ key, text }),
        onCommit: args.onCommit,
        onEmpty: () => toast.error(args.emptyMessage ?? 'Dialogue returned no text.'),
        onError:
          args.onError ??
          ((e) => notifyAiError(e, `Dialogue failed: ${dialogueErrMessage(e)}`)),
        commitPartial: args.commitPartial,
      });
    } finally {
      inFlight.delete(key);
      setStreaming((prev) => (prev?.key === key ? null : prev));
    }
  }, []);

  return { streaming, runTurn };
}
