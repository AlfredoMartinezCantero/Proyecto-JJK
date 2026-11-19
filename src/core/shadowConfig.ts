import type { SinglePose } from './types';

export const SHADOW_LIMITS = {
  hounds: { min: 1.2, max: 3.2 },
  'nue-gather': { min: 1.2, max: 2.5 }, 'nue-spread': { min: 3, max: 7 },
  'totality-gather': { min: 1.2, max: 3.2 }, 'totality-release': { min: 3.4, max: 7 },
  'toad-sign': { min: 1.2, max: 3.2 },
  'elephant-gather': { min: 1.2, max: 2.5 }, 'elephant-release': { min: 3, max: 7 },
  'rabbit-sign': { min: 1.2, max: 3.2 }, ritual: { min: 1.2, max: 3.2 },
  'chimera-gather': { min: 1.2, max: 2.5 }, 'chimera-release': { min: 3, max: 7 },
  maxVertical: .9,
} as const;
export type ShadowPose = keyof Omit<typeof SHADOW_LIMITS, 'maxVertical'>;
export const SHADOW_SIGNS: Record<ShadowPose, readonly [SinglePose, SinglePose]> = {
  hounds: ['wolf','wolf'], 'nue-gather': ['palm','palm'], 'nue-spread': ['palm','palm'],
  'totality-gather': ['wolf','wolf'], 'totality-release': ['wolf','wolf'],
  'toad-sign': ['blue','palm'], 'elephant-gather': ['palm','palm'], 'elephant-release': ['fist','palm'],
  'rabbit-sign': ['blue','blue'], ritual: ['fist','fist'],
  'chimera-gather': ['fist','fist'], 'chimera-release': ['palm','palm'],
};
export function isShadowPose(pose: string): pose is ShadowPose { return Object.hasOwn(SHADOW_SIGNS,pose); }
