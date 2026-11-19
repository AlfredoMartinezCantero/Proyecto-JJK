import type { TechniqueKey } from '../core/types';
import { smooth01, type CombatState } from './combatTimeline';
import { DOG_SECOND_HIT_MS, TOTALITY_SECOND_HIT_MS } from './megumiTimeline';

export type DestructionKind = 'none' | 'bisect' | 'grid' | 'burst' | 'head-burst' | 'shred' | 'erase' | 'incinerate' | 'maul' | 'exorcise';
export const DESTRUCTION_KIND: Record<TechniqueKey, DestructionKind> = {
  blue: 'none', red: 'burst', fusion: 'none', purple: 'erase', domain: 'head-burst',
  dismantle: 'bisect', cleave: 'grid', flame: 'incinerate', shrine: 'shred',
  divergent: 'none', 'black-flash': 'burst',
  'divine-dogs': 'maul', nue: 'none',
  totality:'maul',toad:'none','max-elephant':'none','rabbit-escape':'none',mahoraga:'exorcise','chimera-garden':'none',
};
export function destructionState(state: CombatState) {
  const kind = DESTRUCTION_KIND[state.key], delay=state.key==='divine-dogs'?DOG_SECOND_HIT_MS:state.key==='totality'?TOTALITY_SECOND_HIT_MS:0;
  const age = (state.elapsed - state.contactMs - delay) / 1000;
  const engaged = state.active && !state.preview && age >= 0 && kind !== 'none';
  return { kind, age: engaged ? age : 0, engaged, regeneration: engaged ? state.recovery : 0,
    // Erasure remains complete until regeneration; it does not flicker back between frames.
    erasure: engaged && kind === 'erase' ? smooth01(age / .14) * (1 - state.recovery) : 0,
    ash: engaged && kind === 'incinerate' ? smooth01((age - .24) / .7) * (1 - state.recovery) : 0 };
}

/** Analytic ballistic motion with two floor bounces and horizontal friction; frame-rate independent. */
export function ballistic(t: number, y: number, vx: number, vy: number, vz: number, floor = .1) {
  t = Math.max(0, t); const gravity = 9.81;
  const first = (vy + Math.sqrt(vy * vy + 2 * gravity * Math.max(0, y - floor))) / gravity;
  if (t <= first) return { x: vx * t, y: y + vy * t - gravity * t * t / 2, z: vz * t, landed: false, spinTime: t };
  const age = t - first, rebound = Math.abs(vy - gravity * first) * .24, second = rebound * 2 / gravity;
  const bounceAge = age <= second ? age : age - second;
  const speed = age <= second ? rebound : rebound * .2;
  const height = Math.max(0, speed * bounceAge - gravity * bounceAge * bounceAge / 2);
  const slide = (1 - Math.exp(-age * 4.5)) / 4.5;
  return { x: vx * (first + slide), y: floor + height, z: vz * (first + slide), landed: true,
    spinTime: first + (1 - Math.exp(-age * 7)) / 7 };
}
