import { describe, it, expect } from 'vitest';
import { selectActiveMove } from '../active-move';
import type { Section, TestSuiteEntry } from '../../../types';

const section = (id = 'sec-1'): Section => ({ id } as Section);

describe('selectActiveMove', () => {
  it('returns null with no section', () => {
    expect(selectActiveMove(null, undefined)).toBeNull();
  });

  it('returns null for the whole-document (root) node', () => {
    expect(selectActiveMove(section('root'), undefined)).toBeNull();
  });

  it('returns null when the section is solved', () => {
    const entry = {
      status: 'success',
      lastDiagnostic: { nextAction: { gap: 'g', vector: 'v' }, moveResults: [] },
    } as unknown as TestSuiteEntry;
    expect(selectActiveMove(section(), entry)).toBeNull();
  });

  it('prefers the diagnostic nextAction vector, with status from the worst unmet move', () => {
    const entry = {
      status: 'fail',
      lastDiagnostic: {
        nextAction: { gap: 'The objection is never answered', vector: 'Answer the objection in §2' },
        moveResults: [
          { moveId: 'm1', moveDescription: 'state thesis', status: 'present' },
          { moveId: 'm2', moveDescription: 'rebut', status: 'missing' },
        ],
      },
    } as unknown as TestSuiteEntry;
    const cue = selectActiveMove(section(), entry);
    expect(cue).toEqual({
      text: 'Answer the objection in §2',
      detail: 'The objection is never answered',
      status: 'missing',
      source: 'vector',
    });
  });

  it('falls back to the first unmet move when there is no nextAction', () => {
    const entry = {
      status: 'fail',
      lastDiagnostic: {
        moveResults: [
          { moveId: 'm1', moveDescription: 'state thesis', status: 'present' },
          { moveId: 'm2', moveDescription: 'rebut the critic', status: 'partial', suggestedAction: 'Name the critic, then rebut', diagnosis: 'rebuttal is gestured at, not made' },
        ],
      },
    } as unknown as TestSuiteEntry;
    const cue = selectActiveMove(section(), entry);
    expect(cue).toEqual({
      text: 'Name the critic, then rebut',
      detail: 'rebuttal is gestured at, not made',
      status: 'partial',
      source: 'move',
    });
  });

  it('surfaces missing before partial/unclear among move results', () => {
    const entry = {
      status: 'fail',
      lastDiagnostic: {
        moveResults: [
          { moveId: 'm1', moveDescription: 'partial one', status: 'partial' },
          { moveId: 'm2', moveDescription: 'the real gap', status: 'missing' },
        ],
      },
    } as unknown as TestSuiteEntry;
    expect(selectActiveMove(section(), entry)?.text).toBe('the real gap');
  });

  it('falls back to the spec first required move before any diagnostic', () => {
    const entry = {
      status: 'idle',
      spec: { requiredMoves: [{ id: 'r1', description: 'Define the key term' }] },
    } as unknown as TestSuiteEntry;
    const cue = selectActiveMove(section(), entry);
    expect(cue).toEqual({ text: 'Define the key term', status: 'missing', source: 'spec' });
  });

  it('returns null when there is no diagnostic and no spec', () => {
    const entry = { status: 'idle', goals: '' } as unknown as TestSuiteEntry;
    expect(selectActiveMove(section(), entry)).toBeNull();
  });
});
