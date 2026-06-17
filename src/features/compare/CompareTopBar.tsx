import { useEffect } from 'react';
import { useStore } from '../../state';
import type { VersionRef } from '../../state/comparison-state';
import type { Snapshot } from '../../types';
import { DEFAULT_COMPARE_LENSES } from '../../lib/defaultCompareLenses';
import { DEFAULT_SPELLS } from '../../lib/defaultSpells';
import { useComparisonActions } from './use-comparison-actions';

/** A styled <select> over { Current Draft, …loaded snapshots }. */
function VersionSelect({
  value,
  onChange,
  revisions,
  accent,
  label,
}: {
  value: VersionRef | null;
  onChange: (ref: VersionRef) => void;
  revisions: Snapshot[];
  accent: 'magenta' | 'green';
  label: string;
}) {
  const ring =
    accent === 'magenta'
      ? 'text-hld-magenta border-hld-magenta/30 bg-hld-magenta/10'
      : 'text-hld-green border-hld-green/30 bg-hld-green/10';
  return (
    <label className="flex items-center gap-2 min-w-0">
      <span className="font-mono uppercase tracking-[0.14em] text-[9px] text-hld-muted-text">{label}</span>
      <select
        value={value ?? 'current'}
        onChange={(e) => onChange(e.target.value as VersionRef)}
        className={`max-w-[220px] truncate font-mono text-[10px] px-2 py-1 rounded border outline-none cursor-pointer ${ring}`}
      >
        <option value="current">Current Draft</option>
        {revisions.map((r) => (
          <option key={r.id} value={r.id}>
            {new Date(r.timestamp).toLocaleString()}
            {r.trigger ? ` · ${r.trigger}` : ''}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Header: Done · ≈ Version Compare · A vs B pickers · lens selector · Run. */
export function CompareTopBar() {
  const close = useStore((s) => s.closeCompare);
  const revisions = useStore((s) => s.revisions);
  const versionAId = useStore((s) => s.versionAId);
  const versionBId = useStore((s) => s.versionBId);
  const setVersionA = useStore((s) => s.setVersionA);
  const setVersionB = useStore((s) => s.setVersionB);
  const activeCompareLensId = useStore((s) => s.activeCompareLensId);
  const setCompareLens = useStore((s) => s.setCompareLens);
  const status = useStore((s) => s.comparisonStatus);
  const customSpells = useStore((s) => s.customSpells);
  const { runComparison } = useComparisonActions();

  // Sensible defaults on first open: A = newest snapshot (or current if none),
  // B = the live draft. The user reassigns either freely.
  useEffect(() => {
    if (versionAId === null) setVersionA(revisions[0]?.id ?? 'current');
    if (versionBId === null) setVersionB('current');
  }, [versionAId, versionBId, revisions, setVersionA, setVersionB]);

  const running = status === 'running';

  return (
    <div className="h-[54px] shrink-0 flex items-center gap-4 px-[18px] border-b border-hld-cyan/25 bg-gradient-to-b from-hld-cyan/5 to-transparent">
      <button
        type="button"
        onClick={close}
        className="px-2.5 py-1.5 border border-hld-cyan/30 text-hld-cyan hover:bg-hld-cyan/10 font-mono text-[10px] uppercase tracking-[0.12em] transition-all"
      >
        ‹ Done — back to writing
      </button>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-hld-cyan text-[14px]">≈</span>
        <span className="font-mono uppercase tracking-[0.14em] text-[10px] font-bold text-hld-text">
          Version Compare
        </span>
      </div>

      <div className="flex items-center gap-3 min-w-0">
        <VersionSelect value={versionAId} onChange={setVersionA} revisions={revisions} accent="magenta" label="A" />
        <span className="text-hld-muted-text text-[11px]">→</span>
        <VersionSelect value={versionBId} onChange={setVersionB} revisions={revisions} accent="green" label="B" />
      </div>

      <div className="ml-auto flex items-center gap-3 shrink-0">
        <label className="flex items-center gap-2">
          <span className="font-mono uppercase tracking-[0.14em] text-[9px] text-hld-muted-text">Lens</span>
          <select
            value={activeCompareLensId ?? ''}
            onChange={(e) => setCompareLens(e.target.value || null)}
            className="max-w-[200px] truncate font-mono text-[10px] px-2 py-1 rounded border border-hld-border bg-hld-surface text-hld-text outline-none cursor-pointer"
          >
            <option value="">Plain comparison</option>
            <optgroup label="Comparison lenses">
              {DEFAULT_COMPARE_LENSES.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </optgroup>
            <optgroup label="Grimoire spells">
              {DEFAULT_SPELLS.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </optgroup>
            {customSpells.length > 0 && (
              <optgroup label="Custom lenses">
                {customSpells.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        <button
          type="button"
          onClick={runComparison}
          disabled={running}
          className="hld-lit px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] disabled:opacity-50 disabled:cursor-wait"
        >
          {running ? 'Comparing…' : 'Run evaluation'}
        </button>
      </div>
    </div>
  );
}
