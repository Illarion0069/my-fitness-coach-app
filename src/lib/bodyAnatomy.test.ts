import { describe, expect, it } from 'vitest';
import { anatomyRatios, anatomySourceX, profileSilhouette } from './bodyAnatomy';
import { DEMO_BODY_HISTORY } from './bodyModel';

describe('anatomy silhouette and measurement changes', () => {
  it('uses the male silhouette for a male profile', () => expect(profileSilhouette('male')).toBe('male'));
  it('uses the female silhouette for a female profile', () => expect(profileSilhouette('female')).toBe('female'));
  it('does not infer sex when the profile has no selection', () => expect(profileSilhouette(null)).toBeNull());
  it('leaves baseline geometry unchanged', () => {
    const ratios = anatomyRatios(DEMO_BODY_HISTORY[0], DEMO_BODY_HISTORY[0]);
    expect(anatomySourceX(.2, .37, ratios)).toBeCloseTo(.2);
  });
  it('narrows the waist smoothly when its circumference decreases', () => {
    const base = DEMO_BODY_HISTORY[0];
    const ratios = anatomyRatios({ ...base, waist_cm: 86 }, base);
    expect(anatomySourceX(.2, .37, ratios)).toBeGreaterThan(.2);
    expect(Math.abs(anatomySourceX(.2, .371, ratios) - anatomySourceX(.2, .37, ratios))).toBeLessThan(.001);
    expect(base.waist_cm).toBe(102);
  });
});