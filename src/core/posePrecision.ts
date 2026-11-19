import config from '../config/pose-precision.json';

export function validatePosePrecision(input: unknown) {
  const value = input as { detailed?: Record<string, unknown> } | null;
  const detail = value?.detailed;
  if (!detail) throw new Error('Faltan los umbrales de postura detallada.');
  const number = (key: string, min: number, max: number) => {
    const n = detail[key];
    if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max)
      throw new Error(`Umbral de postura no válido: ${key}`);
    return n;
  };
  const profile = { thumbMaxPalmDistance: number('thumbMaxPalmDistance', .2, 1.5),
    crossingMinPalmDistance: number('crossingMinPalmDistance', .01, .3),
    crossingMaxTipSeparation: number('crossingMaxTipSeparation', .3, 1),
    crossingMinJointAngle: number('crossingMinJointAngle', 110, 160),
    thumbOpenMinPalmDistance: number('thumbOpenMinPalmDistance', .85, 1.8),
    thumbOpenMinJointAngle: number('thumbOpenMinJointAngle', 110, 165),
    bowMaxFingerThumbAlignment: number('bowMaxFingerThumbAlignment', .3, .85) };
  if (profile.thumbOpenMinPalmDistance <= profile.thumbMaxPalmDistance + .05)
    throw new Error('Los umbrales de pulgar abierto y recogido deben estar separados.');
  return Object.freeze(profile);
}
export const POSE_PRECISION = validatePosePrecision(config);
