import { useStore } from '../../state';
import type { Section } from '../../types';

/** Flatten the section tree into indented options for the scope picker. */
function flatten(nodes: Section[], depth = 0, out: { id: string; label: string }[] = []) {
  for (const n of nodes) {
    out.push({ id: n.id, label: `${'  '.repeat(depth)}${n.title}` });
    flatten(n.children, depth + 1, out);
  }
  return out;
}

/** Header: Done · ≣ Reverse Outline Doctor · mode toggle · scope picker. */
export function DoctorTopBar() {
  const close = useStore((s) => s.closeDoctor);
  const sections = useStore((s) => s.sections);
  const mode = useStore((s) => s.doctorMode);
  const setMode = useStore((s) => s.setDoctorMode);
  const targetId = useStore((s) => s.doctorTargetId);
  const setTarget = useStore((s) => s.setDoctorTarget);
  const status = useStore((s) => s.doctorStatus);

  const busy = status === 'running' || status === 'streaming';
  const flat = flatten(sections);

  const modeBtn = (m: 'instruments' | 'wizard', label: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      aria-pressed={mode === m}
      className={`px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] border transition-all ${
        mode === m
          ? 'border-hld-cyan text-hld-cyan bg-hld-cyan/10'
          : 'border-hld-border text-hld-muted-text hover:text-hld-text hover:border-hld-cyan/40'
      }`}
    >
      {label}
    </button>
  );

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
        <span className="text-hld-cyan text-[14px]">≣</span>
        <span className="font-mono uppercase tracking-[0.14em] text-[10px] font-bold text-hld-text">
          Reverse Outline Doctor
        </span>
      </div>

      <div className="flex items-center gap-1" role="group" aria-label="Mode">
        {modeBtn('instruments', 'Instruments')}
        {modeBtn('wizard', 'Sequence')}
      </div>

      <label className="flex items-center gap-2 min-w-0">
        <span className="font-mono uppercase tracking-[0.14em] text-[9px] text-hld-muted-text">Scope</span>
        <select
          value={targetId ?? ''}
          onChange={(e) => setTarget(e.target.value || null)}
          disabled={busy}
          className="max-w-[220px] truncate font-mono text-[10px] px-2 py-1 rounded border border-hld-border bg-hld-surface text-hld-text outline-none cursor-pointer disabled:opacity-50"
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

      {busy && (
        <span className="ml-auto font-mono uppercase tracking-[0.14em] text-[9px] text-hld-cyan animate-pulse shrink-0">
          {status === 'streaming' ? 'Diagnosing…' : 'Reading…'}
        </span>
      )}
    </div>
  );
}
