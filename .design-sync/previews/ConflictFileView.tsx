import type { ReactNode } from 'react';
import { ConflictFileView } from 'treemap-writer';

const Frame = ({ children }: { children: ReactNode }) => (
  <div className="bg-hld-bg text-hld-text font-sans" style={{ margin: -24, padding: 24 }}>
    {children}
  </div>
);

const noop = () => {};

// A text conflict on a section file: a stable lead-in paragraph, then one
// markered hunk where LOCAL tightened the thesis and REMOTE rephrased it. The
// per-hunk LOCAL/REMOTE picker plus the whole-file shortcuts and manual-edit
// escape hatch.
const mergedText = `## The Treemap Is the Document

The treemap is not a chart bolted onto a document.
<<<<<<< LOCAL
It *is* the document, re-projected: area is argumentative weight, hue is finish.
=======
It is the same prose, re-projected — each node a section, sized by its weight.
>>>>>>> REMOTE
Every node is a section the reader can open.`;

export const TextConflict = () => (
  <Frame>
    <div className="max-w-[520px]">
      <ConflictFileView
        file={{
          path: 'sections/01-thesis.md',
          kind: 'text',
          merged: mergedText,
          automergeable: false,
          ourDeleted: false,
          theirDeleted: false,
        }}
        onChange={noop}
      />
    </div>
  </Frame>
);

// A binary / non-UTF-8 asset (an exported topology diagram): no hunks to merge,
// so the whole-file LOCAL/REMOTE wholesale picker.
export const BinaryConflict = () => (
  <Frame>
    <div className="max-w-[520px]">
      <ConflictFileView
        file={{
          path: 'assets/argument-map.png',
          kind: 'binary',
          automergeable: false,
          ourDeleted: false,
          theirDeleted: false,
        }}
        onChange={noop}
      />
    </div>
  </Frame>
);

// A modify/delete conflict: remote deleted the spec while you kept editing it.
// Keep the surviving file or accept the deletion.
export const ModifyDelete = () => (
  <Frame>
    <div className="max-w-[520px]">
      <ConflictFileView
        file={{
          path: 'project.spec.json',
          kind: 'modifyDelete',
          automergeable: false,
          ourDeleted: false,
          theirDeleted: true,
        }}
        onChange={noop}
      />
    </div>
  </Frame>
);
