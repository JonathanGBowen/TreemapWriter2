import React, { useEffect, useState } from 'react';
import { Key, Server, Cpu, Plus, Trash2, ChevronDown, ChevronRight, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useStore } from '../../store';
import { getSecret, setSecret } from '../../services/credentials';
import {
  refreshGeminiKey,
  refreshAnthropicKey,
  detectOllamaModels,
} from '../../services/ai-provider-registry';
import { isTauri } from '../../services/tauri-environment';
import { AI_CALL_KINDS, AI_CALL_KIND_LABELS } from '../../services/ai/model-types';
import type { ModelChoice, ProviderId } from '../../services/ai/model-types';
import type { CatalogModel } from '../../services/ai/model-catalog';
import { isBuiltinModel, CUSTOM_MODEL_DESC } from '../../services/ai/model-catalog';
import { DisabledHint } from '../shared/DisabledHint';
import { ModelPicker } from './ModelPicker';
import { AgentSdkSettingsSection } from './AgentSdkSettingsSection';
import { LocalAgentSettingsSection } from './LocalAgentSettingsSection';
import { FallbackSettingsSection } from './FallbackSettingsSection';

/**
 * The AI configuration surface: provider keys/endpoint, the global default
 * model, and (collapsed) per-call overrides + the editable catalog. Keys live
 * in the OS keyring; the default/catalog/Ollama URL are global prefs; per-call
 * overrides are saved with the project. Rendered inside the settings modal.
 */
export const AiSettingsSection: React.FC = () => {
  const modelConfig = useStore((s) => s.modelConfig);
  const globalModelDefault = useStore((s) => s.globalModelDefault);
  const modelCatalog = useStore((s) => s.modelCatalog);
  const ollamaBaseUrl = useStore((s) => s.ollamaBaseUrl);
  const setModelConfig = useStore((s) => s.setModelConfig);
  const setGlobalModelDefault = useStore((s) => s.setGlobalModelDefault);
  const setModelCatalog = useStore((s) => s.setModelCatalog);
  const setOllamaBaseUrl = useStore((s) => s.setOllamaBaseUrl);
  const refreshOllamaCatalog = useStore((s) => s.refreshOllamaCatalog);
  const saveCurrentState = useStore((s) => s.saveCurrentState);

  const [advanced, setAdvanced] = useState(false);

  // The "default model" knob writes one choice across every call kind. Empty =
  // fall through to the built-in per-task recommendations.
  const defaultChoice = globalModelDefault[AI_CALL_KINDS[0]] ?? null;
  const setDefault = (choice: ModelChoice | null) => {
    if (!choice) {
      setGlobalModelDefault({});
      return;
    }
    const cfg = Object.fromEntries(AI_CALL_KINDS.map((k) => [k, choice]));
    setGlobalModelDefault(cfg);
  };

  const setKindOverride = (kind: (typeof AI_CALL_KINDS)[number], choice: ModelChoice | null) => {
    const next = { ...modelConfig };
    if (choice) next[kind] = choice;
    else delete next[kind];
    setModelConfig(next);
    void saveCurrentState();
  };

  return (
    <div className="space-y-4">
      <ProviderKeys
        ollamaBaseUrl={ollamaBaseUrl}
        onSaveOllamaUrl={(url) => {
          setOllamaBaseUrl(url);
          void refreshOllamaCatalog();
        }}
      />

      {/* Default model */}
      <div className="bg-hld-surface-2 border border-hld-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Cpu size={14} className="text-hld-cyan" />
          <h4 className="text-[10px] font-mono uppercase tracking-widest font-bold text-hld-text">
            Default Model
          </h4>
        </div>
        <p className="text-[11px] text-hld-muted leading-relaxed mb-3 font-sans">
          Applied to every AI call. Leave on Recommended to use sensible per-task defaults.
        </p>
        <ModelPicker
          value={defaultChoice}
          onChange={setDefault}
          inheritLabel="Recommended (per-task)"
          className="w-full bg-hld-bg border border-hld-border rounded px-2 py-2 text-[12px] font-mono text-hld-text outline-none focus:border-hld-cyan"
        />
      </div>

      {/* Quota fallback */}
      <FallbackSettingsSection />

      {/* Advanced */}
      <div className="bg-hld-surface-2 border border-hld-border rounded-lg">
        <button
          onClick={() => setAdvanced((v) => !v)}
          className="w-full flex items-center gap-2 p-4 text-[10px] font-mono uppercase tracking-widest font-bold text-hld-muted hover:text-hld-text transition-colors"
        >
          {advanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Advanced — per-task models &amp; catalog
        </button>

        {advanced && (
          <div className="px-4 pb-4 space-y-5 animate-in fade-in duration-200">
            {/* Per-call overrides */}
            <div className="space-y-2">
              {AI_CALL_KINDS.map((kind) => (
                <div key={kind} className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-mono text-hld-muted truncate">
                    {AI_CALL_KIND_LABELS[kind]}
                  </span>
                  <ModelPicker
                    value={modelConfig[kind] ?? null}
                    onChange={(c) => setKindOverride(kind, c)}
                    inheritLabel="Use default"
                  />
                </div>
              ))}
            </div>

            <CatalogEditor catalog={modelCatalog} onChange={setModelCatalog} />
          </div>
        )}
      </div>

      {/* Experimental: Claude Agent SDK (Max subscription) — collapsed by default */}
      <AgentSdkSettingsSection />

      {/* Experimental: provider-agnostic local agent (Ollama/Gemini/Anthropic) — collapsed by default */}
      <LocalAgentSettingsSection />
    </div>
  );
};

// --- Provider keys + Ollama endpoint -------------------------------------

const ProviderKeys: React.FC<{
  ollamaBaseUrl: string;
  onSaveOllamaUrl: (url: string) => void;
}> = ({ ollamaBaseUrl, onSaveOllamaUrl }) => {
  const [geminiKey, setGeminiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [ollamaUrl, setOllamaUrl] = useState(ollamaBaseUrl);
  const [saving, setSaving] = useState<'gemini' | 'anthropic' | null>(null);
  const [detecting, setDetecting] = useState(false);
  // Whether a key is already present in the keyring, so the user can verify a
  // key is stored without making a test call. Desktop-only (browser has no keyring).
  const [stored, setStored] = useState<{ gemini: boolean; anthropic: boolean }>({
    gemini: false,
    anthropic: false,
  });

  useEffect(() => {
    if (!isTauri()) return;
    let active = true;
    void (async () => {
      const [g, a] = await Promise.all([getSecret('gemini'), getSecret('anthropic')]);
      if (active) setStored({ gemini: !!g, anthropic: !!a });
    })().catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const saveKey = async (service: 'gemini' | 'anthropic', value: string) => {
    if (!value.trim()) return;
    if (!isTauri()) {
      toast.error('API key storage requires the desktop app.');
      return;
    }
    setSaving(service);
    try {
      await setSecret(service, value.trim());
      if (service === 'gemini') refreshGeminiKey(value.trim());
      else refreshAnthropicKey(value.trim());
      if (service === 'gemini') setGeminiKey('');
      else setAnthropicKey('');
      setStored((prev) => ({ ...prev, [service]: true }));
      toast.success(`${service === 'gemini' ? 'Gemini' : 'Anthropic'} API key saved to OS keyring.`);
    } catch (e) {
      toast.error(`Failed to save key: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(null);
    }
  };

  const detectOllama = async () => {
    const url = ollamaUrl.trim();
    setOllamaUrl(url);
    setDetecting(true);
    try {
      const models = await detectOllamaModels(url);
      onSaveOllamaUrl(url); // persist the endpoint + refresh the catalog
      toast.success(
        models.length
          ? `Detected ${models.length} Ollama model${models.length === 1 ? '' : 's'}.`
          : 'Connected to Ollama, but no models are installed.',
      );
    } catch {
      toast.error('Could not reach Ollama. Check it is running at this URL, and set OLLAMA_ORIGINS to allow this app.');
    } finally {
      setDetecting(false);
    }
  };

  return (
    <div className="bg-hld-surface-2 border border-hld-border rounded-lg p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Key size={14} className="text-hld-yellow" />
        <h4 className="text-[10px] font-mono uppercase tracking-widest font-bold text-hld-text">
          Providers
        </h4>
      </div>
      <p className="text-[11px] text-hld-muted leading-relaxed font-sans">
        Keys are stored in your OS keyring and fall back to{' '}
        <code className="font-mono">.env.local</code> if unset. They are never written to the
        project file.
      </p>

      <KeyRow
        label="Gemini API Key"
        value={geminiKey}
        onChange={setGeminiKey}
        onSave={() => saveKey('gemini', geminiKey)}
        saving={saving === 'gemini'}
        stored={stored.gemini}
      />
      <KeyRow
        label="Anthropic API Key"
        value={anthropicKey}
        onChange={setAnthropicKey}
        onSave={() => saveKey('anthropic', anthropicKey)}
        saving={saving === 'anthropic'}
        stored={stored.anthropic}
      />

      {/* Ollama endpoint */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Server size={12} className="text-hld-muted" />
          <label className="text-[10px] font-mono uppercase tracking-widest font-bold text-hld-muted">
            Ollama Endpoint
          </label>
        </div>
        <div className="flex gap-2">
          <input
            value={ollamaUrl}
            onChange={(e) => setOllamaUrl(e.target.value)}
            placeholder="http://localhost:11434"
            className="flex-1 p-2 text-[12px] font-mono border border-hld-border rounded bg-hld-bg text-hld-text focus:outline-none focus:border-hld-cyan"
          />
          <button
            onClick={detectOllama}
            disabled={detecting}
            className="px-3 py-2 bg-hld-surface border border-hld-border rounded text-[10px] font-mono uppercase tracking-widest font-bold hover:bg-hld-border text-hld-text transition-colors disabled:opacity-50"
          >
            {detecting ? 'Detecting…' : 'Detect'}
          </button>
        </div>
        <p className="text-[10px] text-hld-muted mt-1 font-mono">
          Detect installed models. If blocked, set OLLAMA_ORIGINS to allow this app.
        </p>
      </div>
    </div>
  );
};

const KeyRow: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  saving: boolean;
  stored?: boolean;
}> = ({ label, value, onChange, onSave, saving, stored }) => (
  <div>
    <label className="text-[10px] font-mono uppercase tracking-widest font-bold text-hld-muted mb-1 flex items-center gap-2">
      {label}
      {stored && (
        <span className="inline-flex items-center gap-1 text-hld-green normal-case tracking-normal" title="A key is stored in your OS keyring">
          <Check size={11} /> stored
        </span>
      )}
    </label>
    <div className="flex gap-2">
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste a new key to set or replace"
        disabled={saving}
        className="flex-1 p-2 text-[12px] font-mono border border-hld-border rounded bg-hld-bg text-hld-text focus:outline-none focus:border-hld-cyan disabled:opacity-50"
      />
      <button
        onClick={onSave}
        disabled={!value.trim() || saving}
        className="px-3 py-2 bg-hld-cyan text-hld-bg rounded text-[10px] font-mono uppercase tracking-widest font-bold hover:bg-hld-cyan/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  </div>
);

// --- Editable catalog -----------------------------------------------------

const CatalogEditor: React.FC<{
  catalog: CatalogModel[];
  onChange: (catalog: CatalogModel[]) => void;
}> = ({ catalog, onChange }) => {
  const [provider, setProvider] = useState<ProviderId>('gemini');
  const [id, setId] = useState('');

  const add = () => {
    const model = id.trim();
    if (!model) return;
    if (catalog.some((m) => m.provider === provider && m.id === model)) return;
    onChange([
      ...catalog,
      {
        provider,
        id: model,
        displayName: model,
        desc: CUSTOM_MODEL_DESC,
        supportsThinking: false,
        defaultThinkingBudget: 0,
        tier: 'balanced',
      },
    ]);
    setId('');
  };

  return (
    <div className="border-t border-hld-border pt-4">
      <h5 className="text-[10px] font-mono uppercase tracking-widest font-bold text-hld-muted mb-2">
        Model Catalog
      </h5>
      <div className="space-y-1 max-h-40 overflow-y-auto mb-3">
        {catalog.map((m) => {
          // Built-in models are app-managed: they refresh from code on each launch,
          // so removing one wouldn't stick. Only Ollama/custom rows are removable.
          const builtin = isBuiltinModel(m);
          return (
            <div
              key={`${m.provider}:${m.id}`}
              className="flex items-center justify-between gap-2 text-[11px] font-mono text-hld-text bg-hld-bg border border-hld-border rounded px-2 py-1"
            >
              <span className="truncate">
                <span className="text-hld-muted">{m.provider}</span> · {m.id}
                {m.provider === 'ollama' && <span className="text-hld-muted"> (detected)</span>}
              </span>
              <DisabledHint when={builtin} hint="Built-in models are managed by the app and refresh automatically.">
                <button
                  onClick={() => onChange(catalog.filter((c) => !(c.provider === m.provider && c.id === m.id)))}
                  disabled={builtin}
                  className="text-hld-muted hover:text-hld-magenta shrink-0 disabled:opacity-30 disabled:hover:text-hld-muted disabled:cursor-not-allowed"
                  title="Remove from catalog"
                >
                  <Trash2 size={14} />
                </button>
              </DisabledHint>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2">
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as ProviderId)}
          className="bg-hld-bg border border-hld-border rounded px-2 py-1 text-[10px] font-mono uppercase tracking-widest text-hld-text outline-none focus:border-hld-cyan"
        >
          <option value="gemini">Gemini</option>
          <option value="anthropic">Anthropic</option>
          <option value="ollama">Ollama</option>
          <option value="agent-sdk">Agent SDK</option>
        </select>
        <input
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder="model-id"
          className="flex-1 p-1.5 text-[11px] font-mono border border-hld-border rounded bg-hld-bg text-hld-text focus:outline-none focus:border-hld-cyan"
        />
        <button
          onClick={add}
          disabled={!id.trim()}
          className="px-3 py-1.5 bg-hld-surface border border-hld-border rounded text-[10px] font-mono uppercase tracking-widest font-bold hover:bg-hld-border text-hld-text transition-colors disabled:opacity-50 flex items-center gap-1"
        >
          <Plus size={12} /> Add
        </button>
      </div>
    </div>
  );
};
