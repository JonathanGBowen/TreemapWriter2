// Living Sprints — optional sensory cues (Direction D, sensory half). Off by
// default (the global `sprintCuesEnabled` pref seeds the initial state); the
// runner's cue toggle flips it for the session and persists the choice. The
// ambient hue's animation is gated by `prefers-reduced-motion` in CSS (the
// `.sprint-ambient` transition is disabled there); the "ding" is audio, not
// motion, so it follows only the cue toggle.

import { useCallback, useEffect, useState } from 'react';
import { playDing } from '../../../lib/ding';
import { getSprintCuesEnabled, setSprintCuesEnabled } from '../../../services/preferences';

export interface SprintCues {
  cuesOn: boolean;
  toggleCues: () => void;
  /** Play the transition cue if cues are on; no-op otherwise. */
  ding: () => void;
}

export function useSprintCues(): SprintCues {
  const [cuesOn, setCuesOn] = useState(false);

  useEffect(() => {
    let alive = true;
    void getSprintCuesEnabled().then((on) => {
      if (alive) setCuesOn(on);
    });
    return () => {
      alive = false;
    };
  }, []);

  const toggleCues = useCallback(() => {
    setCuesOn((on) => {
      const next = !on;
      void setSprintCuesEnabled(next);
      if (next) playDing(); // confirm audio works at the moment of opt-in
      return next;
    });
  }, []);

  const ding = useCallback(() => {
    if (cuesOn) playDing();
  }, [cuesOn]);

  return { cuesOn, toggleCues, ding };
}
