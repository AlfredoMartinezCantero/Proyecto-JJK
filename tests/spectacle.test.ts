import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { TechniqueSpectacle } from '../src/scene/TechniqueSpectacle';
import { ImpactLens } from '../src/scene/ImpactLens';
import { combatTimeline, CONTACT_MS } from '../src/scene/combatTimeline';
import { ALL_TECHNIQUES } from '../src/core/techniques';

// Scene-graph and resource-budget checks, without a WebGL context or shader compilation.
describe('volumetric technique presentation', () => {
  it.each(ALL_TECHNIQUES)('$key reuses finite ribbon/particle buffers and clears after playback', technique => {
    const scene = new THREE.Scene(), fx = new TechniqueSpectacle(scene, new THREE.PerspectiveCamera());
    const count = fx.root.children.length, origin = new THREE.Vector3(-1, 2, 1), target = new THREE.Vector3(2, 1.47, -1.35);
    for (const t of [0, CONTACT_MS[technique.key] - 1, CONTACT_MS[technique.key] + 120, technique.effectMs - 1, technique.effectMs]) {
      fx.update(combatTimeline(technique.key, t, technique.effectMs), origin, target, target);
      scene.traverse(object => {
        expect([...object.position.toArray(), ...object.quaternion.toArray(), ...object.scale.toArray()].every(Number.isFinite)).toBe(true);
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) for (const attr of Object.values(mesh.geometry.attributes)) expect(Array.from(attr.array).every(Number.isFinite)).toBe(true);
      });
    }
    expect(fx.root.children).toHaveLength(count); expect(fx.root.visible).toBe(false);
    fx.clear(); expect(fx.root.visible).toBe(false);
  });
  it('quality lowers the particle budget and intensity zero suppresses the new presentation', () => {
    const scene = new THREE.Scene(), fx = new TechniqueSpectacle(scene, new THREE.PerspectiveCamera());
    fx.setSettings(.75, true, 'low');
    const points = fx.root.children.find(v => v instanceof THREE.Points) as THREE.Points;
    expect(points.geometry.drawRange.count).toBe(1800);
    fx.setSettings(.75, true, 'high'); expect(points.geometry.drawRange.count).toBe(9000);
    fx.setSettings(0, true); fx.update(combatTimeline('red', 500, 2200), new THREE.Vector3(), new THREE.Vector3(2, 1, -1), new THREE.Vector3());
    expect(fx.root.visible).toBe(false);
  });
  it('pressure lens respects reduced flashes, viewport and pause/cleanup', () => {
    const camera = new THREE.PerspectiveCamera(42, 16 / 9, .1, 200); camera.position.set(8.7, 5.8, 12.5); camera.lookAt(0, 1, -.6); camera.updateMatrixWorld();
    const lens = new ImpactLens(); lens.setSize(1920, 1080);
    lens.update(combatTimeline('red', 430, 2200), camera, new THREE.Vector3(2, 1.47, -1.35), .75, true);
    expect(lens.enabled).toBe(true); expect(lens.uniforms.dispersion.value).toBe(0);
    expect(lens.uniforms.aspect.value).toBeCloseTo(16 / 9);
    expect(lens.uniforms.center.value.toArray().every(Number.isFinite)).toBe(true);
    lens.update(combatTimeline('red', -1, 2200), camera, new THREE.Vector3(), .75, false); expect(lens.enabled).toBe(false);
    lens.dispose();
  });
});
