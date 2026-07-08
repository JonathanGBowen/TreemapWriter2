import React, { useState } from 'react';
import { Layers, ChevronDown, ChevronRight, ArrowUp, ArrowDown, Trash2, Plus, RotateCcw } from 'lucide-react';
import { useStore } from '../../store';
import { clearModelCooldown } from '../../services/ai-provider-registry';
import { findCatalogModel } from '../../services/ai/model-catalog';
import { DEFAULT_FALLBACK_LADDER } from '../../services/ai/model-defaults';
import { formatResetEt } from '../../services/ai/model-fallback';
import type { ModelChoice } from '../../services/ai/model-types';
import { ModelPicker } from './ModelPicker';

/**
 * Quota fallback controls, in the same place model defaults are configured. When a
 * model hits its quota the app retries down this ordered ladder (strongest →
 * weakest), skipping any model that's on a daily-quota cooldown or whose context
 * window can't hold the prompt. On by default. Collapsed to keep the surface quiet.
 */
export const FallbackSettingsSection: React.FC = () => {
  const enabled = useStore((s) => s.fallbackEnabled);
  const ladder = useStore((s) => s.fallbackLadder);
  const cooldowns = useStore((s) => s.modelCooldowns);
  const catalog = useStore((s) => s.modelCatalog);
  const setEnabled = useStore((s) => s.setFallbackEnabled);
  const setLadder = useStore((s) => s.setFallbackLadder);

  const [open, setOpen] = useState(false);

  const label = (c: ModelChoice): string =>
    findCatalogModel(catalog, c.provider, c.model)?.displayName ?? c.model;

  const move = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= ladder.length) return;
    const next = [...ladder];
    [next[i], next[j]] = [next[j], next[i]];
    setLadder(next);
  };
  const remove = (i: number) => setLadder(ladder.filter((_, k) => k !== i));
  const add = (choice: ModelChoice | null) => {
    if (!choice) return;
    if (ladder.some((c) => c.provider === choice.provider && c.model === choice.model)) return;
    // The ladder only needs provider + model; thinking is resolved per-call.
    setLadder([...ladder, { provider: choice.provider, model: choice.model }]);
  };

  const now = Date.now();
  const active = cooldowns.filter((c) => c.resetUtc > now);

  return (
    <div className="bg-hld-surface-2 border border-hld-border rounded-lg">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 p-4 text-[10px] font-mono uppercase tracking-widest font-bold text-hld-muted hover:text-hld-text transition-colors"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Layers size={13} className="text-hld-cyan" />
        Model fallback
        {enabled ? (
          <span className="text-hld-cyan normal-case tracking-normal">· on</span>
        ) : (
          <span className="text-hld-muted normal-case tracking-normal">· off</span>
        )}
        {active.length > 0 && (
          <span className="text-hld-yellow normal-case tracking-normal">
            · {active.length} paused
          </span>
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 animate-in fade-in duration-200">
          <p className="text-[11px] text-hld-muted leading-relaxed font-sans">
            When a model runs out of quota, retry down this ladder (strongest →
            weakest) instead of failing. Models on a daily-quota cooldown, or whose
            context window can&apos;t hold the request, are skipped automatically.
          </p>

          {/* On/off toggle */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-hld-text">
              Automatic fallback
            </span>
            <button
              role="switch"
              aria-checked={enabled}
              onClick={() => setEnabled(!enabled)}
              className={`px-3 py-1.5 rounded text-[10px] font-mono uppercase tracking-widest font-bold transition-colors ${
                enabled
                  ? 'bg-hld-cyan text-hld-bg hover:bg-hld-cyan/80'
                  : 'bg-hld-surface border border-hld-border text-hld-muted hover:text-hld-text'
              }`}
            >
              {enabled ? 'On' : 'Off'}
            </button>
          </div>

          {/* Ladder */}
          <div className={enabled ? '' : 'opacity-50 pointer-events-none'}>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-mono uppercase tracking-widest font-bold text-hld-muted">
                Fallback ladder
              </label>
              <button
                type="button"
                onClick={() => setLadder([...DEFAULT_FALLBACK_LADDER])}
                title="Restore the default Gemini fallback ladder"
                className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-widest text-hld-muted hover:text-hld-cyan transition-colors"
              >
                <RotateCcw size={11} /> Reset
              </button>
            </div>
            <div className="space-y-1 mb-3">
              {ladder.map((c, i) => (
                <div
                  key={`${c.provider}:${c.model}`}
                  className="flex items-center justify-between gap-2 text-[11px] font-mono text-hld-text bg-hld-bg border border-hld-border rounded px-2 py-1"
                >
                  <span className="truncate">
                    <span className="text-hld-muted">{i + 1}.</span> {label(c)}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      className="text-hld-muted hover:text-hld-text disabled:opacity-30"
                      title="Move up"
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      onClick={() => move(i, 1)}
                      disabled={i === ladder.length - 1}
                      className="text-hld-muted hover:text-hld-text disabled:opacity-30"
                      title="Move down"
                    >
                      <ArrowDown size={13} />
                    </button>
                    <button
                      onClick={() => remove(i)}
                      className="text-hld-muted hover:text-hld-yellow"
                      title="Remove from ladder"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
              {ladder.length === 0 && (
                <p className="text-[10px] text-hld-muted font-mono">
                  Empty — add a model below, or fallback does nothing.
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Plus size={12} className="text-hld-muted shrink-0" />
              <ModelPicker
                value={null}
                onChange={add}
                inheritLabel="Add a model to the ladder…"
                className="flex-1 bg-hld-bg border border-hld-border rounded px-2 py-1.5 text-[11px] font-mono text-hld-text outline-none focus:border-hld-cyan"
              />
            </div>
          </div>

          {/* Active cooldowns */}
          {active.length > 0 && (
            <div className="border-t border-hld-border pt-3">
              <label className="text-[10px] font-mono uppercase tracking-widest font-bold text-hld-muted mb-2 block">
                Paused (daily quota)
              </label>
              <div className="space-y-1">
                {active.map((c) => (
                  <div
                    key={`${c.provider}:${c.model}`}
                    className="flex items-center justify-between gap-2 text-[11px] font-mono text-hld-text bg-hld-bg border border-hld-border rounded px-2 py-1"
                  >
                    <span className="truncate">
                      {label(c)}{' '}
                      <span className="text-hld-muted">until {formatResetEt(c.resetUtc)}</span>
                    </span>
                    <button
                      onClick={() => clearModelCooldown(c.provider, c.model)}
                      className="text-hld-muted hover:text-hld-text shrink-0 normal-case"
                      title="Lift this cooldown now"
                    >
                      Clear
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
