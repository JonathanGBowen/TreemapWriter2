import type { ReactNode } from 'react';
import { PanelHeader } from 'treemap-writer';

const Frame = ({ children }: { children: ReactNode }) => (
  <div className="bg-hld-bg text-hld-text font-sans" style={{ margin: -24, padding: 24 }}>
    {children}
  </div>
);

const sec = (title: string) => ({ id: 's1', title, level: 2, wordCount: 540 } as never);

// A diagnostic carrying just `overallReadiness` — the only field the header reads.
const diag = (level: 'draft' | 'developing' | 'nearly-there' | 'solid') =>
  ({ overallReadiness: level, moveResults: [], coherenceNotes: [], nextPriority: '' } as never);

// The four readiness levels — diamonds fill 1→4 and shift hue
// (magenta → yellow → cyan → green) as the section matures. Right-aligned
// meta is the Spec-tab move tally.
export const ReadinessLevels = () => (
  <Frame>
    <div className="flex flex-col gap-[14px] max-w-[360px]">
      {([
        ['Why Externalism Fails', 'draft', '0 of 5 moves done'],
        ['The Causal-Historical Theory', 'developing', '2 of 5 moves done'],
        ['Kripke on Rigid Designation', 'nearly-there', '4 of 5 moves done'],
        ['Reference and Necessity', 'solid', '5 of 5 moves done'],
      ] as const).map(([title, level, meta]) => (
        <div key={level} className="bg-hld-surface border border-hld-border">
          <PanelHeader section={sec(title)} diagnostic={diag(level)} meta={meta} />
        </div>
      ))}
    </div>
  </Frame>
);

// Undiagnosed — hollow ◇◇◇◇, no readiness label — with the settings gear and a
// version caption as meta (the Analysis-tab variant).
export const UndiagnosedWithSettings = () => (
  <Frame>
    <div className="max-w-[360px] bg-hld-surface border border-hld-border">
      <PanelHeader
        section={sec('Two Dogmas of Empiricism')}
        meta="analysis 3 · 2h ago"
        onOpenSettings={() => {}}
        settingsLabel="Section settings"
      />
    </div>
  </Frame>
);
