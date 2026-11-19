import type { Pose } from '../core/types';

/** Audio follows valid casting progress; it never decides whether a technique fires. */
export interface CastingAudioFrame {
  step: number;
  pose: Pose;
  valid: boolean;
  holding: boolean;
  progress: number;
  holdMs: number;
  bluePan: number | null;
  redPan: number | null;
}
export const CAST_AUDIO_STABLE_MS = 100;
