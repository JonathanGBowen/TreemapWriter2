// Shared display vocabulary for the Spec Test surfaces (the workspace report and
// the Version Compare fold), so both render the same chips with no divergence.
import type { PipStatus } from '../shared/Pip';
import type { ComparisonDirection, MoveDelta, SectionSpecTest, StructuralTruth, WholeSignatureAlignment } from '../../types';

/** Structural-truth → pip. tF/whole-false are alarming (magenta); fT is a genuine
 *  good read from a rougher draft (cyan); whole-true is the clean win (green). */
export const TRUTH_PIP: Record<StructuralTruth, PipStatus> = {
  'whole-true': 'green',
  tF: 'magenta',
  fT: 'cyan',
  'whole-false': 'magenta',
  lateral: 'purple',
};

export const TRUTH_LABEL: Record<StructuralTruth, string> = {
  'whole-true': 'Whole-true',
  tF: 'tF · piece-improvement',
  fT: 'fT · truer to the whole',
  'whole-false': 'Whole-false',
  lateral: 'Lateral',
};

export const DIR_PIP: Record<ComparisonDirection, PipStatus> = {
  improved: 'green',
  regressed: 'magenta',
  mixed: 'yellow',
  lateral: 'cyan',
};

export const DIR_LABEL: Record<ComparisonDirection, string> = {
  improved: 'Improved',
  regressed: 'Regressed',
  mixed: 'Mixed',
  lateral: 'Lateral',
};

export const DELTA_PIP: Record<MoveDelta['delta'], PipStatus> = {
  gained: 'green',
  added: 'green',
  regressed: 'magenta',
  removed: 'magenta',
  deflated: 'yellow',
  held: 'idle',
};

export const DELTA_LABEL: Record<MoveDelta['delta'], string> = {
  gained: 'gained',
  added: 'added',
  regressed: 'regressed',
  removed: 'removed',
  deflated: 'deflated',
  held: 'held',
};

export const SIGNATURE_LABEL: Record<WholeSignatureAlignment, string> = {
  aligned: 'aligned',
  partial: 'partial',
  adrift: 'adrift',
};

export const SCOPE_LABEL: Record<SectionSpecTest['scopeReason'], string> = {
  changed: 'changed',
  'mesh-neighbour': 'mesh-neighbour',
  unchanged: 'unchanged',
  'a-only': 'cut in B',
  'b-only': 'new in B',
  'no-rubric': 'no rubric',
};
