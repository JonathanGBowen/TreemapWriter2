import { useStore } from '../../store';
import { Spinner } from '../shared/Spinner';
import { Pip } from '../shared/Pip';
import { AgentTraceTicker } from '../shared/AgentTraceTicker';
import { ModalShell } from './ModalShell';
import { useAuditActions } from '../audit/use-audit-actions';
import type { AuditFinding, AuditFindingKind } from '../../types';

const KIND_LABEL: Record<AuditFindingKind, string> = {
  'unargued-commitment': 'unargued commitment',
  'unsupported-assumption': 'unsupported assumption',
  'drifted-claim': 'drifted claim',
  'orphaned-commitment': 'orphaned commitment',
};

const relation = (f: AuditFinding): string => {
  if (!f.relatedSectionTitle) return '';
  const arrow = f.direction === 'upstream' ? '←' : f.direction === 'downstream' ? '→' : '·';
  return ` ${arrow} ${f.relatedSectionTitle}`;
};

/** One audit finding, mirroring the commitment-mesh card idiom: severity pip + kind
 *  label + a click-to-jump section ref + the grounded detail (+ any drift note). */
function FindingCard({ f, onJump }: { f: AuditFinding; onJump: () => void }) {
  return (
    <div className="border border-hld-border px-[13px] py-[11px] flex flex-col gap-[6px]">
      <div className="flex items-center gap-[8px]">
        <Pip status={f.severity === 'high' ? 'magenta' : 'yellow'} size="sm" title={f.severity} />
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-hld-muted-text">
          {KIND_LABEL[f.kind]}
        </span>
        <button
          type="button"
          onClick={onJump}
          className="ml-auto font-mono text-[9px] uppercase tracking-[0.1em] text-hld-muted-text hover:text-hld-cyan transition-colors truncate max-w-[60%]"
          title={`Go to "${f.sectionTitle}"`}
        >
          {f.sectionTitle}
          {relation(f)} →
        </button>
      </div>
      <div className="text-[13px] text-hld-text leading-[1.45]">{f.detail}</div>
      {f.drift && (
        <div className="font-mono text-[9px] text-hld-feat-tone/90 leading-[1.4]">drift · {f.drift}</div>
      )}
    </div>
  );
}

/**
 * The Argument Audit (WS4b): a read-only whole-document agent pass. Self-mounting on
 * `showAuditModal`. Idle → a one-line explainer + a lit Run; running → the live agent
 * trace ticker (the prominent "see it work"); review → findings ranked high→medium,
 * each jumping to its section. Fixes route through Revise; nothing writes here.
 */
export function AuditModal() {
  const isOpen = useStore((s) => s.showAuditModal);
  const setShow = useStore((s) => s.setShowAuditModal);
  const findings = useStore((s) => s.auditFindings);
  const status = useStore((s) => s.auditStatus);
  const runAt = useStore((s) => s.auditRunAt);
  const localAgentEnabled = useStore((s) => s.localAgentEnabled);
  const isProcessing = useStore((s) => s.isProcessing);
  const setSelectedId = useStore((s) => s.setSelectedId);
  const setShowPersonaModal = useStore((s) => s.setShowPersonaModal);
  const { runAudit } = useAuditActions();

  if (!isOpen) return null;
  const onClose = () => setShow(false);
  const running = status === 'running';
  const ranked = [...findings].sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === 'high' ? -1 : 1,
  );
  const jump = (id: string) => {
    setSelectedId(id);
    onClose();
  };

  return (
    <ModalShell
      accent="cyan"
      eyebrow="Argument"
      title="Audit"
      sub="Whole-document commitment & drift audit"
      onClose={onClose}
      onPrimary={runAudit}
      primaryLabel={running ? 'Auditing…' : runAt ? 'Re-run audit' : 'Run audit'}
      primaryDisabled={!localAgentEnabled || running || isProcessing}
      widthClass="max-w-lg"
    >
      <div className="flex flex-col gap-[12px]">
        {!localAgentEnabled && (
          <div className="font-mono text-[10px] text-hld-muted-text leading-[1.5]">
            The argument audit runs on the local agent.{' '}
            <button
              type="button"
              onClick={() => {
                onClose();
                setShowPersonaModal(true);
              }}
              className="text-hld-cyan hover:underline"
            >
              Enable it in AI settings
            </button>{' '}
            to read across sections + history.
          </div>
        )}

        {running ? (
          <div className="flex flex-col items-center gap-3 px-5 py-8 text-center">
            <Spinner />
            <div className="font-mono uppercase tracking-[0.14em] text-[9px] text-hld-cyan">
              Auditing the whole argument…
            </div>
            <div className="font-mono text-[9px] text-hld-muted-text max-w-[260px] leading-[1.6]">
              Reading across sections, searching the manuscript, and checking recent history for
              unargued commitments and drift.
            </div>
            <AgentTraceTicker
              kinds={['runAgent']}
              className="flex items-center gap-1.5 text-[10px] font-mono text-hld-muted max-w-[320px] min-w-0"
            />
          </div>
        ) : ranked.length ? (
          <div className="flex flex-col gap-[8px]">
            <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-hld-muted-text">
              {ranked.length} finding{ranked.length === 1 ? '' : 's'} · read-only — fix through Revise
            </div>
            {ranked.map((f) => (
              <FindingCard key={f.id} f={f} onJump={() => jump(f.sectionId)} />
            ))}
          </div>
        ) : runAt ? (
          <div className="font-mono text-[11px] text-hld-muted-text px-1 py-4 text-center">
            No unresolved structural gaps found across the document.
          </div>
        ) : (
          <div className="text-[12px] text-hld-muted-text leading-[1.5] px-1 py-2">
            Sweeps the whole manuscript for commitments relied on but never argued, assumptions
            their prerequisites don't establish, and claims that drifted across sections or
            revisions. Read-only: each finding points you to a section; you fix it through Revise.
            The agent's live trace shows while it runs.
          </div>
        )}
      </div>
    </ModalShell>
  );
}
