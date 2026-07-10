import { describe, expect, it } from 'vitest';
import {
  buildCoachPlanOpening,
  buildReentryOpening,
  buildUnstickOpening,
  extractOpeningDeposit,
  stripDepositBlock,
} from '../dialogue-openings';

describe('extractOpeningDeposit', () => {
  it('parses a fenced deposit block', () => {
    const turn = [
      'Then the sitting is the regress reply.',
      '```json',
      '{"deposit": {"kind": "reentry", "wish": "Answer the regress in §3.2", "firstStep": "Reread the objection paragraph", "sectionId": "sec-3-2"}}',
      '```',
    ].join('\n');
    expect(extractOpeningDeposit(turn)).toEqual({
      kind: 'reentry',
      wish: 'Answer the regress in §3.2',
      firstStep: 'Reread the objection paragraph',
      vector: undefined,
      sectionId: 'sec-3-2',
      goodEnough: undefined,
    });
  });

  it('returns null for plain inquiry turns and empty deposits', () => {
    expect(extractOpeningDeposit('What is pulling you back to chapter 2?')).toBeNull();
    expect(extractOpeningDeposit('```json\n{"deposit": {"kind": "reentry"}}\n```')).toBeNull();
    expect(extractOpeningDeposit('```json\n{"other": true}\n```')).toBeNull();
  });

  it('recognizes the good-enough permission (unstick outcome c)', () => {
    const turn = '```json\n{"deposit": {"kind": "unstick", "goodEnough": true, "sectionId": "next-1"}}\n```';
    expect(extractOpeningDeposit(turn)).toMatchObject({ goodEnough: true, sectionId: 'next-1' });
  });
});

describe('stripDepositBlock', () => {
  it('removes the fenced block, keeping the sentence', () => {
    const turn = 'The deposit is ready.\n```json\n{"deposit":{}}\n```';
    expect(stripDepositBlock(turn)).toBe('The deposit is ready.');
  });
});

describe('buildReentryOpening', () => {
  it('composes the deterministic record with the deposit contract', () => {
    const opening = buildReentryOpening({
      activityBrief: '- last touched: 4 days ago',
      strainHeadline: 'Chapter B: unmet incoming (← Chapter A)',
      currentSection: { id: 'b', title: 'Chapter B' },
      nextAction: { gap: 'the reply to the regress', vector: 'state the stopping condition' },
      sections: [
        { id: 'a', title: 'Chapter A' },
        { id: 'b', title: 'Chapter B' },
      ],
    });
    expect(opening.kind).toBe('reentry');
    expect(opening.turnBudget).toBe(4);
    expect(opening.sectionId).toBe('b');
    expect(opening.context).toContain('RECENT ACTIVITY:\n- last touched: 4 days ago');
    expect(opening.context).toContain('TOP STRAIN: Chapter B: unmet incoming');
    expect(opening.context).toContain('NEXT DEMAND (current section): the reply to the regress → state the stopping condition');
    expect(opening.context).toContain('b — Chapter B');
    expect(opening.context).toContain('"deposit"');
  });

  it('says so when no record exists yet', () => {
    const opening = buildReentryOpening({ activityBrief: null, sections: [] });
    expect(opening.context).toContain('(no recorded sessions or snapshots yet)');
  });

  it('caps the section index', () => {
    const sections = Array.from({ length: 80 }, (_, i) => ({ id: `s${i}`, title: `T${i}` }));
    const opening = buildReentryOpening({ activityBrief: null, sections });
    expect(opening.context).toContain('(and 20 more)');
    expect(opening.context).not.toContain('s75 —');
  });
});

describe('buildCoachPlanOpening', () => {
  it('carries the plan verbatim and the deposit contract', () => {
    const opening = buildCoachPlanOpening({
      plan: '1. Draft the regress reply.\n2. Stitch it in.',
      structureSummary: '[{"title":"B","status":"draft"}]',
      activityBrief: '- last touched: yesterday',
      sections: [{ id: 'b', title: 'Chapter B' }],
    });
    expect(opening.kind).toBe('coach-plan');
    expect(opening.turnBudget).toBe(4);
    expect(opening.context).toContain("THE COACH'S PLAN");
    expect(opening.context).toContain('Draft the regress reply');
    expect(opening.context).toContain('RECENT ACTIVITY:\n- last touched: yesterday');
    expect(opening.context).toContain('"kind": "coach-plan"');
  });
});

describe('buildUnstickOpening', () => {
  it('offers all three located outcomes and points the good-enough deposit at the next section', () => {
    const opening = buildUnstickOpening({
      section: { id: 'b', title: 'Chapter B', content: 'The section prose.' },
      surround: '↘ SUPPLIES: the typology',
      mainClaim: 'B earns the typology',
      nextAction: { gap: 'the reply', vector: 'state the stopping condition' },
      activeStep: 'Draft move one',
      nextSectionId: 'c',
    });
    expect(opening.kind).toBe('unstick');
    expect(opening.turnBudget).toBe(3);
    expect(opening.sectionId).toBe('b');
    expect(opening.context).toContain('STUCK ON: "Chapter B" (b)');
    expect(opening.context).toContain('THIS SECTION MUST EARN: B earns the typology');
    expect(opening.context).toContain('LAST DEMAND: the reply → state the stopping condition');
    expect(opening.context).toContain('ACTIVE SPRINT STEP: Draft move one');
    expect(opening.context).toContain('SECTION TEXT:\n---\nThe section prose.\n---');
    // permission-to-stop deposits jump to the NEXT section
    expect(opening.context).toContain('"goodEnough": true, "sectionId": "c"');
    // a located next action stays here
    expect(opening.context).toContain('"vector": "<the concrete move>", "sectionId": "b"');
  });

  it('falls back to nextPriority and stays on the section when there is no next', () => {
    const opening = buildUnstickOpening({
      section: { id: 'only', title: 'Sole', content: 'x' },
      nextPriority: 'tighten the intro',
      nextSectionId: null,
    });
    expect(opening.context).toContain('LAST PRIORITY: tighten the intro');
    expect(opening.context).toContain('"goodEnough": true, "sectionId": "only"');
  });
});
