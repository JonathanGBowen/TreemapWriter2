import { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { resolveModelChoice } from '../../services/ai/resolve-model-choice';
import type { AICallKind, ModelChoice } from '../../services/ai/model-types';

/**
 * Local model-choice state for a flow modal. Flow modals are mounted
 * unconditionally (they self-gate via an early `return null`), so a bare
 * `useState` initializer would freeze the choice at app-boot — before prefs
 * hydrate or a project loads. This re-resolves from the live config every time
 * the modal opens, so the picker always reflects the configured model. One
 * shared hook keeps all four flow modals consistent.
 */
export function useModelChoice(
  kind: AICallKind,
  isOpen: boolean,
): [ModelChoice, (choice: ModelChoice) => void] {
  const [choice, setChoice] = useState<ModelChoice>(() => {
    const s = useStore.getState();
    return resolveModelChoice(kind, s.modelConfig, s.globalModelDefault);
  });

  useEffect(() => {
    if (!isOpen) return;
    const s = useStore.getState();
    setChoice(resolveModelChoice(kind, s.modelConfig, s.globalModelDefault));
  }, [isOpen, kind]);

  return [choice, setChoice];
}
