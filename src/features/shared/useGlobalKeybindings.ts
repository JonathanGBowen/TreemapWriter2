import { useEffect } from 'react';
import { useStore } from '../../state';

export function useGlobalKeybindings() {
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      const s = useStore.getState();
      if (key === 'k') {
        e.preventDefault();
        s.setShowCommandPalette(!s.showCommandPalette);
      } else if (s.showCommandPalette) {
        return;
      } else if (key === 's') {
        e.preventDefault();
        if (s.activeProjectId) void s.createSnapshot('manual');
      } else if (key === 'enter') {
        e.preventDefault();
        s.setShowRunModal(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
