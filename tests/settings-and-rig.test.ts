import { describe, expect, it } from 'vitest';
import { PerspectiveCamera } from 'three';
import { HandRig } from '../src/scene/HandRig';
import { parseSettings, DEFAULT_SETTINGS } from '../src/core/settings';
import { observation } from './fixtures';

describe('settings', () => {
  it('defaults safely when storage is missing or malformed', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({ intensity: NaN, volume: 'loud' })).toEqual(DEFAULT_SETTINGS);
  });
  it('clamps numeric settings and validates flags', () => {
    const value = parseSettings({ intensity: -5, volume: 100, reducedFlashes: false, quality: 'low' });
    expect(value.intensity).toBe(0); expect(value.volume).toBe(1); expect(value.quality).toBe('low'); expect(value.reducedFlashes).toBe(false);
  });
});

describe('procedural skinned hands, geometry only', () => {
  it('has 21 bones and normalized skin weights for every vertex', () => {
    const rig = new HandRig(); expect(rig.mesh.skeleton.bones).toHaveLength(21);
    const indices = rig.mesh.geometry.getAttribute('skinIndex'), weights = rig.mesh.geometry.getAttribute('skinWeight');
    let maxWeightError = 0, validIndices = true;
    for (let i = 0; i < weights.count; i++) {
      maxWeightError = Math.max(maxWeightError, Math.abs(weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i) - 1));
      validIndices &&= [indices.getX(i), indices.getY(i), indices.getZ(i), indices.getW(i)].every(index => index >= 0 && index < 21);
    }
    expect(maxWeightError).toBeLessThan(1e-6); expect(validIndices).toBe(true);
  });
  it('updates bones from actual points and mirrors x once', () => {
    const rig = new HandRig(), camera = new PerspectiveCamera(42, 16 / 9, .1, 200);
    const hand = { ...observation(-.2), raw: observation(-.2).landmarks, id: 1 };
    rig.update(hand, camera, 4 / 3, true);
    expect(rig.mesh.visible).toBe(true); expect(rig.mesh.position.x).toBeGreaterThan(0);
    expect(rig.palmWorld().toArray().every(Number.isFinite)).toBe(true);
  });
});
