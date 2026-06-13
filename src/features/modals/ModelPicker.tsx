import React from 'react';
import { useStore } from '../../store';
import type { ModelChoice, ProviderId } from '../../services/ai/model-types';
import type { CatalogModel } from '../../services/ai/model-catalog';

const PROVIDER_LABEL: Record<ProviderId, string> = {
  gemini: 'Gemini',
  anthropic: 'Anthropic',
  ollama: 'Ollama (local)',
};
const PROVIDER_ORDER: ProviderId[] = ['gemini', 'anthropic', 'ollama'];

interface ModelPickerProps {
  value?: ModelChoice | null;
  /** Emits the chosen model, or null when the inherit option is picked. */
  onChange: (choice: ModelChoice | null) => void;
  /** If set, a leading option that clears the choice (emits null). */
  inheritLabel?: string;
  className?: string;
}

/**
 * The single model-selection control. Reads the editable catalog from the store
 * and emits a provider-tagged ModelChoice. Replaces the four duplicated MODELS
 * arrays that used to live in individual modals.
 */
export const ModelPicker: React.FC<ModelPickerProps> = ({
  value,
  onChange,
  inheritLabel,
  className,
}) => {
  const catalog = useStore((s) => s.modelCatalog);
  const current = value ? `${value.provider}:${value.model}` : '';

  const grouped: Record<ProviderId, CatalogModel[]> = {
    gemini: catalog.filter((m) => m.provider === 'gemini'),
    anthropic: catalog.filter((m) => m.provider === 'anthropic'),
    ollama: catalog.filter((m) => m.provider === 'ollama'),
  };

  return (
    <select
      value={current}
      onChange={(e) => {
        const v = e.target.value;
        if (!v) {
          onChange(null);
          return;
        }
        // Model ids can contain ':' (e.g. ollama "llama3.1:8b") — the provider
        // is only the first segment.
        const idx = v.indexOf(':');
        const provider = v.slice(0, idx) as ProviderId;
        const model = v.slice(idx + 1);
        const meta = catalog.find((m) => m.provider === provider && m.id === model);
        onChange({ provider, model, thinkingBudget: meta?.defaultThinkingBudget });
      }}
      className={
        className ??
        'bg-hld-surface2 border border-hld-border rounded px-2 py-1 text-[10px] font-mono uppercase tracking-widest text-hld-text outline-none focus:border-hld-cyan'
      }
    >
      {inheritLabel && <option value="">{inheritLabel}</option>}
      {PROVIDER_ORDER.map((p) =>
        grouped[p].length ? (
          <optgroup key={p} label={PROVIDER_LABEL[p]}>
            {grouped[p].map((m) => (
              <option key={`${p}:${m.id}`} value={`${p}:${m.id}`}>
                {m.displayName}
              </option>
            ))}
          </optgroup>
        ) : null,
      )}
    </select>
  );
};
