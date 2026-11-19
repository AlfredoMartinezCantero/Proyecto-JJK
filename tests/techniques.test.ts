import { describe, expect, it } from 'vitest';
import catalog from '../src/config/gojo.json';
import { TECHNIQUES, validateCatalog } from '../src/core/techniques';
import { evaluatePose } from '../src/core/gesture';
import { normalizeProgress } from '../src/core/progress';
import { effectTimeline } from '../src/scene/effectTimeline';
import { poseHand } from './fixtures';

describe('catalog and single-hand templates', () => {
  it.each(['blue', 'red', 'purple', 'domain'] as const)('recognizes %s in raw geometry and mirrored coordinates', pose => {
    const hand = poseHand(pose);
    expect(evaluatePose(hand, 960, 720, pose).valid).toBe(true);
    expect(evaluatePose(hand.map(p => ({ ...p, x: 1 - p.x })), 960, 720, pose).valid).toBe(true);
  });
  it.each(['blue', 'red', 'purple', 'domain'] as const)('does not activate %s from an open palm or fist', pose => {
    expect(evaluatePose(poseHand('open'), 960, 720, pose).valid).toBe(false);
    expect(evaluatePose(poseHand('fist'), 960, 720, pose).valid).toBe(false);
  });
  it('distinguishes the one, two and three-finger templates', () => {
    expect(evaluatePose(poseHand('blue'), 960, 720, 'red').valid).toBe(false);
    expect(evaluatePose(poseHand('red'), 960, 720, 'blue').valid).toBe(false);
    expect(evaluatePose(poseHand('purple'), 960, 720, 'blue').valid).toBe(false);
    expect(evaluatePose(poseHand('blue'), 960, 720, 'purple').valid).toBe(false);
  });
  it('requires proximity for the adapted domain, not inferred crossed fingers', () => {
    expect(evaluatePose(poseHand('blue'), 960, 720, 'domain').valid).toBe(false);
    expect(evaluatePose(poseHand('domain'), 960, 720, 'domain').valid).toBe(true);
  });
  it('rejects non-finite camera dimensions', () => {
    expect(evaluatePose(poseHand('red'), NaN, 720, 'red').usable).toBe(false);
  });
  it('validates all five lesson definitions', () => expect(validateCatalog(catalog)).toHaveLength(5));
  it.each(['key', 'color', 'effectMs', 'timing', 'steps'] as const)('rejects malformed catalog field %s', field => {
    const bad = structuredClone(catalog) as { techniques: Record<string, unknown>[] };
    bad.techniques[0][field] = field === 'key' ? 'unknown' : field === 'color' ? 'blue' : field === 'effectMs' ? NaN : null;
    expect(() => validateCatalog(bad)).toThrow();
  });
  it('rejects duplicate lesson IDs and unsafe time ranges', () => {
    const duplicate = structuredClone(catalog); duplicate.techniques[1].key = 'blue';
    expect(() => validateCatalog(duplicate)).toThrow();
    const timing = structuredClone(catalog); timing.techniques[0].timing.holdMs = 0;
    expect(() => validateCatalog(timing)).toThrow();
  });
});

describe('per-technique tutorial progress', () => {
  it('migrates the old Azul tutorial without unlocking other techniques', () => expect(normalizeProgress(null, true)).toEqual(['blue']));
  it('removes duplicates, unknown keys and malformed entries', () => expect(normalizeProgress(['red', 'red', {}, 'fake', 'domain'])).toEqual(['red', 'domain']));
  it('preserves completed lessons independently', () => expect(normalizeProgress(['purple'], true)).toEqual(['blue', 'purple']));
});

describe('distinct effect timing', () => {
  it('uses repulsion for Rojo and attraction for Azul', () => {
    expect(effectTimeline('red', 1000, TECHNIQUES.red.effectMs, false).repulsion).toBeGreaterThan(0);
    expect(effectTimeline('red', 1000, TECHNIQUES.red.effectMs, false).attraction).toBe(0);
    expect(effectTimeline('blue', 900, TECHNIQUES.blue.effectMs, false).attraction).toBeGreaterThan(0);
  });
  it('projects Púrpura immediately after casting and impacts during the following SFX', () => {
    const flight = effectTimeline('purple', 500, TECHNIQUES.purple.effectMs, false);
    expect(flight.travel).toBeGreaterThan(0); expect(flight.travel).toBeLessThan(1); expect(flight.impact).toBe(0);
    const hit = effectTimeline('purple', 1000, TECHNIQUES.purple.effectMs, false);
    expect(hit.travel).toBe(1); expect(hit.impact).toBeGreaterThan(.9);
  });
  it('fades the domain in and out and restores the target', () => {
    const duration = TECHNIQUES.domain.effectMs;
    expect(effectTimeline('domain', 0, duration, false).domain).toBe(0);
    expect(effectTimeline('domain', 2000, duration, false).stun).toBe(1);
    expect(effectTimeline('domain', duration, duration, false).domain).toBe(0);
    expect(effectTimeline('domain', duration, duration, false).stun).toBe(0);
  });
  it('debug previews never apply gameplay forces', () => {
    for (const key of ['blue', 'red', 'fusion', 'purple', 'domain'] as const) {
      const effect = effectTimeline(key, 2700, TECHNIQUES[key].effectMs, true);
      expect(effect.attraction + effect.repulsion + effect.stun + effect.impact).toBe(0);
    }
  });
});
