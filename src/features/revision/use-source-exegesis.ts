import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useStore } from '../../state';
import { aiProvider } from '../../services/ai-provider-registry';
import { resolveModelChoice } from '../../services/ai/resolve-model-choice';
import { guardContextFit } from '../shared/context-guard';
import { notifyAiError } from '../shared/ai-error';
import { sourceContentHash } from '../../lib/source-edit';
import type { SourceDocument } from '../../types';

/**
 * Generate (or regenerate) the exegetical reconstruction of one source. Streams
 * into `streaming` while running (the visible-progress idiom); on completion the
 * result is persisted onto the source (`SourceDocument.exegesis`) with a content
 * hash for stale detection. A failure keeps any prior exegesis untouched.
 *
 * The duplicate-run guard is the store's `exegesisRunning` registry, NOT hook
 * state: the run outlives a closed editor modal, and a reopened one must still
 * see it (the live stream deliberately doesn't reattach across a remount — the
 * result lands via `updateSource` when the run completes).
 */
export const useSourceExegesis = () => {
  const [streaming, setStreaming] = useState('');
  const [running, setRunning] = useState(false);

  const run = useCallback(async (source: SourceDocument) => {
    const st = useStore.getState();
    if (st.exegesisRunning.includes(source.id)) return;
    // A bibliographic source is citation metadata (an APA entry + abstract) — a
    // full argument reconstruction of it could only be fabricated from the
    // model's prior knowledge of the work, then persist as a faithful stand-in.
    if (source.role === 'bibliographic') {
      toast.info('Metadata-only source — import the full text to reconstruct it.');
      return;
    }
    const choice = resolveModelChoice('exegeteSource', st.modelConfig, st.globalModelDefault);
    if (
      !guardContextFit({
        catalog: st.modelCatalog,
        choice,
        text: source.content,
        what: 'This source',
        setting: 'Source exegesis',
      })
    ) {
      return;
    }

    st.beginExegesisRun(source.id);
    setRunning(true);
    setStreaming('');
    const opId = useStore
      .getState()
      .beginOp({ label: `Reconstructing ${source.label}…`, workspace: 'revision' });
    try {
      let text = '';
      for await (const chunk of aiProvider.exegeteSource({
        label: source.label,
        role: source.role,
        content: source.content,
      })) {
        text += chunk;
        setStreaming(text);
      }
      const trimmed = text.trim();
      if (!trimmed) throw new Error('The model returned an empty reconstruction.');
      useStore.getState().updateSource(source.id, {
        exegesis: {
          content: trimmed,
          createdAt: Date.now(),
          sourceHash: sourceContentHash(source.content),
        },
      });
      void useStore.getState().saveCurrentState();
    } catch (e) {
      notifyAiError(e, 'Source exegesis failed — the existing reconstruction is untouched.');
    } finally {
      useStore.getState().endExegesisRun(source.id);
      setRunning(false);
      setStreaming('');
      useStore.getState().endOp(opId);
    }
  }, []);

  return { run, running, streaming };
};
