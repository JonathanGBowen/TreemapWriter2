// Shared remote-URL + PAT field pair for the two surfaces that collect GitHub
// credentials (SyncConfigModal and RemoteProjectModal) — previously duplicated
// verbatim in both. Purely presentational; the parent owns the values.

import React from 'react';

interface RemoteAuthFieldsProps {
  url: string;
  onUrlChange: (v: string) => void;
  token: string;
  onTokenChange: (v: string) => void;
  disabled?: boolean;
}

export const RemoteAuthFields: React.FC<RemoteAuthFieldsProps> = ({
  url,
  onUrlChange,
  token,
  onTokenChange,
  disabled = false,
}) => (
  <>
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-mono uppercase tracking-[0.1em] text-hld-muted-text">
        Remote URL
      </label>
      <input
        type="text"
        value={url}
        onChange={(e) => onUrlChange(e.target.value)}
        placeholder="https://github.com/username/repo.git"
        disabled={disabled}
        className="bg-hld-surface border border-hld-border text-[12px] p-2 font-mono text-hld-text focus:outline-none focus:border-hld-cyan disabled:opacity-50"
      />
    </div>

    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-mono uppercase tracking-[0.1em] text-hld-muted-text">
        Personal Access Token
      </label>
      <input
        type="password"
        value={token}
        onChange={(e) => onTokenChange(e.target.value)}
        placeholder="ghp_… or github_pat_…"
        disabled={disabled}
        className="bg-hld-surface border border-hld-border text-[12px] p-2 font-mono text-hld-text focus:outline-none focus:border-hld-cyan disabled:opacity-50"
      />
      <p className="text-[10px] text-hld-muted-text leading-relaxed mt-1">
        Use a fine-grained PAT scoped to this single repo with read/write access
        to Contents. The token stays in your OS keyring, not on disk.
      </p>
    </div>
  </>
);
