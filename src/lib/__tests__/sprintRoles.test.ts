import { describe, expect, it } from 'vitest';
import { hexA, roleHue, roleLabel } from '../sprintRoles';
import { SPRINT_MOVE_ROLES } from '../sprintPlan';

describe('sprintRoles', () => {
  it('maps every role to a hex hue', () => {
    for (const role of SPRINT_MOVE_ROLES) {
      expect(roleHue(role)).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('pins the canonical role→color contract', () => {
    expect(roleHue('reinstate')).toBe('#00e870'); // green
    expect(roleHue('frame')).toBe('#00e8f5'); // cyan
    expect(roleHue('marshal')).toBe('#ffe600'); // yellow
    expect(roleHue('draft')).toBe('#00e8f5'); // cyan
    expect(roleHue('stress')).toBe('#7c8bff'); // feat-tone
    expect(roleHue('synthesize')).toBe('#aa00ff'); // purple
    expect(roleHue('bridge')).toBe('#aa00ff'); // purple
  });

  it('roleLabel is an uppercase glyph-label', () => {
    expect(roleLabel('reinstate')).toBe('REINSTATE');
  });

  it('hexA converts to rgba with the given alpha', () => {
    expect(hexA('#00e8f5', 0.16)).toBe('rgba(0,232,245,0.16)');
    expect(hexA('#ff1060', 0.5)).toBe('rgba(255,16,96,0.5)');
  });
});
