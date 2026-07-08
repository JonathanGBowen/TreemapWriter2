// Living Sprints — the writing surface inside the runner. The shared writing
// stack (features/editor/extensions — markdown + HLD theme + live preview +
// provenance tint), wrapped so the writer drafts *inside* the current move.
// Cmd/Ctrl+Enter advances (routed to the engine). The buffer persists across
// moves within a section, so prose accumulates while the instructions above it
// change.

import { useEffect, useMemo, useRef } from 'react';
import CodeMirror, { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { keymap } from '@codemirror/view';
import { writingSurfaceExtensions } from '../../editor/extensions';
import { useProvenanceSync } from '../../editor/useProvenanceSync';

interface SprintEditorProps {
  value: string;
  onChange: (value: string) => void;
  /** Cmd/Ctrl+Enter — advance to the next move. */
  onSubmit: () => void;
}

export function SprintEditor({ value, onChange, onSubmit }: SprintEditorProps) {
  const cmRef = useRef<ReactCodeMirrorRef>(null);
  const submitRef = useRef(onSubmit);
  submitRef.current = onSubmit;

  // AI-provenance tint renders here too — the marks anchor by text, so they
  // resolve against the section slice this surface edits. The returned seed
  // runs at view creation (the change-driven effect can fire viewless).
  const seedProvenance = useProvenanceSync(cmRef);

  // Stable per mount (a fresh history per sprint is correct — the sprint is
  // its own editing session over a seeded slice).
  const extensions = useMemo(
    () =>
      writingSurfaceExtensions([
        keymap.of([
          {
            key: 'Mod-Enter',
            run: () => {
              submitRef.current();
              return true;
            },
          },
        ]),
      ]),
    [],
  );

  useEffect(() => {
    const t = setTimeout(() => cmRef.current?.view?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex-1 min-h-0 border border-hld-border bg-hld-bgDeep focus-within:border-hld-cyan/30 transition-colors overflow-hidden">
      <CodeMirror
        ref={cmRef}
        value={value}
        onChange={onChange}
        onCreateEditor={seedProvenance}
        extensions={extensions}
        theme="none"
        height="100%"
        className="h-full w-full [&>div]:h-full font-mono text-base"
        basicSetup={false}
      />
    </div>
  );
}
