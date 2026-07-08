// Store→editor bridge for the durable provenance layer (F2): pushes the
// current marks into a surface's CodeMirror view whenever they change.
// Provenance is domain data that must read identically on EVERY prose surface
// (document-state's contract), so every CodeMirror that renders the manuscript
// mounts this hook next to its ref. The field itself (lib/provenanceMarks)
// stays store-free; this hook owns the coupling.

import { useEffect } from 'react';
import type { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { setProvenanceMarks } from '../../lib/provenanceMarks';
import { useStore } from '../../store';

export function useProvenanceSync(ref: React.RefObject<ReactCodeMirrorRef | null>): void {
  const provenanceMarks = useStore((s) => s.provenanceMarks);
  useEffect(() => {
    const view = ref.current?.view;
    if (view) view.dispatch({ effects: setProvenanceMarks.of(provenanceMarks) });
  }, [provenanceMarks, ref]);
}
