import type { TechniqueKey } from '../core/types';
import { isYujiTechnique, YUJI_CONTACT, yujiTimeline } from './yujiTimeline';
import { isMegumiTechnique, MEGUMI_CONTACT, megumiTimeline } from './megumiTimeline';

// Milliseconds shared by projectiles, surface effects and the receiving actor.
// These are staged impacts against a selected training target, not room collisions.
// Domain contact marks its opening/stun; its head burst is timed from the end.
export const CONTACT_MS: Record<TechniqueKey, number> = {
  blue: 700, red: 350, fusion: 950, purple: 850,
  domain: 1000, dismantle: 650, cleave: 650, flame: 1400, shrine: 2600,
  ...YUJI_CONTACT,
  ...MEGUMI_CONTACT,
};
export const smooth01 = (n: number) => { const t = Math.max(0, Math.min(1, n)); return t * t * (3 - 2 * t); };
export interface CombatState {
  key: TechniqueKey; active: boolean; preview: boolean; elapsed: number; travel: number; contactMs: number;
  hitAge: number; pulse: number; pull: number; knockback: number; lift: number;
  dissolve: number; cuts: number; burn: number; stun: number; recovery: number;
  persistent?: boolean;
  collapse?: number;
  shock?: number;
  bind?: number; drag?: number; flood?: number; distract?: number; engulf?: number;
}
export function persistentTargetTimeline(key: TechniqueKey, elapsed: number, duration: number): CombatState {
  if (!Number.isFinite(elapsed) || elapsed < 0) return combatTimeline(key, -1, duration);
  const state = combatTimeline(key, Math.min(elapsed, duration - 651), duration);
  return { ...state, elapsed, recovery: 0, persistent: true };
}
export function combatTimeline(key: TechniqueKey, elapsed: number, duration: number, preview = false): CombatState {
  const active = Number.isFinite(elapsed) && elapsed >= 0 && elapsed < duration;
  const contactMs = key === 'domain' ? Math.max(0, duration - 2000) : CONTACT_MS[key];
  const after = elapsed - contactMs;
  const tail = active ? 1 - smooth01((elapsed - duration + 650) / 650) : 0;
  const yuji = isYujiTechnique(key) ? yujiTimeline(key, elapsed, duration) : null;
  const megumi = isMegumiTechnique(key) ? megumiTimeline(key,elapsed,duration) : null;
  const hitAge = megumi && active ? megumi.hitAge : yuji && active ? yuji.hitAge : active && after >= 0 && !['blue', 'fusion', 'domain'].includes(key)
    ? key === 'shrine' && tail > 0 ? after % 420 : after : -1;
  const pulse = megumi ? megumi.pulse*tail : yuji ? yuji.pulse*tail : hitAge >= 0 ? Math.exp(-hitAge / 170) * tail : 0;
  const hit = active && after >= 0 ? smooth01(after / 130) * tail : 0;
  const pull = active && (key === 'blue' || key === 'fusion')
    ? smooth01(elapsed / CONTACT_MS[key]) * tail * (key === 'blue' ? 1 : .35) : 0;
  const knockback = ['red', 'flame'].includes(key) && hit
    ? smooth01(after / 180) * (1 - smooth01((after - 250) / (duration - CONTACT_MS[key] - 250))) * (key === 'red' ? 1 : .65) : 0;
  return { key, active, preview, elapsed: active ? elapsed : 0, contactMs,
    travel: active ? smooth01(elapsed / CONTACT_MS[key]) : 0,
    hitAge, pulse, pull: preview ? 0 : pull, knockback: preview || ['toad','rabbit-escape','chimera-garden'].includes(key) ? 0 : megumi ? megumi.pulse*.35+megumi.collapse*.6 : yuji ? Math.min(1, yuji.pulse*.6+yuji.collapse*.7) : knockback,
    collapse: !preview ? megumi?.collapse ?? yuji?.collapse ?? 0 : 0,
    shock: !preview && megumi ? megumi.shock : 0,
    bind:!preview&&megumi?megumi.bind:0, drag:!preview&&megumi?megumi.drag:0,
    flood:!preview&&megumi?megumi.flood:0, distract:!preview&&megumi?megumi.distract:0,
    engulf:!preview&&megumi?megumi.engulf:0,
    lift: preview ? 0 : pull * .65 + knockback * .55,
    dissolve: !preview && key === 'purple' ? hit : 0,
    cuts: !preview && ['dismantle', 'cleave', 'shrine', 'divine-dogs', 'totality', 'mahoraga'].includes(key) ? hit * (key === 'dismantle' || key === 'divine-dogs' ? .6 : 1) : 0,
    burn: !preview ? key === 'flame' ? hit : key === 'nue' ? hit*.6 : 0 : 0,
    stun: !preview && active && key === 'domain' ? smooth01(elapsed / CONTACT_MS.domain) * tail : 0,
    recovery: active ? 1 - tail : 1,
  };
}
