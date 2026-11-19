/** Desmantelar input tolerances in palm lengths and milliseconds. */
export const SWIPE_LIMITS = {
  distancePalms: .9,
  windowMs: 3000,
  maxJumpPalms: 1.5,
  maxVerticalPalms: 1.3,
  maxVerticalSlope: .9,
  minMotionSamples: 3,
  minMotionMs: 100,
  minStepPalms: .04,
  poseGraceMs: 200,
  maxSampleGapMs: 250,
  settleMs: 150,
  settleRadiusPalms: .28,
  holdRadiusPalms: .6,
  extendedAngle: 145,
  foldedAngle: 145,
} as const;
