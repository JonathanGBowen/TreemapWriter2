import { ModalShell } from 'treemap-writer';

const noop = () => {};

// The presentational HLD modal frame: top accent line + glow, quiet eyebrow/title
// header, scrolling body, and the default footer (quiet CANCEL + one lit primary).
// Renders its own fixed full-card overlay + dark surface, so no extra frame.
export const Default = () => (
  <ModalShell
    eyebrow="Revision Engine"
    title="Apply changes"
    sub="3 spans · woven assembly"
    onClose={noop}
    onPrimary={noop}
    primaryLabel="Apply"
  >
    <div className="font-sans text-hld-text text-[13px] leading-relaxed space-y-3">
      <p>
        Preview marks show where the engine would rewrite. Nothing touches the
        saved draft until you apply.
      </p>
      <div className="border border-hld-border bg-hld-surface2 px-3 py-2 font-mono text-[11px] text-hld-muted-text-2">
        + 2 sentences woven · 1 tightened
      </div>
    </div>
  </ModalShell>
);

// Magenta accent (destructive intent), custom width.
export const MagentaWide = () => (
  <ModalShell
    accent="magenta"
    eyebrow="Danger"
    title="Discard draft B"
    sub="This cannot be undone"
    widthClass="max-w-lg"
    onClose={noop}
    onPrimary={noop}
    primaryLabel="Discard"
  >
    <p className="font-sans text-hld-text text-[13px] leading-relaxed">
      Draft B and its 4 revisions will be permanently removed.
    </p>
  </ModalShell>
);
