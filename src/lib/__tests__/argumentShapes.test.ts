import { describe, expect, it } from 'vitest';
import { DEFAULT_ARGUMENT_SHAPES, findArgumentShape } from '../argumentShapes';
import { SPRINT_MOVE_ROLES } from '../sprintPlan';

describe('DEFAULT_ARGUMENT_SHAPES', () => {
  it('ships five argument shapes (ADHD heuristic: fewer choices)', () => {
    expect(DEFAULT_ARGUMENT_SHAPES).toHaveLength(5);
  });

  it('shape ids are unique', () => {
    const ids = DEFAULT_ARGUMENT_SHAPES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every shape has a non-empty name + description and opens with a reinstate move', () => {
    for (const shape of DEFAULT_ARGUMENT_SHAPES) {
      expect(shape.name.trim()).not.toBe('');
      expect(shape.description.trim()).not.toBe('');
      expect(shape.moves.length).toBeGreaterThanOrEqual(1);
      expect(shape.moves[0].role).toBe('reinstate');
    }
  });

  it('every move has a title, ≥1 instruction, a positive weight, and a valid role', () => {
    for (const shape of DEFAULT_ARGUMENT_SHAPES) {
      for (const move of shape.moves) {
        expect(move.title.trim()).not.toBe('');
        expect(move.instructions.length).toBeGreaterThanOrEqual(1);
        expect(move.instructions.every((i) => i.trim() !== '')).toBe(true);
        expect(move.weight).toBeGreaterThan(0);
        expect(SPRINT_MOVE_ROLES).toContain(move.role);
      }
    }
  });

  it('findArgumentShape resolves a known id and ignores null/unknown', () => {
    expect(findArgumentShape('objection-reply')?.name).toBe('Objection & Reply');
    expect(findArgumentShape(null)).toBeUndefined();
    expect(findArgumentShape('does-not-exist')).toBeUndefined();
  });
});
