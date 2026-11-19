const smooth01 = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t*t*(3-2*t); };
export const YUJI_CONTACT = { divergent: 460, 'black-flash': 620 } as const;
export const DIVERGENT_DELAY_MS = 320;
export const isYujiTechnique = (key: string): key is keyof typeof YUJI_CONTACT => key === 'divergent' || key === 'black-flash';
export function yujiTimeline(key: keyof typeof YUJI_CONTACT, elapsed: number, duration: number) {
  const active = Number.isFinite(elapsed) && elapsed >= 0 && elapsed < duration;
  const age = elapsed-YUJI_CONTACT[key], second = key === 'divergent' && age >= DIVERGENT_DELAY_MS;
  const hitAge = age < 0 ? -1 : second ? age-DIVERGENT_DELAY_MS : age;
  return { active, age, hitAge, second, travel: smooth01(elapsed/YUJI_CONTACT[key]),
    pulse: active && hitAge >= 0 ? Math.exp(-hitAge/160)*(key === 'divergent' && !second ? .55 : 1) : 0,
    collapse: active && key === 'divergent' ? smooth01((age-DIVERGENT_DELAY_MS)/600) : 0 };
}
