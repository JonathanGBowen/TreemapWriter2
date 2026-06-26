import { ConfirmModal } from 'treemap-writer';

const noop = () => {};

// The destructive-confirm overlay: magenta alert disc, mono uppercase title,
// quiet CANCEL + lit magenta CONFIRM. Renders its own fixed full-card overlay
// + dark surface, so no extra frame is needed.
export const DiscardRevision = () => (
  <ConfirmModal
    isOpen
    message="Discard the 4 unsaved revisions in this section? The woven draft will be lost and the section reverts to its last committed state."
    onConfirm={noop}
    onCancel={noop}
  />
);

// A shorter prompt — deleting a whole draft branch from version history.
export const DeleteDraft = () => (
  <ConfirmModal
    isOpen
    message="Delete draft B and its entire revision lineage? This cannot be undone."
    onConfirm={noop}
    onCancel={noop}
  />
);
