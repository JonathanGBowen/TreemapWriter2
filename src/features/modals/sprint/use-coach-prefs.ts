// Living Sprints — the coach start protocol's two preferences (coach style +
// goal model), hydrated on open and persisted the moment the writer flips them
// so the next sprint defaults to what they used last ("last-selected default").
// Mirrors use-sprint-cues' idb hydration pattern.

import { useCallback, useEffect, useState } from 'react';
import {
  getSprintCoachStyle,
  setSprintCoachStyle,
  getSprintGoalModel,
  setSprintGoalModel,
  type SprintCoachStyle,
  type SprintGoalModelPref,
} from '../../../services/preferences';

export interface CoachPrefs {
  style: SprintCoachStyle;
  goalModel: SprintGoalModelPref;
  setStyle: (style: SprintCoachStyle) => void;
  setGoalModel: (model: SprintGoalModelPref) => void;
}

export function useCoachPrefs(): CoachPrefs {
  const [style, setStyleState] = useState<SprintCoachStyle>('guided');
  const [goalModel, setGoalModelState] = useState<SprintGoalModelPref>('woop');

  useEffect(() => {
    let alive = true;
    void Promise.all([getSprintCoachStyle(), getSprintGoalModel()]).then(([s, g]) => {
      if (!alive) return;
      setStyleState(s);
      setGoalModelState(g);
    });
    return () => {
      alive = false;
    };
  }, []);

  const setStyle = useCallback((s: SprintCoachStyle) => {
    setStyleState(s);
    void setSprintCoachStyle(s);
  }, []);

  const setGoalModel = useCallback((g: SprintGoalModelPref) => {
    setGoalModelState(g);
    void setSprintGoalModel(g);
  }, []);

  return { style, goalModel, setStyle, setGoalModel };
}
