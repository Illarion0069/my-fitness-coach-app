import { describe, expect, it } from 'vitest';
import { BODY_PILOT_USER_ID, DEMO_BODY_HISTORY, bodyRatio, bodyRegion, canViewBodyPilot, interpolateBody } from './bodyModel';

describe('private body pilot', () => {
  it('is visible only in Illarion’s own trainer client view', () => {
    expect(canViewBodyPilot(BODY_PILOT_USER_ID, true, true)).toBe(true);
    expect(canViewBodyPilot(BODY_PILOT_USER_ID, false, true)).toBe(false);
    expect(canViewBodyPilot(BODY_PILOT_USER_ID, true, false)).toBe(false);
    expect(canViewBodyPilot('another-client', true, true)).toBe(false);
    expect(canViewBodyPilot(undefined, true, true)).toBe(false);
  });
  it('interpolates circumference changes without altering stored records', () => {
    const start = { ...DEMO_BODY_HISTORY[0] };
    const end = DEMO_BODY_HISTORY[3];
    expect(interpolateBody(start, end, 0.5).waist_cm).toBe(94);
    expect(start.waist_cm).toBe(102);
    expect(bodyRatio(86, 102)).toBeCloseTo(86 / 102);
  });
  it('does not invent missing circumference data', () => {
    const start = { ...DEMO_BODY_HISTORY[0], chest_cm: null };
    expect(interpolateBody(start, DEMO_BODY_HISTORY[3], 0.5).chest_cm).toBeNull();
    expect(bodyRatio(null, 110)).toBe(1);
  });
  it('maps body sides anatomically, not screen-left', () => {
    expect(bodyRegion(0.45, 1.4)).toBe('left_arm_cm');
    expect(bodyRegion(-0.45, 1.4)).toBe('right_arm_cm');
    expect(bodyRegion(0.15, 0.8)).toBe('left_leg_cm');
    expect(bodyRegion(0, 1.3)).toBe('waist_cm');
  });
});