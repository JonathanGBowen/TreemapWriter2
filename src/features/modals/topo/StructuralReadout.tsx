/* StructuralReadout.tsx — the FilterBar's metrics, recentred.

   The old readout led with ROUTE LENGTH + CROSSINGS — the "fewest-crossings"
   neatness Wertheimer names as premature closure ("seductive simplification").
   This leads instead with the STRUCTURAL truth read off the direction of the
   arrows: the backward-arc verdict, RANK SPAN (the depth of the dependency order),
   and MISCENTER (how much of the field fights its own reading order). The cosmetic
   route metrics remain, dimmed and secondary, and only where they mean something
   (ATLAS).

   The order verdict (Phase 5 — completing the Phase-0 softening): a backward arc
   (a prerequisite placed after its dependent) is no longer an unconditional
   violation. Once the writer has drawn W₁ structure, the precedence engine tells a
   COVERED inversion (deliberate — a gap-before-filling constraint, or an open IOU;
   neutral) from an UNCOVERED one (a genuine read-ahead; the warning hue). Until
   there is structure to grade with (`orderGraded === false`), the count is shown
   NEUTRALLY as BACKWARD, as in Phase 0 — no verdict, no warning hue. */

import React from 'react';
import { TK } from './tk';
import type { Metrics } from './topo-sim-atlas';
import type { Centering } from './topo-centering';
import type { OrderVerdict } from '../../../lib/precedence';
import type { CenterDivergence } from '../../../lib/structural-graph-helpers';

const mono = 'JetBrains Mono, monospace';

const Cell: React.FC<{ label: string; val: string | number; c: string; dim?: boolean }> = ({ label, val, c, dim }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.1, opacity: dim ? 0.5 : 1 }}>
    <span style={{ fontFamily: mono, fontSize: 6.5, color: TK.dim, letterSpacing: '0.14em', fontWeight: 700 }}>{label}</span>
    <span style={{ fontFamily: mono, fontSize: 11, color: c, fontWeight: 800 }}>{val}</span>
  </div>
);

export const StructuralReadout: React.FC<{ centering: Centering; land: Metrics; atlas: boolean; divergence?: CenterDivergence; orderVerdict?: OrderVerdict; orderGraded?: boolean }> = ({ centering, land, atlas, divergence, orderVerdict, orderGraded }) => {
  const graded = !!orderGraded;
  const uncovered = orderVerdict ? orderVerdict.uncoveredCount : centering.backwardCount;
  const covered = orderVerdict?.coveredCount ?? 0;
  const miscPct = Math.round((orderVerdict ? orderVerdict.orderMiscentering : centering.miscentering) * 100);
  const showDecl = !!divergence && divergence.declaredIds.length > 0;
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0, paddingRight: 2 }}
      title="The structural centre, read off the direction of the arrows. A backward arc is a prerequisite placed after its dependent (read-ahead). Once W₁ structure is drawn, the precedence engine splits these into COVERED (a deliberate inversion — gap-before-filling, or an open IOU; neutral) and UNCOVERED (a genuine read-ahead; warning). With no structure to grade with, the count is shown neutrally as BACKWARD. RANK SPAN = depth of the dependency order. MISCENTER = share of dependencies left uncovered. Route metrics are cosmetic and secondary."
    >
      {graded ? (
        <>
          <Cell label="UNCOVERED" val={uncovered} c={uncovered > 0 ? TK.magenta : TK.green} />
          {covered > 0 && <Cell label="COVERED" val={covered} c={TK.purple} />}
        </>
      ) : (
        <Cell label="BACKWARD" val={uncovered + covered} c={uncovered + covered > 0 ? TK.purple : TK.green} />
      )}
      <Cell label="RANK SPAN" val={centering.maxRank} c={TK.purple} />
      <Cell label="MISCENTER" val={miscPct + '%'} c={graded && uncovered > 0 ? TK.magenta : miscPct > 0 ? TK.purple : TK.green} />
      {showDecl && (
        <span
          style={{ display: 'flex' }}
          title="DECL≠COMP — how many parts the writer has DECLARED to be the centre that sit off the COMPUTED radix (the source of the arrows). A declared centre is a claim compared against the computation, not a verdict: the writer may be right and the arrows misarranged. Shown neutrally."
        >
          <Cell label="DECL≠COMP" val={divergence.divergentIds.length} c={divergence.diverges ? TK.purple : TK.green} />
        </span>
      )}
      {atlas && (
        <>
          <div style={{ width: 1, height: 16, background: TK.border }} />
          <Cell label="ROUTE LEN" val={land.len.toLocaleString() + 'u'} c={TK.muted} dim />
          <Cell label="CROSS" val={land.cross} c={TK.muted} dim />
        </>
      )}
    </div>
  );
};
