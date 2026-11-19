import { ALL_TECHNIQUES } from './techniques';
import type { TechniqueKey } from './types';

export function normalizeProgress(saved: unknown, legacyBlueComplete = false): TechniqueKey[] {
  const values = Array.isArray(saved) ? saved : [];
  return ALL_TECHNIQUES.filter(t => values.includes(t.key) || (legacyBlueComplete && t.key === 'blue')).map(t => t.key);
}
