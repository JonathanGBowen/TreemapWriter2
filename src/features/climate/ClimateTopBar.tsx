import { useStore } from '../../state';
import type { AtmosphericInstrument, Section } from '../../types';
import { useClimateActions } from './use-climate-actions';

/** The four Climate Artist instruments, in workflow order. */
const INSTRUMENTS: { id: AtmosphericInstrument; label: string }[] = [
  { id: 'weatherReport', label: 'Weather Report — completed text' },
  { id: 'radarScan', label: 'Radar Scan — draft map' },
  { id: 'stormSpotter', label: 'Storm Spotter — one passage' },
  { id: 'forecast', label: 'Forecast — work in progress' },
];

/** Flatten the section tree into indented options for the target picker. */
function flatten(nodes: Section[], depth = 0, out: { id: string; label: string }[] = []) {
  for (const n of nodes) {
    out.push({ id: n.id, label: `${'  '.repeat(depth)}${n.title}` });
    flatten(n.children, depth + 1, out);
  }
  return out;
}

/** Header: Done · ≋ Climate Artist · instrument · target · Run. */
export function ClimateTopBar() {
  const close = useStore((s) => s.closeClimate);
  const sections = useStore((s) => s.sections);
  const selectedId = useStore((s) => s.selectedId);
  const instrument = useStore((s) => s.climateInstrument);
  const setInstrument = useStore((s) => s.setClimateInstrument);
  const targetId = useStore((s) => s.climateTargetId);
  const setTarget = useStore((s) => s.setClimateTarget);
  const status = useStore((s) => s.climateStatus);
  const { runAtmosphere } = useClimateActions();

  const running = status === 'running';
  const flat = flatten(sections);

  const onInstrument = (id: AtmosphericInstrument) => {
    setInstrument(id);
    // Storm Spotter is a single-passage instrument: default to the section the
    // writer has selected, so "diagnose this" needs one fewer click.
    if (id === 'stormSpotter' && !targetId && selectedId && selectedId !== 'root') {
      setTarget(selectedId);
    }
  };

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
        <span className="text-hld-cyan text-[14px]">≋</span>
        <span className="font-mono uppercase tracking-[0.14em] text-[10px] font-bold text-hld-text">
          Climate Artist
        </span>
      </div>

      <div className="flex items-center gap-3 min-w-0">
        <label className="flex items-center gap-2">
          <span className="font-mono uppercase tracking-[0.14em] text-[9px] text-hld-muted-text">Instrument</span>
          <select
            value={instrument}
            onChange={(e) => onInstrument(e.target.value as AtmosphericInstrument)}
            className="max-w-[260px] truncate font-mono text-[10px] px-2 py-1 rounded border border-hld-border bg-hld-surface text-hld-text outline-none cursor-pointer"
          >
            {INSTRUMENTS.map((i) => (
              <option key={i.id} value={i.id}>{i.label}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="font-mono uppercase tracking-[0.14em] text-[9px] text-hld-muted-text">Target</span>
          <select
            value={targetId ?? ''}
            onChange={(e) => setTarget(e.target.value || null)}
            className="max-w-[220px] truncate font-mono text-[10px] px-2 py-1 rounded border border-hld-border bg-hld-surface text-hld-text outline-none cursor-pointer"
          >
            <option value="">Whole draft</option>
            {flat.length > 0 && (
              <optgroup label="Section">
                {flat.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
      </div>

      <div className="ml-auto flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={runAtmosphere}
          disabled={running}
          className="hld-lit px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] disabled:opacity-50 disabled:cursor-wait"
        >
          {running ? 'Reading…' : 'Run reading'}
        </button>
      </div>
    </div>
  );
}
