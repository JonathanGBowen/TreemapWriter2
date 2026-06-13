// Resolution order for "which model runs this call".
//
//   1. per-project per-kind override   (project's models.json)
//   2. global per-kind default          (app preferences; the "default model"
//      knob writes one ModelChoice across all kinds)
//   3. built-in DEFAULT_MODEL_CONFIG    (reproduces pre-refactor behavior)
//
// Keeping this in one pure function means every call site resolves identically
// and it is trivially unit-testable.

import type { AICallKind, ModelChoice, ModelConfig } from './model-types';
import { DEFAULT_MODEL_CONFIG } from './model-config';

export function resolveModelChoice(
  kind: AICallKind,
  projectConfig: ModelConfig | null | undefined,
  globalDefault: ModelConfig | null | undefined,
): ModelChoice {
  return (
    projectConfig?.[kind] ??
    globalDefault?.[kind] ??
    DEFAULT_MODEL_CONFIG[kind]
  );
}
