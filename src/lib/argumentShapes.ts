// Living Sprints — Argument Shapes (Direction C). The dissertation analog to
// the Songwriting Sprint's song-structure presets: reusable argumentative shapes
// that seed a sprint plan. Pure, read-only seed data for v1 (like
// `lib/defaultPersonas.ts` / `lib/defaultSpells.ts`) — no React, no store.
//
// Each shape opens with a `reinstate` move (Direction D) and carries *relative*
// weights, scaled to the writer's chosen total minutes at runtime by
// `lib/sprintPlan.ts`. Content is in the user's register; tune freely — it is
// content, not contract. The role→color contract lives in `lib/sprintRoles.ts`.

import type { ArgumentShape } from '../types';

export const DEFAULT_ARGUMENT_SHAPES: ArgumentShape[] = [
  {
    id: 'objection-reply',
    name: 'Objection & Reply',
    description:
      'Steelman a challenge, locate the premise it hits, answer or concede-and-narrow, name what it costs you.',
    moves: [
      {
        title: 'Reinstate',
        role: 'reinstate',
        weight: 3,
        instructions: [
          `Reread the section goal + your last sentence.`,
          `State in one line where you are.`,
          `Skim the reattached fragments.`,
        ],
      },
      {
        title: 'Steelman the objection',
        role: 'stress',
        weight: 8,
        instructions: [
          `Write the challenge in its strongest form.`,
          `No strawman — make it hurt.`,
          `One paragraph, no reply yet.`,
        ],
      },
      {
        title: 'Locate the premise',
        role: 'frame',
        weight: 6,
        instructions: [
          `Which premise does the objection actually target?`,
          `Name it in one sentence.`,
          `Mark where it lives in your draft.`,
        ],
      },
      {
        title: 'Draft the reply',
        role: 'draft',
        weight: 12,
        instructions: [
          `Answer it, or concede-and-narrow.`,
          `One move per paragraph.`,
          `Don't polish — get it down.`,
        ],
      },
      {
        title: 'Name the residue + bridge',
        role: 'synthesize',
        weight: 6,
        instructions: [
          `What does the objection still cost you?`,
          `Write the sentence that hands off to the next section.`,
        ],
      },
    ],
  },
  {
    id: 'analytic-argument',
    name: 'Analytic Argument',
    description:
      'Frame the single claim, marshal considerations, draft one move per paragraph, stress-test, bridge.',
    moves: [
      {
        title: 'Reinstate',
        role: 'reinstate',
        weight: 3,
        instructions: [`Reread goal + last sentence.`, `One line on where you are.`],
      },
      {
        title: 'Frame the claim',
        role: 'frame',
        weight: 5,
        instructions: [
          `Write the single sentence this section must earn.`,
          `No hedging, no "in some sense".`,
        ],
      },
      {
        title: 'Marshal',
        role: 'marshal',
        weight: 6,
        instructions: [
          `List the 3–4 considerations/texts that support it.`,
          `Just name them — no prose yet.`,
        ],
      },
      {
        title: 'Draft the steps',
        role: 'draft',
        weight: 13,
        instructions: [`Turn each consideration into a paragraph.`, `One move per paragraph.`],
      },
      {
        title: 'Stress-test',
        role: 'stress',
        weight: 7,
        instructions: [
          `Write the strongest objection.`,
          `Answer it in two sentences, or concede and narrow the claim.`,
        ],
      },
      {
        title: 'Bridge',
        role: 'bridge',
        weight: 4,
        instructions: [`Write the sentence that hands off to the next section.`],
      },
    ],
  },
  {
    id: 'literature-synthesis',
    name: 'Literature Synthesis',
    description:
      "Name the camps, one sentence per source's core move, find the axis they disagree on, position yourself.",
    moves: [
      {
        title: 'Reinstate',
        role: 'reinstate',
        weight: 3,
        instructions: [`Reread goal + last sentence.`, `Recall which sources are in play.`],
      },
      {
        title: 'Name the camps',
        role: 'marshal',
        weight: 6,
        instructions: [
          `What are the 2–3 positions in this literature?`,
          `Label each in a phrase.`,
        ],
      },
      {
        title: 'Core moves',
        role: 'draft',
        weight: 10,
        instructions: [
          `One sentence per source: what does it actually argue?`,
          `Resist summary — state the move.`,
        ],
      },
      {
        title: 'Find the axis',
        role: 'frame',
        weight: 6,
        instructions: [`What single question do they disagree about?`, `Write it as one sentence.`],
      },
      {
        title: 'Position yourself',
        role: 'synthesize',
        weight: 6,
        instructions: [
          `Where do you stand on that axis, and why?`,
          `Draft the paragraph that says so.`,
        ],
      },
    ],
  },
  {
    id: 'conceptual-distinction',
    name: 'Conceptual Distinction',
    description: 'Name the conflation, draw the line, test it against a hard case, state what now follows.',
    moves: [
      {
        title: 'Reinstate',
        role: 'reinstate',
        weight: 3,
        instructions: [`Reread goal + last sentence.`, `Recall the concept at issue.`],
      },
      {
        title: 'Name the conflation',
        role: 'stress',
        weight: 7,
        instructions: [
          `What two things are being run together?`,
          `State the confusion in one sentence.`,
        ],
      },
      {
        title: 'Draw the line',
        role: 'draft',
        weight: 9,
        instructions: [`Define each side cleanly.`, `Give the criterion that separates them.`],
      },
      {
        title: 'Hard case + upshot',
        role: 'stress',
        weight: 6,
        instructions: [
          `Run the distinction against the hardest borderline case.`,
          `State what now follows for the argument.`,
        ],
      },
    ],
  },
  {
    id: 'case-analysis',
    name: 'Case Analysis',
    description: 'Lay out the case, extract the principle in play, run the variants, report what it shows.',
    moves: [
      {
        title: 'Reinstate',
        role: 'reinstate',
        weight: 3,
        instructions: [`Reread goal + last sentence.`, `Recall why this case earns its place.`],
      },
      {
        title: 'The case',
        role: 'marshal',
        weight: 7,
        instructions: [
          `State the case plainly — just enough detail to do the work.`,
          `No editorializing yet.`,
        ],
      },
      {
        title: 'The principle',
        role: 'frame',
        weight: 6,
        instructions: [`What general principle is actually in play here?`, `One sentence.`],
      },
      {
        title: 'Variants',
        role: 'stress',
        weight: 8,
        instructions: [`Vary the case.`, `Which changes flip the verdict, and which don't?`],
      },
      {
        title: 'Report',
        role: 'synthesize',
        weight: 5,
        instructions: [
          `What does the case + variants establish for your argument?`,
          `Draft the upshot paragraph.`,
        ],
      },
    ],
  },
];

/** Look up a shape by id (used when re-hydrating a plan's `shapeId`). */
export function findArgumentShape(id: string | null): ArgumentShape | undefined {
  if (!id) return undefined;
  return DEFAULT_ARGUMENT_SHAPES.find((s) => s.id === id);
}
