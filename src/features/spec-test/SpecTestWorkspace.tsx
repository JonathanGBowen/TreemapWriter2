import { useEffect } from 'react';
import { useStore } from '../../state';
import { SpecTestTopBar } from './SpecTestTopBar';
import { SpecTestReport } from './SpecTestReport';
import { useSpecTestOperands } from './use-spec-test-operands';

/**
 * The Spec Test workspace. A full-screen mode (like Version Compare) for the
 * spec-anchored A/B WHOLE-test: hold the rubric fixed, score B vs A as a part AND
 * as a whole, and lead with whether the revision served the whole or only the
 * pieces (tF). Self-gates on `specTestOpen`, so App mounts it unconditionally.
 */
export function SpecTestWorkspace() {
  const open = useStore((s) => s.specTestOpen);
  const close = useStore((s) => s.closeSpecTest);
  useSpecTestOperands();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-hld-bg text-hld-text overflow-hidden font-sans">
      <SpecTestTopBar />
      <SpecTestReport />
    </div>
  );
}
