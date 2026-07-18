import React from 'react';
import { useStore } from '../../../store';
import type { ModelChoice, ProviderId } from '../../../services/ai/model-types';
import type { CatalogModel } from '../../../services/ai/model-catalog';

const PROVIDER_LABEL: Record<ProviderId, string> = {
  gemini: 'Gemini',
  anthropic: 'Anthropic',
  ollama: 'Ollama (local)',
  'agent-sdk': 'Claude Agent SDK',
};
const PROVIDER_ORDER: ProviderId[] = ['gemini', 'anthropic', 'ollama', 'agent-sdk'];

interface ModelPickerProps {
  value?: ModelChoice | null;
  /** Emits the chosen model, or null when the inherit option is picked. */
  onChange: (choice: ModelChoice | null) => void;
  /** If set, a leading option that clears the choice (emits null). */
  inheritLabel?: string;
  /** Restrict the picker to these providers (e.g. ['agent-sdk']). Omitted ⇒ all. */
  providers?: ProviderId[];
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
  providers,
  className,
}) => {
  const catalog = useStore((s) => s.modelCatalog);
  const order = providers ? PROVIDER_ORDER.filter((p) => providers.includes(p)) : PROVIDER_ORDER;
  const current = value ? `${value.provider}:${value.model}` : '';
  // The selected model may not be in the catalog (Ollama server offline, model
  // removed, or hand-edited config). Without a matching <option> the browser
  // would show the wrong row while state holds the real choice — so surface it.
  const isOrphan = !!value && !catalog.some((m) => m.provider === value.provider && m.id === value.model);

  const grouped: Record<ProviderId, CatalogModel[]> = {
    gemini: catalog.filter((m) => m.provider === 'gemini'),
    anthropic: catalog.filter((m) => m.provider === 'anthropic'),
    ollama: catalog.filter((m) => m.provider === 'ollama'),
    'agent-sdk': catalog.filter((m) => m.provider === 'agent-sdk'),
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
        'bg-hld-surface-2 border border-hld-border rounded px-2 py-1 text-[10px] font-mono uppercase tracking-widest text-hld-text outline-none focus:border-hld-cyan'
      }
    >
      {inheritLabel && <option value="">{inheritLabel}</option>}
      {isOrphan && value && (
        <option value={current}>
          {value.provider}: {value.model} (unavailable)
        </option>
      )}
      {order.map((p) =>
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
