import { SprintSetup } from 'treemap-writer';

const noop = () => {};

// The sprint co-define modal (wrapped in ModalShell): pick the type (Goal / Draft),
// the total minutes, and — for Draft sprints — an Argument Shape that seeds the
// plan. The lit "▶ Start" is the single primary; "Start with coach" hands off to
// the guided coach. Renders its own fixed full-card overlay, so no Frame.

// Draft (content) sprint — the full setup with the stacked Argument Shape cards,
// the first shape pre-selected (cyan wash). 35 min · 6 moves on the Start button.
export const DraftSprint = () => (
  <SprintSetup
    mode="content"
    onModeChange={noop}
    sectionTitle="§3.2 — The regress objection"
    onStart={noop}
    onCoach={noop}
    onClose={noop}
  />
);

// Goal sprint — no shapes; just type + time and the cyan explainer about
// reinstating context then writing the one sentence the section must earn.
export const GoalSprint = () => (
  <SprintSetup
    mode="goal"
    onModeChange={noop}
    sectionTitle="§1 — Introduction"
    onStart={noop}
    onCoach={noop}
    onClose={noop}
  />
);
