import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { VoidHeadEffect } from '../src/scene/VoidHeadEffect';
import { CONTACT_MS, combatTimeline } from '../src/scene/combatTimeline';
import { effectTimeline } from '../src/scene/effectTimeline';
import { destructionState } from '../src/scene/destructionMotion';

function setup() {
  const parent = new THREE.Group(), surface = new THREE.SphereGeometry(.3, 12, 8).translate(0, 2.05, 0);
  const effect = new VoidHeadEffect(parent, surface); surface.dispose();
  const pressure = parent.getObjectByName('Void head pressure')!;
  const particles = parent.getObjectByName('Void head burst particles') as THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  return { parent, effect, pressure, particles };
}

describe('Gojo domain opening and head explosion choreography (CPU scene graph)', () => {
  it('opens and stuns first, then builds pressure and bursts with two seconds left', () => {
    const { effect, pressure, particles } = setup(), duration = 8000;
    const burstAt = duration - 2000;
    const update = (elapsed: number) => effect.update(combatTimeline('domain', elapsed, duration), .8, true, 'high');
    expect(update(0)).toBe(false);
    const before = CONTACT_MS.domain - 200;
    expect(update(before)).toBe(false); expect(pressure.visible).toBe(false); expect(particles.visible).toBe(false);
    expect(effectTimeline('domain', before, duration, false).domain).toBeLessThan(1);
    expect(combatTimeline('domain', before, duration).stun).toBeLessThan(1);
    expect(update(CONTACT_MS.domain)).toBe(false);
    expect(effectTimeline('domain', CONTACT_MS.domain, duration, false).domain).toBe(1);
    expect(combatTimeline('domain', CONTACT_MS.domain, duration).stun).toBe(1);
    expect(update(burstAt - 200)).toBe(true); expect(pressure.visible).toBe(true); expect(particles.visible).toBe(false);
    expect(update(burstAt)).toBe(true);
    expect(pressure.visible).toBe(false); expect(particles.visible).toBe(true);
    expect(particles.material.uniforms.age.value).toBe(0);
    expect(update(burstAt + 960)).toBe(false); expect(effect.root.visible).toBe(false);
  });
  it.each([6000, 8000, 10000])('times head destruction from the end of a %i ms domain', duration => {
    const { effect, particles } = setup(), burstAt = duration - 2000;
    const before = combatTimeline('domain', burstAt - 1, duration);
    const burst = combatTimeline('domain', burstAt, duration);
    expect(destructionState(before).engaged).toBe(false);
    expect(destructionState(burst).engaged).toBe(true);
    expect(burst.contactMs).toBe(burstAt);
    effect.update(before, .8, true, 'high'); expect(particles.visible).toBe(false);
    effect.update(burst, .8, true, 'high'); expect(particles.visible).toBe(true);
  });
  it('keeps previews and zero intensity clear, lowers the particle budget and reuses buffers when cancelled or repeated', () => {
    const { effect, parent, pressure, particles } = setup();
    const geometry = particles.geometry, positions = geometry.getAttribute('position');
    const count = parent.getObjectsByProperty('type', 'Mesh').length;
    const state = combatTimeline('domain', 8000 - 2000 + 100, 8000);
    effect.update(state, .8, true, 'low'); expect(particles.geometry.drawRange.count).toBe(128);
    expect(effect.update({ ...state, preview: true }, .8, true, 'high')).toBe(false);
    expect(pressure.visible || particles.visible).toBe(false);
    expect(effect.update(state, 0, true, 'high')).toBe(false);
    for (let t = 0; t < 8000; t += 50) effect.update(combatTimeline('domain', t, 8000), .8, true, 'high');
    expect(particles.geometry).toBe(geometry); expect(geometry.getAttribute('position')).toBe(positions);
    expect(parent.getObjectsByProperty('type', 'Mesh')).toHaveLength(count);
    expect(effect.update(combatTimeline('blue', 800, 1800), .8, true, 'high')).toBe(false);
    expect(effect.root.visible).toBe(false);
  });
});
