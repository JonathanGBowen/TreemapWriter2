/* StructuralReadout.tsx — the FilterBar's metrics, recentred.

   The old readout led with ROUTE LENGTH + CROSSINGS — the "fewest-crossings"
   neatness Wertheimer names as premature closure ("seductive simplification").
   This leads instead with the STRUCTURAL truth read off the direction of the
   arrows: BACKWARD (prerequisites that sit after their dependents), RANK SPAN
   (the depth of the dependency order), and MISCENTER (how much of the field
   fights its own reading order). The cosmetic route metrics remain, dimmed and
   secondary, and only where they mean something (ATLAS).

   NOTE (interim, pending Phase 5 of the Arpeggio roadmap): a backward arc is NOT
   coded as a violation. Presentation order is fixed by the dynamics of grasping,
   which can legitimately invert logical dependence — a genetic or pedagogical order
   (instance before rule; a conclusion offered first as a promissory gap). Until the
   precedence engine can tell a covered/deliberate inversion from an uncovered one,
   BACKWARD and MISCENTER are reported NEUTRALLY, as structural facts, not verdicts
   (no warning hue); only a clean zero keeps the quiet green. See
   docs/arpeggio-integration.md §I.2 and §III (Phase 0/5). */

import React from 'react';
import { TK } from './tk';
import type { Metrics } from './topo-sim-atlas';
import type { Centering } from './topo-centering';
import type { CenterDivergence } from '../../../lib/structural-graph-helpers';

const mono = 'JetBrains Mono, monospace';

const Cell: React.FC<{ label: string; val: string | number; c: string; dim?: boolean }> = ({ label, val, c, dim }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.1, opacity: dim ? 0.5 : 1 }}>
    <span style={{ fontFamily: mono, fontSize: 6.5, color: TK.dim, letterSpacing: '0.14em', fontWeight: 700 }}>{label}</span>
    <span style={{ fontFamily: mono, fontSize: 11, color: c, fontWeight: 800 }}>{val}</span>
  </div>
);

export const StructuralReadout: React.FC<{ centering: Centering; land: Metrics; atlas: boolean; divergence?: CenterDivergence }> = ({ centering, land, atlas, divergence }) => {
  const back = centering.backwardCount;
  const miscPct = Math.round(centering.miscentering * 100);
  const showDecl = !!divergence && divergence.declaredIds.length > 0;
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0, paddingRight: 2 }}
      title="The structural centre, read off the direction of the arrows. BACKWARD = a prerequisite placed after its dependent (read-ahead). RANK SPAN = depth of the dependency order. MISCENTER = share of dependencies fighting reading order. These are structural facts, not verdicts: a backward arc may be a deliberate genetic or pedagogical order (instance before rule, or a conclusion offered first as a promissory gap), so they are shown neutrally, not as violations. Route metrics are cosmetic and secondary."
    >
      <Cell label="BACKWARD" val={back} c={back > 0 ? TK.purple : TK.green} />
      <Cell label="RANK SPAN" val={centering.maxRank} c={TK.purple} />
      <Cell label="MISCENTER" val={miscPct + '%'} c={miscPct > 0 ? TK.purple : TK.green} />
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
