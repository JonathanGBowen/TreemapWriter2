import React, { useState } from 'react';
import { FlaskConical, ChevronDown, ChevronRight, Check, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useStore } from '../../store';
import { pingAgentSidecar } from '../../services/ai-provider-registry';
import type { AgentSidecarHealth } from '../../services/ai/clients';

/**
 * Experimental Claude Agent SDK controls, tucked into a collapsed disclosure so
 * it never clutters the AI settings surface. OFF by default; when on, dialogue +
 * coaching calls route through the local Agent SDK helper against the user's Max
 * subscription. Per-task model overrides (Advanced, above) can opt other calls in.
 */
export const AgentSdkSettingsSection: React.FC = () => {
  const enabled = useStore((s) => s.agentModeEnabled);
  const sidecarUrl = useStore((s) => s.agentSidecarUrl);
  const agentSdkModel = useStore((s) => s.agentSdkModel);
  const catalog = useStore((s) => s.modelCatalog);
  const setEnabled = useStore((s) => s.setAgentModeEnabled);
  const setSidecarUrl = useStore((s) => s.setAgentSidecarUrl);
  const setAgentSdkModel = useStore((s) => s.setAgentSdkModel);

  const [open, setOpen] = useState(false);
  const [urlDraft, setUrlDraft] = useState(sidecarUrl);
  const [health, setHealth] = useState<AgentSidecarHealth | null>(null);
  const [checking, setChecking] = useState(false);

  const agentModels = catalog.filter((m) => m.provider === 'agent-sdk');

  const check = async () => {
    const url = urlDraft.trim();
    setSidecarUrl(url);
    setChecking(true);
    try {
      const result = await pingAgentSidecar(url);
      setHealth(result);
      if (result.ok && result.authed) toast.success('Agent SDK helper is up and authenticated.');
      else if (result.ok) toast.error('Helper is up, but no Max-subscription token was found.');
      else toast.error('Could not reach the Agent SDK helper. Is `npm run agent` running?');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="bg-hld-surface2 border border-hld-border rounded-lg">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 p-4 text-[10px] font-mono uppercase tracking-widest font-bold text-hld-muted hover:text-hld-text transition-colors"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <FlaskConical size={13} className="text-hld-magenta" />
        Experimental — Claude Agent SDK
        {enabled && <span className="text-hld-magenta normal-case tracking-normal">· on</span>}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 animate-in fade-in duration-200">
          <p className="text-[11px] text-hld-muted leading-relaxed font-sans">
            Routes <strong>dialogue</strong> and <strong>coaching</strong> calls through the Claude
            Agent SDK, run by a local helper against your Max subscription. Off by default — every
            other call keeps using its configured provider. Other tasks can be opted in per-task
            under Advanced.
          </p>

          {/* On/off toggle */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-hld-text">
              Agent mode
            </span>
            <button
              role="switch"
              aria-checked={enabled}
              onClick={() => setEnabled(!enabled)}
              className={`px-3 py-1.5 rounded text-[10px] font-mono uppercase tracking-widest font-bold transition-colors ${
                enabled
                  ? 'bg-hld-magenta text-hld-bg hover:bg-hld-magenta/80'
                  : 'bg-hld-surface border border-hld-border text-hld-muted hover:text-hld-text'
              }`}
            >
              {enabled ? 'On' : 'Off'}
            </button>
          </div>

          {/* Agent model */}
          <div>
            <label className="text-[10px] font-mono uppercase tracking-widest font-bold text-hld-muted mb-1 block">
              Model
            </label>
            <select
              value={agentSdkModel}
              onChange={(e) => setAgentSdkModel(e.target.value)}
              className="w-full bg-hld-bg border border-hld-border rounded px-2 py-2 text-[12px] font-mono text-hld-text outline-none focus:border-hld-cyan"
            >
              {agentModels.length === 0 && <option value={agentSdkModel}>{agentSdkModel}</option>}
              {agentModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                </option>
              ))}
            </select>
          </div>

          {/* Helper URL + status */}
          <div>
            <label className="text-[10px] font-mono uppercase tracking-widest font-bold text-hld-muted mb-1 block">
              Helper URL
            </label>
            <div className="flex gap-2">
              <input
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                placeholder="http://localhost:8787"
                className="flex-1 p-2 text-[12px] font-mono border border-hld-border rounded bg-hld-bg text-hld-text focus:outline-none focus:border-hld-cyan"
              />
              <button
                onClick={check}
                disabled={checking}
                className="px-3 py-2 bg-hld-surface border border-hld-border rounded text-[10px] font-mono uppercase tracking-widest font-bold hover:bg-hld-border text-hld-text transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {checking ? <Loader2 size={12} className="animate-spin" /> : null}
                {checking ? 'Checking…' : 'Check'}
              </button>
            </div>
            {health && (
              <p className="text-[10px] font-mono mt-1.5 flex items-center gap-1.5">
                {health.ok && health.authed ? (
                  <span className="text-hld-green inline-flex items-center gap-1">
                    <Check size={11} /> reachable · authenticated
                  </span>
                ) : health.ok ? (
                  <span className="text-hld-yellow inline-flex items-center gap-1">
                    <X size={11} /> reachable · no Max token
                  </span>
                ) : (
                  <span className="text-hld-magenta inline-flex items-center gap-1">
                    <X size={11} /> unreachable
                  </span>
                )}
              </p>
            )}
          </div>

          <p className="text-[10px] text-hld-muted leading-relaxed font-mono">
            Start the helper with <code>npm run agent</code>, and authenticate it once with{' '}
            <code>claude setup-token</code> (sets <code>CLAUDE_CODE_OAUTH_TOKEN</code>). See{' '}
            <code>agent-sidecar/README.md</code>.
          </p>
        </div>
      )}
    </div>
  );
};
