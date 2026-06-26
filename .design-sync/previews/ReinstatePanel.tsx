import type { ReactNode } from 'react';
import { ReinstatePanel } from 'treemap-writer';

const Frame = ({ children }: { children: ReactNode }) => (
  <div className="bg-hld-bg text-hld-text font-sans" style={{ margin: -24, padding: 24 }}>
    {children}
  </div>
);

// The opening move shown in place of the editor: the goal this section must earn
// (cyan rule), your verbatim last sentence (italic, magenta), and the prior
// fragments reattached (yellow). It is `flex-1 min-h-0`, so it gets a flex column
// stage with explicit height.

const Stage = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-col h-[420px] w-[460px] bg-hld-surface border border-hld-border p-[16px]">
    {children}
  </div>
);

// The full warm-start: a WOOP goal (wish + obstacle + if-then move), a last
// sentence from 4 days ago, and three reattached fragments.
export const WarmStart = () => (
  <Frame>
    <Stage>
      <ReinstatePanel
        lastTouchedDays={4}
        goal={{
          model: 'woop',
          wish: 'Land the reply to the regress objection and hand off cleanly to §4.',
          obstacle: "I'll reread the objection a fourth time instead of committing to a reply.",
          ifThen: 'If I catch myself rereading, then I will set a 2-minute timer and write one bad sentence anyway.',
        }}
        reinstatement={{
          goal: 'Show that the regress is benign because each step does independent explanatory work.',
          lastSentence:
            'But this only postpones the problem unless we can say why the third step is any better off than the first.',
          fragments: [
            { source: 'incoming context', text: 'The dependence claim from §2 — explanation requires a terminating ground.' },
            { source: 'incoming context', text: 'Hume’s worry: a chain of reasons can be infinite without vicious circularity.' },
            { source: 'earlier draft', text: '“Benign” vs “vicious” regress turns on whether each step adds explanatory content.' },
          ],
        }}
      />
    </Stage>
  </Frame>
);

// A plain (non-WOOP) goal sprint, never touched — empty section, no fragments:
// the panel shows its italic "you start fresh" / "no fragments" fallbacks.
export const FreshSection = () => (
  <Frame>
    <Stage>
      <ReinstatePanel
        lastTouchedDays={null}
        goal={{ model: 'plain', wish: 'Write the single sentence this section must earn.' }}
        reinstatement={{
          goal: 'Define the thesis of the methodology chapter.',
          lastSentence: '',
          fragments: [],
        }}
      />
    </Stage>
  </Frame>
);
