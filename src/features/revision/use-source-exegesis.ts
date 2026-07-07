import { useCallback, useRef, useState } from 'react';
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
 */
export const useSourceExegesis = () => {
  const [streaming, setStreaming] = useState('');
  const [running, setRunning] = useState(false);
  // One run at a time per hook instance (the editor modal targets one source).
  const busy = useRef(false);

  const run = useCallback(async (source: SourceDocument) => {
    if (busy.current) return;
    const { modelConfig, globalModelDefault, modelCatalog } = useStore.getState();
    const choice = resolveModelChoice('exegeteSource', modelConfig, globalModelDefault);
    if (
      !guardContextFit({
        catalog: modelCatalog,
        choice,
        text: source.content,
        what: 'This source',
        setting: 'Source exegesis',
      })
    ) {
      return;
    }

    busy.current = true;
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
      busy.current = false;
      setRunning(false);
      setStreaming('');
      useStore.getState().endOp(opId);
    }
  }, []);

  return { run, running, streaming };
};
