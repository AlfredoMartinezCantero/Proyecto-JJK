import { CONTACT_MS, smooth01 } from './combatTimeline';

/** Absolute samples: pausing, skipped frames and reduced motion never replay an impulse. */
export function shrineTimeline(elapsed: number, duration: number) {
  const active = Number.isFinite(elapsed) && elapsed >= 0 && elapsed < duration;
  const t = active ? elapsed : 0;
  const exit = active ? 1 - smooth01((t - duration + 900) / 900) : 0;
  const rise = smooth01((t - 450) / 1700);
  return {
    active, atmosphere: smooth01(t / 500) * exit, rise,
    reveal: smooth01((t - 400) / 1650), exit,
    casterPose: active ? (1 - smooth01((t - 950) / 1050)) * exit : 0,
    // Close-up first, then a wide view before the first cutting wave.
    close: smooth01(t / 450) * (1 - smooth01((t - 650) / 950)) * exit,
    wide: smooth01((t - 650) / (CONTACT_MS.shrine - 650)) * exit,
    dust: smooth01((t - 450) / 350) * (1 - smooth01((t - 1900) / 1400)) * exit,
    landing: active ? Math.exp(-Math.pow((t - 2150) / 160, 2)) * exit : 0,
    cutting: active && t >= CONTACT_MS.shrine,
  };
}
