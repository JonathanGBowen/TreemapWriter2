import { Tutorial } from 'treemap-writer';

const noop = () => {};

// A faux HLD app backdrop (sidebar · editor · tests rail) so the card shows the
// onboarding tour OVER a real-looking app — and so #root isn't empty (react-joyride
// portals its dimmed overlay + welcome tooltip to document.body, leaving #root bare
// otherwise). Its first step targets `body`/center, so it renders the centered
// welcome tooltip with no DOM tour targets present.
const AppBackdrop = () => (
  <div className="bg-hld-bg text-hld-text font-sans" style={{ margin: -24 }}>
    <div className="flex h-[440px] text-[10px]">
      <aside className="w-[150px] border-r border-hld-border p-3 flex flex-col gap-[10px]">
        <div className="font-mono text-[8px] uppercase tracking-[0.18em] text-hld-muted-text">Sections</div>
        {['Introduction', 'The Argument', 'Objections', 'Synthesis'].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span className={`hld-pip ${['hld-pip-green', 'hld-pip-cyan', 'hld-pip-magenta', 'hld-pip-idle'][i]}`} />
            <span className={i === 1 ? 'text-hld-cyan' : 'text-hld-muted-text-2'}>{s}</span>
          </div>
        ))}
      </aside>
      <main className="flex-1 p-4 hld-scanline">
        <div className="font-mono text-[8px] uppercase tracking-[0.18em] text-hld-muted-text mb-2">The Argument · §2</div>
        <div className="space-y-2 text-hld-text leading-relaxed">
          <p>The treemap is not a chart bolted onto a document — it is the document, re-projected.</p>
          <p className="text-hld-muted-text-2">Every node is a section; its area is the weight of the argument it carries.</p>
        </div>
      </main>
      <aside className="w-[160px] border-l border-hld-border p-3 flex flex-col gap-[10px]">
        <div className="font-mono text-[8px] uppercase tracking-[0.18em] text-hld-muted-text">Tests</div>
        <div className="flex items-center gap-2 text-hld-green"><span className="hld-pip hld-pip-green" />Claim stated</div>
        <div className="flex items-center gap-2 text-hld-muted-text"><span className="hld-pip hld-pip-idle" />Evidence cited</div>
      </aside>
    </div>
  </div>
);

// The onboarding tour's welcome step, rendered over the app.
export const Welcome = () => (
  <>
    <AppBackdrop />
    <Tutorial run onFinish={noop} />
  </>
);
