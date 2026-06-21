import React, { useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useStore } from '../../store';
import { useCurrentSection } from '../tests-panel/use-current-section';
import { selectSpecMap } from '../../lib/spec-map';
import { buildStructuralSurround } from '../../lib/diagnostic-helpers';

/**
 * The part-in-whole rail. The writer's documented core deficit is losing the
 * argument-of-the-whole while writing a part — so the surround is pinned, shown
 * in BOTH focus and normal mode, never summoned. It renders only
 * role-reconstructions (claims + commitments from neighbours' specs), never raw
 * prose, and renders nothing at all when there is no spec yet (no noise).
 */
const Chip: React.FC<{ text: string }> = ({ text }) => (
  <span className="inline-block max-w-[320px] truncate align-middle px-[7px] py-[2px] bg-hld-surface border border-hld-border text-hld-text text-[10px] font-sans leading-[1.5]" title={text}>
    {text}
  </span>
);

const Row: React.FC<{ label: string; glyph: string; items: string[]; tone?: string }> = ({
  label,
  glyph,
  items,
  tone = 'text-hld-muted-text',
}) => {
  if (!items.length) return null;
  return (
    <div className="flex items-baseline gap-[8px] min-w-0">
      <span className={`shrink-0 ${tone} text-[9px] font-mono uppercase tracking-[0.14em] flex items-center gap-[4px] w-[96px]`}>
        <span className="text-[11px] leading-none">{glyph}</span>
        {label}
      </span>
      <div className="flex flex-wrap gap-[5px] min-w-0">
        {items.map((t, i) => <Chip key={i} text={t} />)}
      </div>
    </div>
  );
};

export const SurroundRail: React.FC = () => {
  const sections = useStore((s) => s.sections);
  const testSuite = useStore((s) => s.testSuite);
  const collapsed = useStore((s) => s.surroundCollapsed);
  const setCollapsed = useStore((s) => s.setSurroundCollapsed);
  const currentSection = useCurrentSection();

  const { surround, ownSpec } = useMemo(() => {
    if (!currentSection) return { surround: {}, ownSpec: undefined };
    const specs = selectSpecMap(testSuite);
    return {
      surround: buildStructuralSurround(currentSection.id, sections, specs),
      ownSpec: specs[currentSection.id],
    };
  }, [currentSection?.id, sections, testSuite]);

  const documentClaim = surround.documentClaim;
  const parentClaim = surround.parentClaim;
  // "Receives" = this section's own incoming context, backed by what the
  // preceding section committed to establish. "Supplies" = its own outgoing
  // commitments, which must meet what the following section needs.
  const receives = [
    ...(ownSpec?.incomingContext ?? []),
    ...(surround.upstreamCommitments ?? []),
  ].map((s) => s.trim()).filter(Boolean);
  const supplies = [
    ...(ownSpec?.outgoingCommitments ?? []),
    ...(surround.downstreamNeeds ?? []),
  ].map((s) => s.trim()).filter(Boolean);

  const hasAnything =
    !!documentClaim || !!parentClaim || receives.length > 0 || supplies.length > 0;

  // No spec → no surround → render nothing. Silence is the right default.
  if (!currentSection || !hasAnything) return null;

  return (
    <div className="w-full max-w-[800px] mx-auto px-[64px] pt-[10px] z-10 shrink-0">
      <div className="border-l-2 border-hld-cyan/30 pl-[10px] bg-[#070d13]/60">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-[5px] text-hld-cyan/70 hover:text-hld-cyan text-[9px] font-mono uppercase tracking-[0.16em] transition-colors py-[2px]"
          title="Part-in-whole — where this section sits in the argument"
        >
          {collapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
          In the whole
        </button>
        {!collapsed && (
          <div className="flex flex-col gap-[5px] pb-[8px] pt-[3px]">
            {documentClaim && (
              <Row label="Whole" glyph="◇" items={[documentClaim]} tone="text-hld-cyan/70" />
            )}
            {parentClaim && <Row label="Parent" glyph="◈" items={[parentClaim]} />}
            <Row label="Receives" glyph="→" items={receives} />
            <Row label="Supplies" glyph="↘" items={supplies} />
          </div>
        )}
      </div>
    </div>
  );
};
