import { useEffect, useMemo } from 'react';
import { useStore } from '../../state';
import type { SessionRefOption, VersionRef } from '../../state/comparison-state';
import type { SnapshotMeta } from '../../types';
import { groupSnapshotsByDay, resolveOperand, type DayGroup } from '../../lib/compareHelpers';
import { buildSpecByTitle, planSpecTestRun, isDeepRead } from '../../lib/specTestHelpers';
import { useSpecTestActions } from './use-spec-test-actions';
import { SegControl } from '../modals/shared/SegControl';

/** A styled <select> over { Current Draft, session boundaries, …days → snapshots }. */
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
        className={`max-w-[210px] truncate font-mono text-[10px] px-2 py-1 rounded border outline-none cursor-pointer ${ring}`}
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

/** Header: Done · ▣ Spec Test · A→B pickers · scope · rubric source · mode · Run. */
export function SpecTestTopBar() {
  const close = useStore((s) => s.closeSpecTest);
  const revisions = useStore((s) => s.revisions);
  const snapshotIndex = useStore((s) => s.specTestIndex);
  const indexStatus = useStore((s) => s.specTestIndexStatus);
  const showAllSaves = useStore((s) => s.specTestShowAllSaves);
  const setShowAllSaves = useStore((s) => s.setSpecTestShowAllSaves);
  const sessionRefs = useStore((s) => s.specTestSessionRefs);
  const aId = useStore((s) => s.specTestAId);
  const bId = useStore((s) => s.specTestBId);
  const setA = useStore((s) => s.setSpecTestA);
  const setB = useStore((s) => s.setSpecTestB);
  const scope = useStore((s) => s.specTestScope);
  const setScope = useStore((s) => s.setSpecTestScope);
  const mode = useStore((s) => s.specTestMode);
  const setMode = useStore((s) => s.setSpecTestMode);
  const rubricSource = useStore((s) => s.specTestRubricSource);
  const setRubricSource = useStore((s) => s.setSpecTestRubricSource);
  const status = useStore((s) => s.specTestStatus);
  // Subscriptions for the deep-read preview (a cheap pure plan over live specs).
  const sections = useStore((s) => s.sections);
  const testSuite = useStore((s) => s.testSuite);
  const localContent = useStore((s) => s.localContent);
  const loadedA = useStore((s) => s.specTestLoadedA);
  const loadedB = useStore((s) => s.specTestLoadedB);
  const { runSpecTest } = useSpecTestActions();

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
    if (aId === null && groups.length) setA(groups[0].startId);
    if (bId === null) setB('current');
  }, [aId, bId, groups, setA, setB]);

  // Cost preview: how many sections this run will deep-read (one AI call each).
  const deepReadCount = useMemo<number | null>(() => {
    const a = resolveOperand(aId, loadedA, localContent);
    const b = resolveOperand(bId, loadedB, localContent);
    if (!a || !b || a.markdown === b.markdown) return null;
    const specByTitle = buildSpecByTitle(sections, testSuite);
    if (!specByTitle.size) return null;
    try {
      const plan = planSpecTestRun(a.markdown, b.markdown, specByTitle, sections, scope);
      return plan.filter((p) => isDeepRead(p.scopeReason)).length;
    } catch {
      return null;
    }
  }, [aId, bId, loadedA, loadedB, localContent, sections, testSuite, scope]);

  const running = status === 'running';

  return (
    <div className="min-h-[54px] shrink-0 flex flex-wrap items-center gap-x-4 gap-y-2 px-[18px] py-2 border-b border-hld-cyan/25 bg-gradient-to-b from-hld-cyan/5 to-transparent">
      <button
        type="button"
        onClick={close}
        className="px-2.5 py-1.5 border border-hld-cyan/30 text-hld-cyan hover:bg-hld-cyan/10 font-mono text-[10px] uppercase tracking-[0.12em] transition-all"
      >
        ‹ Done — back to writing
      </button>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-hld-cyan text-[14px]">▣</span>
        <span className="font-mono uppercase tracking-[0.14em] text-[10px] font-bold text-hld-text">Spec Test</span>
      </div>

      <div className="flex items-center gap-3 min-w-0">
        <VersionSelect value={aId} onChange={setA} groups={groups} sessionRefs={sessionRefs} accent="magenta" label="A" />
        <span className="text-hld-muted-text text-[11px]">→</span>
        <VersionSelect value={bId} onChange={setB} groups={groups} sessionRefs={sessionRefs} accent="green" label="B" />
        <button
          type="button"
          onClick={() => setShowAllSaves(!showAllSaves)}
          title="Show every autosave, not just day-starts and key checkpoints"
          className={`px-2 py-1 border font-mono text-[9px] uppercase tracking-[0.1em] transition-colors ${
            showAllSaves ? 'border-hld-cyan/40 text-hld-cyan bg-hld-cyan/10' : 'border-hld-border text-hld-muted-text hover:text-hld-text'
          }`}
        >
          {showAllSaves ? '◉ all saves' : '◐ all saves'}
        </button>
        {indexStatus === 'loading' && (
          <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-hld-muted-text">indexing…</span>
        )}
      </div>

      <div className="ml-auto flex items-center gap-3 shrink-0">
        {deepReadCount !== null && (
          <span
            className="font-mono text-[9px] uppercase tracking-[0.1em] text-hld-muted-text"
            title="Sections this run will deep-read against the rubric (one AI call each). The rest are scored structurally, free."
          >
            ~{deepReadCount} to deep-read
          </span>
        )}
        <div title="Changed: deep-read only sections whose prose changed, plus their commitment-mesh neighbours. All: deep-read every section with a rubric.">
          <SegControl
            ariaLabel="Spec test scope"
            value={scope === 'all' ? 1 : 0}
            onChange={(i) => setScope(i === 1 ? 'all' : 'changed')}
            options={[{ glyph: '◐', label: 'Changed' }, { glyph: '◉', label: 'All' }]}
          />
        </div>
        <div title="Live spec: test both versions against the spec you hold NOW (the TDD reading). Snapshot A: against the spec frozen when version A was saved.">
          <SegControl
            ariaLabel="Held rubric source"
            value={rubricSource === 'snapshot-a' ? 1 : 0}
            onChange={(i) => setRubricSource(i === 1 ? 'snapshot-a' : 'live')}
            options={[{ glyph: '◈', label: 'Live spec' }, { glyph: '◇', label: 'Snapshot A' }]}
          />
        </div>
        <div title="Draft: a still-missing move is scaffolding, and a deflated move is a cut opportunity. Completed: judges both versions as finished work.">
          <SegControl
            ariaLabel="Spec test reading mode"
            value={mode === 'final' ? 1 : 0}
            onChange={(i) => setMode(i === 1 ? 'final' : 'draft')}
            options={[{ glyph: '✎', label: 'Draft' }, { glyph: '✓', label: 'Completed' }]}
          />
        </div>
        <button
          type="button"
          onClick={runSpecTest}
          disabled={running}
          className="hld-lit px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] disabled:opacity-50 disabled:cursor-wait"
        >
          {running ? 'Testing…' : 'Run spec test'}
        </button>
      </div>
    </div>
  );
}
