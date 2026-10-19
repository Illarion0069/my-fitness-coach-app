import { BODY_METRICS, bodyRatio, type BodyMetric, type BodyValues } from './bodyModel';

export type BodySilhouette = 'male' | 'female';
export function profileSilhouette(gender: string | null | undefined): BodySilhouette | null {
  return gender === 'male' || gender === 'female' ? gender : null;
}
export const ANATOMY_ZONES: { key: BodyMetric; x: number; y: number; side: 'left' | 'right' }[] = [
  { key: 'chest_cm', x: 50, y: 23, side: 'right' },
  { key: 'waist_cm', x: 50, y: 37, side: 'left' },
  { key: 'hips_cm', x: 50, y: 46, side: 'right' },
  { key: 'right_arm_cm', x: 30, y: 29, side: 'left' },
  { key: 'left_arm_cm', x: 70, y: 29, side: 'right' },
  { key: 'right_leg_cm', x: 42, y: 60, side: 'left' },
  { key: 'left_leg_cm', x: 58, y: 60, side: 'right' },
];
export function anatomyRatios(values: BodyValues, baseline: BodyValues) {
  return Object.fromEntries(BODY_METRICS.map(({ key }) => [key, bodyRatio(values[key], baseline[key]) - 1])) as Record<BodyMetric, number>;
}
export function anatomySourceX(nx: number, y: number, ratios: Record<BodyMetric, number>) {
  const bell = (center: number, width: number) => Math.exp(-(((y - center) / width) ** 2));
  const torso = ratios.chest_cm * bell(.23, .075) + ratios.waist_cm * bell(.37, .065) + ratios.hips_cm * bell(.46, .06);
  const torsoInfluence = Math.exp(-((nx / .31) ** 6));
  const arm = nx < 0 ? ratios.right_arm_cm : ratios.left_arm_cm;
  const leg = nx < 0 ? ratios.right_leg_cm : ratios.left_leg_cm;
  const armAxis = .36 + Math.max(0, y - .23) * .65;
  const armInfluence = Math.exp(-(((Math.abs(nx) - armAxis) / .11) ** 4)) * bell(.29, .075);
  const legAxis = nx < 0 ? -.16 : .16;
  const legInfluence = bell(.60, .105) * (1 - bell(0, .10));
  return nx - nx * torso * torsoInfluence - (nx - Math.sign(nx) * armAxis) * arm * armInfluence - (nx - legAxis) * leg * legInfluence;
}