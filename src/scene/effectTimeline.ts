import type { TechniqueKey } from '../core/types';
import { combatTimeline, CONTACT_MS } from './combatTimeline';

const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };

export function effectTimeline(key: TechniqueKey, elapsed: number, duration: number, debug: boolean) {
  const active = elapsed >= 0 && elapsed < duration;
  const enter = active ? smooth(elapsed / (key === 'domain' ? CONTACT_MS.domain : 180)) : 0;
  const fade = active ? enter * (1 - smooth((elapsed - duration + (key === 'domain' ? 1400 : 700)) / (key === 'domain' ? 1400 : 700))) : 0;
  const contact = combatTimeline(key, elapsed, duration, debug);
  return { active, fade, merge: smooth(elapsed / 950), travel: key === 'purple' ? contact.travel : smooth((elapsed - 750) / 1650),
    attraction: contact.pull,
    repulsion: contact.knockback,
    impact: contact.dissolve,
    stun: contact.stun,
    domain: key === 'domain' ? fade : 0,
  };
}
