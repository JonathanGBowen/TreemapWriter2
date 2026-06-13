import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

/** Quiet "copy to clipboard" affordance; flips to a green "Copied" for 2s. */
export function CopyButton({ text, label = 'Copy prompt', title }: { text: string; label?: string; title?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title={title ?? label}
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className={`flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.12em] px-2 py-1 border transition-colors ${
        copied ? 'border-hld-green/50 text-hld-green' : 'border-hld-border text-hld-muted-text hover:text-hld-cyan'
      }`}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copied' : label}
    </button>
  );
}
