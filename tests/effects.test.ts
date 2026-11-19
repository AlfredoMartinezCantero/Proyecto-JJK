import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { GojoEffects } from '../src/scene/GojoEffects';
import { TECHNIQUES } from '../src/core/techniques';
import { fadeEnvironmentMaterial } from '../src/scene/environmentFade';
import { TechniqueEffects } from '../src/scene/TechniqueEffects';
import { SukunaEffects } from '../src/scene/SukunaEffects';

// CPU scene graph checks only: this mock creates texture placeholders, not a browser or WebGL renderer.
beforeAll(() => vi.stubGlobal('document', { createElement: () => ({ width: 128, height: 128,
  getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillStyle: '', fillRect() {} }) }) }));
afterAll(() => vi.unstubAllGlobals());

function sceneGraph() {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(42, 16 / 9, .1, 200);
  camera.position.set(8.7, 5.8, 12.5); camera.lookAt(0, 1, -.6); camera.updateMatrixWorld();
  const effects = new GojoEffects(scene, camera);
  effects.setPalms(new THREE.Vector3(-1, 2, 1), new THREE.Vector3(1, 2, 1));
  return { scene, effects };
}

describe('procedural effects, without graphics rendering', () => {
  it('shows Azul with one hand, adds Rojo in the next step and converges both before projection', () => {
    const { scene, effects } = sceneGraph(); effects.setTechnique('purple');
    const blue = scene.getObjectByName('Gojo preparation Blue')!, red = scene.getObjectByName('Gojo preparation Red')!, purple = scene.getObjectByName('Gojo preparation Purple')!;
    effects.setPalms(new THREE.Vector3(-1, 2, 1), null); effects.setCharge(.5, 0); effects.update(0);
    expect(blue.visible).toBe(true); expect(red.visible).toBe(false); expect(purple.visible).toBe(false);
    effects.setPalms(new THREE.Vector3(-1, 2, 1), new THREE.Vector3(1, 2, 1)); effects.setCharge(.5, 1); effects.update(50);
    expect(blue.visible).toBe(true); expect(red.visible).toBe(true); expect(purple.visible).toBe(false);
    effects.setCharge(1, 2); effects.update(100);
    expect(blue.position.toArray()).toEqual(red.position.toArray()); expect(purple.visible).toBe(true);
    effects.clear(); expect(blue.visible || red.visible || purple.visible).toBe(false);
  });
  it('draws the detailed bow and string between observed hands and clears them after casting', () => {
    const scene = new THREE.Scene(), effects = new SukunaEffects(scene, new THREE.PerspectiveCamera());
    effects.setTechnique('flame'); effects.setDetailedPose(true);
    const a = new THREE.Vector3(-1, 2, 1), b = new THREE.Vector3(1, 2, 1);
    effects.setPalms(a, b); effects.setCharge(.8, 1); effects.update(0);
    const bow = scene.getObjectByName('Fuga bow') as THREE.Line;
    const string = scene.getObjectByName('Fuga drawn string') as THREE.Line;
    expect(bow.visible).toBe(true); expect(string.visible).toBe(true);
    const positions = string.geometry.getAttribute('position');
    expect([positions.getX(1), positions.getY(1), positions.getZ(1)]).toEqual(a.toArray());
    expect(Array.from(bow.geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true);
    effects.activate(100, false); effects.update(200); expect(bow.visible).toBe(false);
    effects.clear(); expect(string.visible).toBe(false);
  });
  it.each(['blue', 'red', 'fusion', 'purple', 'domain'] as const)('keeps finite transforms and clears %s after its duration', key => {
    const { scene, effects } = sceneGraph(); effects.setTechnique(key);
    effects.setPalms(new THREE.Vector3(-1, 2, 1), new THREE.Vector3(1, 2, 1));
    effects.setCharge(1, key === 'purple' ? 2 : 0); effects.update(500);
    effects.activate(1000, false);
    for (let t = 1000; t <= 1000 + TECHNIQUES[key].effectMs + 100; t += 100) {
      effects.update(t); scene.updateMatrixWorld();
      scene.traverse(object => {
        expect([...object.position.toArray(), ...object.scale.toArray(), ...object.quaternion.toArray()].every(Number.isFinite)).toBe(true);
      });
    }
    effects.clear(); effects.update(20000);
    expect(effects.attraction + effects.repulsion + effects.impact + effects.stun + effects.domainMix).toBe(0);
  });
  it('restores the domain mix when changing technique or pausing', () => {
    const { effects } = sceneGraph(); effects.setTechnique('domain'); effects.activate(0, false); effects.update(2000);
    expect(effects.domainMix).toBe(1); effects.setTechnique('red'); effects.update(2001);
    expect(effects.domainMix).toBe(0); expect(effects.stun).toBe(0);
  });
  it('disables visual transformation when intensity is zero', () => {
    const { effects } = sceneGraph(); effects.setTechnique('domain'); effects.setSettings(0, true);
    effects.activate(0, false); effects.update(2000); expect(effects.domainMix).toBe(0);
  });
  it('refreshes cached opaque shaders once when entering and leaving the domain', () => {
    const material = new THREE.MeshToonMaterial();
    const original = { opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite };
    const version = material.version;
    fadeEnvironmentMaterial(material, original, .5);
    expect(material.transparent).toBe(true); expect(material.opacity).toBe(.5); expect(material.depthWrite).toBe(false);
    expect(material.version).toBe(version + 1);
    fadeEnvironmentMaterial(material, original, .8); expect(material.version).toBe(version + 1);
    fadeEnvironmentMaterial(material, original, 0);
    expect(material.transparent).toBe(false); expect(material.opacity).toBe(1); expect(material.depthWrite).toBe(true);
    expect(material.version).toBe(version + 2);
  });
  it('preserves the opacity and transparency of pre-existing translucent materials', () => {
    const material = new THREE.MeshBasicMaterial({ opacity: .35, transparent: true, depthWrite: false });
    const original = { opacity: .35, transparent: true, depthWrite: false }, version = material.version;
    fadeEnvironmentMaterial(material, original, .5); expect(material.opacity).toBeCloseTo(.175);
    fadeEnvironmentMaterial(material, original, 0); expect(material.opacity).toBe(.35);
    expect(material.transparent).toBe(true); expect(material.version).toBe(version);
  });
  it.each(['dismantle', 'cleave', 'flame', 'shrine'] as const)('constructs and clears finite %s effects', key => {
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(42, 16 / 9, .1, 200);
    const effects = new TechniqueEffects(scene, camera); effects.setTechnique(key);
    effects.setPalms(new THREE.Vector3(-1, 2, 1), new THREE.Vector3(1, 2, 1));
    effects.setCharge(.5, 1); effects.update(500); effects.activate(1000, false);
    for (let t = 1000; t <= 1000 + TECHNIQUES[key].effectMs + 100; t += 200) {
      effects.update(t); scene.updateMatrixWorld();
      scene.traverse(object => expect([...object.position.toArray(), ...object.scale.toArray(), ...object.quaternion.toArray()].every(Number.isFinite)).toBe(true));
    }
    effects.clear(); expect(effects.domainMix + effects.impact).toBe(0);
  });
  it('changing characters clears either domain and its gameplay forces', () => {
    const scene = new THREE.Scene(), effects = new TechniqueEffects(scene, new THREE.PerspectiveCamera());
    effects.setTechnique('shrine'); effects.activate(0, false); effects.update(2000); expect(effects.domainMix).toBe(1);
    effects.setTechnique('domain'); expect(effects.domainMix).toBe(0); expect(effects.impact).toBe(0);
    effects.activate(3000, false); effects.update(5000); expect(effects.domainMix).toBe(1);
    effects.setTechnique('dismantle'); expect(effects.domainMix).toBe(0); expect(effects.stun).toBe(0);
  });
});
