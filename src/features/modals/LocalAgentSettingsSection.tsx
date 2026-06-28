import React, { useState } from 'react';
import { Bot, ChevronDown, ChevronRight, Loader2, Send } from 'lucide-react';
import { useStore } from '../../store';
import { ModelPicker } from './ModelPicker';
import { AgentTraceTicker } from '../shared/AgentTraceTicker';
import { useLocalAgent, type AgentScope } from './use-local-agent';

/**
 * The provider-agnostic local agent (no Rig, no Node sidecar). A multi-turn,
 * tool-using loop that runs on the configured model — including a local Ollama
 * model — with read access to the project, a scoped write area
 * (`.twriter/agent-output/`), the structured routines, and search over artifacts
 * + history. OFF by default; independent of the Claude Agent SDK toggle. Tucked
 * in a collapsed disclosure so it never clutters the AI settings surface.
 */
export const LocalAgentSettingsSection: React.FC = () => {
  const enabled = useStore((s) => s.localAgentEnabled);
  const model = useStore((s) => s.localAgentModel);
  const setEnabled = useStore((s) => s.setLocalAgentEnabled);
  const setModel = useStore((s) => s.setLocalAgentModel);
  const setShowAgentTraceModal = useStore((s) => s.setShowAgentTraceModal);

  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [scope, setScope] = useState<AgentScope>('document');
  const { messages, running, error, run, reset } = useLocalAgent();

  const submit = () => {
    const p = prompt.trim();
    if (!p || running) return;
    setPrompt('');
    void run(p, scope);
  };

  return (
    <div className="bg-hld-surface-2 border border-hld-border rounded-lg">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 p-4 text-[10px] font-mono uppercase tracking-widest font-bold text-hld-muted hover:text-hld-text transition-colors"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Bot size={13} className="text-hld-cyan" />
        Experimental — Local agent
        {enabled && <span className="text-hld-cyan normal-case tracking-normal">· on</span>}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 animate-in fade-in duration-200">
          <p className="text-[11px] text-hld-muted leading-relaxed font-sans">
            A multi-turn, tool-using agent that runs on <strong>any</strong> configured model —
            including a local <strong>Ollama</strong> model — with no API billing and no Node helper.
            It reads the whole working text in context, can search artifacts and version history, runs
            the structured routines, and writes only to <code>.twriter/agent-output/</code>. Off by
            default; independent of the Claude Agent SDK above.
          </p>

          {/* On/off toggle */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-hld-text">
              Local agent
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

          {/* Agent model — the shared picker, scoped to the local-capable providers. */}
          <div>
            <label className="text-[10px] font-mono uppercase tracking-widest font-bold text-hld-muted mb-1 block">
              Model
            </label>
            <ModelPicker
              providers={['ollama', 'gemini', 'anthropic']}
              value={model}
              onChange={(c) => c && setModel(c)}
              className="w-full bg-hld-bg border border-hld-border rounded px-2 py-2 text-[12px] font-mono text-hld-text outline-none focus:border-hld-cyan"
            />
          </div>

          {/* Inline console — usable only when the agent is on. */}
          {enabled && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-hld-text">
                  Try it
                </span>
                <div className="flex items-center gap-2">
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value as AgentScope)}
                    className="bg-hld-bg border border-hld-border rounded px-2 py-1 text-[10px] font-mono text-hld-text outline-none focus:border-hld-cyan"
                    title="What the agent reads in full as its working text"
                  >
                    <option value="document">Whole document</option>
                    <option value="section">Selected section</option>
                  </select>
                  {messages.length > 0 && (
                    <button
                      type="button"
                      onClick={reset}
                      className="px-2 py-1 text-[10px] font-mono uppercase tracking-widest text-hld-muted hover:text-hld-text transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {messages.length > 0 && (
                <div className="max-h-64 overflow-y-auto space-y-2 rounded border border-hld-border bg-hld-bg p-2">
                  {messages.map((m, i) => (
                    <div key={i} className="text-[11px] font-sans leading-relaxed">
                      <span
                        className={`font-mono text-[9px] uppercase tracking-widest mr-2 ${
                          m.role === 'user' ? 'text-hld-muted' : 'text-hld-cyan'
                        }`}
                      >
                        {m.role === 'user' ? 'You' : 'Agent'}
                      </span>
                      <span className="text-hld-text whitespace-pre-wrap">{m.text}</span>
                    </div>
                  ))}
                  {running && (
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-hld-muted">
                      <Loader2 size={11} className="animate-spin shrink-0" />
                      <AgentTraceTicker kinds={['runAgent']} className="min-w-0 truncate" />
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
                  }}
                  rows={2}
                  placeholder="Ask the agent… (⌘/Ctrl+Enter to run)"
                  className="flex-1 p-2 text-[12px] font-sans border border-hld-border rounded bg-hld-bg text-hld-text focus:outline-none focus:border-hld-cyan resize-none"
                />
                <button
                  onClick={submit}
                  disabled={running || !prompt.trim()}
                  className="px-3 self-stretch bg-hld-surface border border-hld-border rounded text-[10px] font-mono uppercase tracking-widest font-bold hover:bg-hld-border text-hld-text transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {running ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                </button>
              </div>

              {error && <p className="text-[10px] font-mono text-hld-magenta">{error}</p>}

              <button
                type="button"
                onClick={() => setShowAgentTraceModal(true)}
                className="text-[10px] font-mono uppercase tracking-widest text-hld-muted hover:text-hld-text transition-colors"
              >
                View activity traces
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
