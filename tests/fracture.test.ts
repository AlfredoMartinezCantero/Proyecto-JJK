import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { splitGeometry, fractureGeometry } from '../src/scene/fractureGeometry';
import { ballistic, destructionState } from '../src/scene/destructionMotion';
import { combatTimeline } from '../src/scene/combatTimeline';
import { createCurseActor, CURSE_CENTER } from '../src/scene/CurseActor';
import { makePalette } from '../src/scene/materials';

function volume(g: THREE.BufferGeometry) {
  const p = g.getAttribute('position'), index = g.getIndex(); let sum = 0;
  for (let i = 0; i < (index?.count ?? p.count); i += 3) {
    const [a, b, c] = [0, 1, 2].map(j => new THREE.Vector3().fromBufferAttribute(p, index ? index.getX(i + j) : i + j));
    sum += a.dot(b.clone().cross(c)) / 6;
  }
  return Math.abs(sum);
}
const meshes = (root: THREE.Object3D, name: string) => (root.getObjectByName(name)!.children as THREE.Mesh[]);

describe('actual mesh slicing and capped volumes', () => {
  it('bisects a solid box with opposite closed interior faces and conserved volume', () => {
    const source = new THREE.BoxGeometry(2, 2, 2), plane = new THREE.Plane(new THREE.Vector3(1, 0, 0), -.2);
    const [negative, positive] = splitGeometry(source, plane);
    expect(volume(negative!) + volume(positive!)).toBeCloseTo(volume(source), 5);
    for (const [g, sign] of [[negative!, -1], [positive!, 1]] as const) {
      const p = g.getAttribute('position'), cap = g.getAttribute('cutFace'), normals = g.getAttribute('normal'); let caps = 0;
      for (let i = 0; i < p.count; i++) {
        expect(sign * plane.distanceToPoint(new THREE.Vector3().fromBufferAttribute(p, i))).toBeGreaterThanOrEqual(-.00001);
        if (cap.getX(i) > .5) { caps++; expect(p.getX(i)).toBeCloseTo(.2, 5); expect(normals.getX(i)).toBe(-sign); }
      }
      expect(caps).toBeGreaterThan(0);
    }
  });
  it('caps a cut exactly along an existing sphere equator', () => {
    const source = new THREE.SphereGeometry(1, 16, 12), halves = splitGeometry(source, new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
    expect(volume(halves[0]!) + volume(halves[1]!)).toBeCloseTo(volume(source), 4);
    for (const half of halves) expect(Array.from(half!.getAttribute('cutFace').array).some(v => v === 1)).toBe(true);
  });
  it('does not invent a fragment when a plane lies outside the target', () => {
    const source = new THREE.BoxGeometry(1, 1, 1), [a, b] = splitGeometry(source, new THREE.Plane(new THREE.Vector3(1, 0, 0), -2));
    expect(b).toBe(null); expect(volume(a!)).toBeCloseTo(1, 5);
  });
  it('makes a spatial grid of distinct closed fragments without changing total volume', () => {
    const source = new THREE.BoxGeometry(2, 2, 2);
    const pieces = fractureGeometry(source, [new THREE.Plane(new THREE.Vector3(1, 0, 0), 0),
      new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)]);
    expect(pieces).toHaveLength(8); expect(pieces.reduce((sum, p) => sum + volume(p), 0)).toBeCloseTo(8, 5);
    pieces.forEach(p => { expect(volume(p)).toBeCloseTo(1, 5); expect(Array.from(p.getAttribute('position').array).every(Number.isFinite)).toBe(true); });
  });
});

describe('distinct destruction and regeneration', () => {
  it('cuts the actual curse into two moving halves at contact and restores its body', () => {
    const actor = createCurseActor(makePalette()); const halves = meshes(actor.root, 'Curse fracture bisect');
    expect(halves).toHaveLength(2); const initial = halves.map(mesh => mesh.position.clone());
    actor.animate(.6, combatTimeline('dismantle', 600, 2000), CURSE_CENTER);
    expect(actor.root.getObjectByName('Curse physical destruction')!.visible).toBe(false);
    actor.animate(.95, combatTimeline('dismantle', 950, 2000), CURSE_CENTER);
    expect(actor.root.getObjectByName('Curse fracture bisect')!.visible).toBe(true);
    halves.forEach((half, i) => { expect(half.position.distanceTo(initial[i])).toBeGreaterThan(.1);
      expect(Array.from(half.geometry.getAttribute('cutFace').array).some(v => v === 1)).toBe(true); });
    actor.reset(); expect(actor.root.getObjectByName('Curse physical destruction')!.visible).toBe(false);
    halves.forEach((half, i) => expect(half.position.toArray()).toEqual(initial[i].toArray()));
    expect(actor.uniforms.dissolve.value).toBe(0);
  });
  it('Shrine detaches the target progressively and hides its intact body', () => {
    const actor = createCurseActor(makePalette()), pieces = meshes(actor.root, 'Curse fracture dense');
    expect(pieces.length).toBeGreaterThan(30); const rest = pieces.map(p => p.position.clone());
    actor.animate(2.5, combatTimeline('shrine', 2500, 8000), CURSE_CENTER);
    expect(actor.root.children[0].visible).toBe(true);
    actor.animate(2.7, combatTimeline('shrine', 2700, 8000), CURSE_CENTER);
    const first = pieces.filter((p, i) => p.position.distanceTo(rest[i]) > .001).length;
    expect(first).toBeGreaterThan(0); expect(first).toBeLessThan(pieces.length);
    actor.animate(3.5, combatTimeline('shrine', 3500, 8000), CURSE_CENTER);
    expect(pieces.filter((p, i) => p.position.distanceTo(rest[i]) > .001).length).toBeGreaterThan(first);
    expect(actor.root.children[0].visible).toBe(false);
    actor.animate(7.7, combatTimeline('shrine', 7700, 8000), CURSE_CENTER); expect(actor.root.children[0].visible).toBe(true);
    actor.animate(8, combatTimeline('shrine', 8000, 8000), CURSE_CENTER); expect(actor.uniforms.dissolve.value).toBe(0);
  });
  it('Red bursts into fragments; Purple erases; fire becomes ash', () => {
    const actor = createCurseActor(makePalette());
    actor.animate(.7, combatTimeline('red', 700, 2200), CURSE_CENTER);
    expect(actor.root.getObjectByName('Curse fracture dense')!.visible).toBe(true); expect(actor.root.children[0].visible).toBe(false);
    actor.animate(2.7, combatTimeline('purple', 2700, 4200), CURSE_CENTER);
    expect(actor.root.children[0].visible).toBe(false); expect(actor.uniforms.dissolve.value).toBe(1);
    expect(actor.root.getObjectByName('Curse fracture dense')!.visible).toBe(false);
    actor.animate(2.5, combatTimeline('flame', 2500, 4200), CURSE_CENTER);
    expect(actor.root.children[0].visible).toBe(false); expect(actor.uniforms.burn.value).toBe(1);
    expect(actor.root.getObjectByName('Curse surface particles')!.visible).toBe(true);
  });
  it('does not destroy in ordinary debug previews and uses fewer fragments on low quality', () => {
    const actor = createCurseActor(makePalette()); actor.setSettings(.75, 'low');
    actor.animate(1.4, combatTimeline('red', 1400, 2200, true), CURSE_CENTER);
    expect(actor.root.children[0].visible).toBe(true);
    actor.animate(1.4, combatTimeline('red', 1400, 2200), CURSE_CENTER);
    expect(actor.root.getObjectByName('Curse fracture grid')!.visible).toBe(true);
    expect(actor.root.getObjectByName('Curse fracture dense')!.visible).toBe(false);
  });
  it('keeps all shard transforms finite and restores every technique after its animation', () => {
    const actor = createCurseActor(makePalette());
    for (const [key, duration] of [['blue', 1800], ['red', 2200], ['fusion', 3400], ['purple', 4200], ['domain', 8000],
      ['dismantle', 2000], ['cleave', 3000], ['flame', 4200], ['shrine', 8000]] as const) {
      const count = actor.root.getObjectsByProperty('type', 'Mesh').length;
      for (let age = 0; age <= duration; age += 100) {
        actor.animate(age / 1000, combatTimeline(key, age, duration), CURSE_CENTER);
        actor.root.traverse(object => expect([...object.position.toArray(), ...object.quaternion.toArray(), ...object.scale.toArray()].every(Number.isFinite)).toBe(true));
      }
      actor.reset(); expect(actor.root.getObjectsByProperty('type', 'Mesh')).toHaveLength(count);
      expect(actor.root.children[0].visible).toBe(true); expect(actor.root.getObjectByName('Curse physical destruction')!.visible).toBe(false);
      expect(Object.values(actor.uniforms).every(v => v.value === 0)).toBe(true);
    }
  });
  it('keeps the target erased for a visible interval before rebuilding', () => {
    expect(destructionState(combatTimeline('purple', 2800, 4200)).erasure).toBe(1);
    expect(destructionState(combatTimeline('purple', 3400, 4200)).erasure).toBe(1);
    const rebuilding = destructionState(combatTimeline('purple', 3900, 4200));
    expect(rebuilding.regeneration).toBeGreaterThan(0); expect(rebuilding.erasure).toBeLessThan(1);
  });
  it('ballistics are independent of render steps, fall under gravity and settle after bounces', () => {
    const sample = ballistic(.4, 2, 3, 2, -1);
    expect(sample).toEqual(ballistic(.4, 2, 3, 2, -1));
    expect(sample.y).toBeCloseTo(2 + 2 * .4 - 9.81 * .4 * .4 / 2);
    const resting = ballistic(10, 2, 3, 2, -1); expect(resting.landed).toBe(true); expect(resting.y).toBe(.1);
    expect(Object.values(resting).filter(v => typeof v === 'number').every(Number.isFinite)).toBe(true);
  });
});
