import { useState } from 'react';
import { useStore } from '../../state';
import type { SessionProposal } from '../../state/revision-state';
import { roleLabel } from '../../lib/source-roles';
import { Confidence } from './Confidence';
import { Pip } from '../shared/Pip';
import { revisionTypeChipClass } from './revisionTypeColors';

const CHIP =
  'font-mono uppercase tracking-[0.14em] text-[9px] font-bold px-2 py-[3px] border inline-block';
const EYEBROW = 'font-mono uppercase tracking-[0.14em] text-[9px]';

interface CardProps {
  proposal: SessionProposal;
  large?: boolean;
  onAccept: (p: SessionProposal) => void;
  onReject: (id: string) => void;
}

/** Collapsed one-line strip an accepted/rejected proposal becomes, with undo. */
function ResolvedStrip({ proposal }: { proposal: SessionProposal }) {
  const resolveProposal = useStore((s) => s.resolveProposal);
  const accepted = proposal._status === 'accepted';
  return (
    <div
      className={`flex items-center gap-2.5 px-3 py-2 mb-2 border ${
        accepted ? 'border-hld-green/40 bg-hld-green/5' : 'border-hld-border bg-white/[0.012] opacity-60'
      }`}
    >
      <Pip status={accepted ? 'green' : 'dim'} />
      <span className={`${CHIP} ${revisionTypeChipClass[proposal.revision_type]} text-[8px]`}>
        {proposal.revision_type}
      </span>
      <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-hld-muted-text">
        {accepted ? 'Applied to draft' : 'Dismissed'}
      </span>
      <button
        type="button"
        onClick={() => resolveProposal(proposal.id, 'pending')}
        className="ml-auto font-mono text-[8.5px] uppercase tracking-[0.1em] text-hld-muted-text hover:text-hld-text"
      >
        undo
      </button>
    </div>
  );
}

/** The glass-box receipt: progressively disclosed source id + verbatim quote. */
function AuditTrail({ proposal, large }: { proposal: SessionProposal; large?: boolean }) {
  const source = useStore((s) => s.sources.find((x) => x.id === proposal.source_id));
  const [open, setOpen] = useState(!!large);

  // Sourceless proposal: no external receipt to disclose. State the grounding
  // plainly (the rationale above stands as the justification) rather than showing
  // an empty quote — the glass box stays honest about what it's based on.
  if (!proposal.verbatim_source_quote && !proposal.source_id) {
    return (
      <div className="mb-3 flex items-center gap-1.5 text-hld-muted-text font-mono text-[9px] uppercase tracking-[0.14em] py-1">
        <span className="text-[11px] opacity-80">◇</span>
        grounded in the document
      </div>
    );
  }

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 w-full text-left text-hld-muted-text font-mono text-[9px] uppercase tracking-[0.14em] py-1"
      >
        <span className={`inline-block transition-transform ${open ? 'rotate-90' : ''}`}>▸</span>
        audit trail
        <span className="ml-auto flex items-center gap-1.5 opacity-80">
          <span className="text-[11px]">{source?.glyph ?? '❡'}</span>
          {source ? roleLabel(source.role) : 'source'}
        </span>
      </button>
      {open && (
        <div className="mt-2 bg-hld-bg border border-hld-border p-3">
          <div className={`${EYEBROW} text-hld-muted-text mb-2`}>
            source id{' '}
            <span className="text-hld-cyan border border-hld-border bg-hld-surface px-1.5 py-0.5">
              {proposal.source_id || '—'}
            </span>
          </div>
          <blockquote className="m-0 border-l-2 border-hld-cyan pl-3 italic text-hld-muted-text font-mono text-[11px] leading-[1.55]">
            “{proposal.verbatim_source_quote}”
          </blockquote>
        </div>
      )}
    </div>
  );
}

/** The action row: preview toggle (left) · reject + accept (right). */
function CardActions({
  proposal,
  previewing,
  onPreview,
  onAccept,
  onReject,
}: {
  proposal: SessionProposal;
  previewing: boolean;
  onPreview: () => void;
  onAccept: (p: SessionProposal) => void;
  onReject: (id: string) => void;
}) {
  return (
    <div className="flex justify-between items-center gap-2 mt-3 pt-3 border-t border-hld-border">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onPreview();
        }}
        title="Show this edit inline in the master document"
        className={`px-2.5 py-1.5 border font-mono text-[10px] font-bold uppercase tracking-[0.12em] transition-all ${
          previewing
            ? 'border-hld-cyan/40 text-hld-cyan bg-hld-cyan/10 shadow-[0_0_10px_rgba(0,232,245,0.2)]'
            : 'border-hld-border text-hld-muted-text hover:text-hld-text'
        }`}
      >
        {previewing ? '◉ Previewing' : '◐ Preview in text'}
      </button>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onReject(proposal.id);
          }}
          className="px-2.5 py-1.5 border border-hld-border text-hld-muted-text hover:text-hld-text hover:bg-hld-surface-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] transition-all"
        >
          ✕ Reject
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAccept(proposal);
          }}
          className="px-2.5 py-1.5 border border-hld-cyan bg-hld-cyan/10 text-hld-cyan hover:bg-hld-cyan hover:text-hld-bg font-mono text-[10px] font-bold uppercase tracking-[0.12em] transition-all"
        >
          ✓ Accept
        </button>
      </div>
    </div>
  );
}

/** The shared proposal card: type chip · confidence · diff · rationale · receipt · actions. */
export function ProposalCard({ proposal, large, onAccept, onReject }: CardProps) {
  const activeId = useStore((s) => s.activeProposalId);
  const previewIds = useStore((s) => s.previewIds);
  const previewAll = useStore((s) => s.previewAll);
  const togglePreview = useStore((s) => s.toggleProposalPreview);
  const setActive = useStore((s) => s.setActiveProposal);

  if (proposal._status !== 'pending') return <ResolvedStrip proposal={proposal} />;

  const isActive = activeId === proposal.id;
  const previewing = previewAll || previewIds.includes(proposal.id);
  const delta =
    proposal.proposed_text.replace(proposal.original_text, '').trim() || proposal.proposed_text;

  return (
    <div
      onClick={() => setActive(proposal.id)}
      className={`mb-3 p-4 border bg-hld-surface cursor-pointer transition-shadow ${
        isActive ? 'border-hld-cyan/45 shadow-[0_0_18px_rgba(0,232,245,0.12)]' : 'border-hld-border'
      }`}
    >
      <div className="flex justify-between items-start gap-2.5 mb-3">
        <div>
          <span className={`${CHIP} ${revisionTypeChipClass[proposal.revision_type]}`}>
            {proposal.revision_type}
          </span>
          <div className={`${EYEBROW} text-hld-muted-text mt-2 flex items-center gap-1.5`}>
            <span>section</span>
            <span className="text-hld-cyan font-bold normal-case tracking-normal">
              {proposal.section || '—'}
            </span>
          </div>
        </div>
        <Confidence score={proposal.confidence_score} large={large} />
      </div>

      <div className="mb-3">
        <div className={`${EYEBROW} text-hld-feat-confidence mb-1.5`}>proposed change</div>
        <div
          className={`font-mono leading-[1.6] border border-hld-border bg-hld-bg p-2.5 ${
            large ? 'text-[13px]' : 'text-[11.5px]'
          }`}
        >
          {/* eslint-disable-next-line no-restricted-syntax */}
          <span className="line-through text-[#ff7aa6] bg-hld-magenta/10">
            {proposal.original_text}
          </span>{' '}
          {/* eslint-disable-next-line no-restricted-syntax */}
          <span className="text-[#7dffb0] bg-hld-green/10">{delta}</span>
        </div>
      </div>

      <div className="mb-3">
        <div className={`${EYEBROW} text-hld-cyan mb-1.5`}>rationale</div>
        <p className={`m-0 font-mono leading-[1.55] text-hld-text ${large ? 'text-[12.5px]' : 'text-[11px]'}`}>
          {proposal.rationale}
        </p>
      </div>

      <AuditTrail proposal={proposal} large={large} />

      <CardActions
        proposal={proposal}
        previewing={previewing}
        onPreview={() => {
          togglePreview(proposal.id);
          setActive(proposal.id);
        }}
        onAccept={onAccept}
        onReject={onReject}
      />
    </div>
  );
}
