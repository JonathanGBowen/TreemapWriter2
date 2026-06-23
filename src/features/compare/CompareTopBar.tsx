import { useEffect, useMemo } from 'react';
import { useStore } from '../../state';
import type { SessionRefOption, VersionRef } from '../../state/comparison-state';
import type { SnapshotMeta } from '../../types';
import { DEFAULT_COMPARE_LENSES } from '../../lib/defaultCompareLenses';
import { DEFAULT_SPELLS } from '../../lib/defaultSpells';
import { groupSnapshotsByDay, type DayGroup } from '../../lib/compareHelpers';
import { useComparisonActions } from './use-comparison-actions';
import { SegControl } from '../modals/SegControl';

/** A styled <select> over { Current Draft, …days → snapshots }. */
function VersionSelect({
  value,
  onChange,
  groups,
  sessionRefs,
  accent,
  label,
}: {
  value: VersionRef | null;
  onChange: (ref: VersionRef) => void;
  groups: DayGroup[];
  sessionRefs: SessionRefOption[];
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
        className={`max-w-[230px] truncate font-mono text-[10px] px-2 py-1 rounded border outline-none cursor-pointer ${ring}`}
      >
        <option value="current">Current Draft</option>
        {sessionRefs.length > 0 && (
          <optgroup label="Session boundaries">
            {sessionRefs.map((s) => (
              <option key={`${s.commitId}-${s.label}`} value={s.commitId}>{s.label}</option>
            ))}
          </optgroup>
        )}
        {groups.map((g) => (
          <optgroup key={g.dateKey} label={g.dayLabel}>
            {g.options.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

/** Header: Done · ≈ Version Compare · A→B day pickers · lens · Run. */
export function CompareTopBar() {
  const close = useStore((s) => s.closeCompare);
  const revisions = useStore((s) => s.revisions);
  const snapshotIndex = useStore((s) => s.snapshotIndex);
  const indexStatus = useStore((s) => s.indexStatus);
  const showAllSaves = useStore((s) => s.showAllSaves);
  const setShowAllSaves = useStore((s) => s.setShowAllSaves);
  const sessionRefs = useStore((s) => s.sessionRefs);
  const versionAId = useStore((s) => s.versionAId);
  const versionBId = useStore((s) => s.versionBId);
  const setVersionA = useStore((s) => s.setVersionA);
  const setVersionB = useStore((s) => s.setVersionB);
  const activeCompareLensId = useStore((s) => s.activeCompareLensId);
  const setCompareLens = useStore((s) => s.setCompareLens);
  const compareMode = useStore((s) => s.compareMode);
  const setCompareMode = useStore((s) => s.setCompareMode);
  const status = useStore((s) => s.comparisonStatus);
  const customSpells = useStore((s) => s.customSpells);
  const { runComparison } = useComparisonActions();

  // The deep index drives the picker; fall back to the in-memory recent
  // revisions until it loads, so the picker is never empty.
  const groups = useMemo<DayGroup[]>(() => {
    const metas: SnapshotMeta[] = snapshotIndex.length
      ? snapshotIndex
      : revisions.map((r) => ({
          id: r.id,
          timestamp: r.timestamp,
          trigger: r.trigger,
          affectedScope: r.affectedScope,
          contentHash: r.contentHash,
          message: '',
        }));
    return groupSnapshotsByDay(metas, { showAll: showAllSaves });
  }, [snapshotIndex, revisions, showAllSaves]);

  // Default on first open: A = start of the most recent day, B = the live draft.
  useEffect(() => {
    if (versionAId === null && groups.length) setVersionA(groups[0].startId);
    if (versionBId === null) setVersionB('current');
  }, [versionAId, versionBId, groups, setVersionA, setVersionB]);

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
        <VersionSelect value={versionAId} onChange={setVersionA} groups={groups} sessionRefs={sessionRefs} accent="magenta" label="A" />
        <span className="text-hld-muted-text text-[11px]">→</span>
        <VersionSelect value={versionBId} onChange={setVersionB} groups={groups} sessionRefs={sessionRefs} accent="green" label="B" />
        <button
          type="button"
          onClick={() => setShowAllSaves(!showAllSaves)}
          title="Show every autosave, not just day-starts and key checkpoints"
          className={`px-2 py-1 border font-mono text-[9px] uppercase tracking-[0.1em] transition-colors ${
            showAllSaves
              ? 'border-hld-cyan/40 text-hld-cyan bg-hld-cyan/10'
              : 'border-hld-border text-hld-muted-text hover:text-hld-text'
          }`}
        >
          {showAllSaves ? '◉ all saves' : '◐ all saves'}
        </button>
        {indexStatus === 'loading' && (
          <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-hld-muted-text">indexing…</span>
        )}
      </div>

      <div className="ml-auto flex items-center gap-3 shrink-0">
        <div title="Draft: treats stubs, placeholders and TODOs as intended scaffolding and weighs whether you're holding your throughline. Completed: judges both versions as finished work, where gaps count against them.">
          <SegControl
            ariaLabel="Comparison reading mode"
            accent="cyan"
            value={compareMode === 'final' ? 1 : 0}
            onChange={(i) => setCompareMode(i === 1 ? 'final' : 'draft')}
            options={[{ glyph: '✎', label: 'Draft' }, { glyph: '✓', label: 'Completed' }]}
          />
        </div>
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
