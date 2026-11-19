import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { cutStroke, SukunaCuts } from '../src/scene/SukunaCuts';
import { TechniqueSpectacle } from '../src/scene/TechniqueSpectacle';
import { combatTimeline, CONTACT_MS } from '../src/scene/combatTimeline';

describe('Sukuna cutting presentation', () => {
  it.each([250, 650, 850, 1100])('Sesgar has twelve visible lattice strokes at %s ms, including flight', t => {
    const strokes = Array.from({ length: 12 }, (_, i) => cutStroke('cleave', i, t));
    expect(strokes.every(s => s.alpha > 0 && s.reveal === 1)).toBe(true);
    expect(new Set(strokes.slice(0, 6).map(s => s.x)).size).toBe(6);
    expect(new Set(strokes.slice(6).map(s => s.y)).size).toBe(6);
    expect(strokes[0].dx * strokes[6].dx + strokes[0].dy * strokes[6].dy).toBeCloseTo(0);
  });
  it('builds two perpendicular sets with real width for vertical and horizontal strokes', () => {
    const cuts = new SukunaCuts(new THREE.Scene(), new THREE.PerspectiveCamera());
    cuts.update('cleave', 800, new THREE.Vector3(2, 1.4, -1), 1, .75, true);
    const p = cuts.geometry.getAttribute('position');
    const direction = (r: number) => new THREE.Vector3().fromBufferAttribute(p, (r * 48 + 47) * 2)
      .sub(new THREE.Vector3().fromBufferAttribute(p, r * 48 * 2)).normalize();
    expect(direction(0).dot(direction(6))).toBeCloseTo(0, 4);
    for (let r = 0; r < 12; r++) {
      const a = new THREE.Vector3().fromBufferAttribute(p, (r * 48 + 24) * 2), b = new THREE.Vector3().fromBufferAttribute(p, (r * 48 + 24) * 2 + 1);
      expect(a.distanceTo(b)).toBeGreaterThan(.04);
      expect(a.clone().sub(b).normalize().dot(direction(r))).toBeCloseTo(0, 4);
    }
  });
  it('Desmantelar has a leading crescent with thinner delayed trails', () => {
    const lead = cutStroke('dismantle', 0, 300), trail = cutStroke('dismantle', 1, 300);
    expect(lead.width).toBeGreaterThan(trail.width); expect(lead.curve).toBeGreaterThan(.2);
    expect(cutStroke('dismantle', 0, 1300).alpha).toBe(0);
  });
  it('Santuario waits for contact and changes its barrage orientation between waves', () => {
    expect(cutStroke('shrine', 0, CONTACT_MS.shrine - 1).alpha).toBe(0);
    const first = cutStroke('shrine', 0, CONTACT_MS.shrine + 190), next = cutStroke('shrine', 0, CONTACT_MS.shrine + 610);
    expect(first.alpha).toBeGreaterThan(0); expect(next.alpha).toBeGreaterThan(0);
    expect(first.dx).not.toBeCloseTo(next.dx);
  });
  it.each(['low', 'high'] as const)('the active renderer retains the full Sesgar grid in %s quality and clears it', quality => {
    const scene = new THREE.Scene(), fx = new TechniqueSpectacle(scene, new THREE.PerspectiveCamera()); fx.setSettings(.75, true, quality);
    fx.update(combatTimeline('cleave', 300, 3000), new THREE.Vector3(-1, 2, 1), new THREE.Vector3(2, 1.47, -1.35), new THREE.Vector3());
    const root = scene.getObjectByName('Sukuna cutting lattice')!, mesh = root.children[0] as THREE.Mesh;
    expect(root.visible).toBe(true); expect(mesh.geometry.drawRange.count).toBe(12 * 47 * 6);
    const strength = mesh.geometry.getAttribute('strokeStrength');
    for (let r = 0; r < 12; r++) expect(strength.getX(r * 96 + 48)).toBeGreaterThan(0);
    const count = root.children.length;
    fx.update(combatTimeline('shrine', 1200, 8000), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3());
    expect(mesh.geometry.drawRange.count).toBe(24 * 47 * 6); expect(root.children).toHaveLength(count);
    fx.update(combatTimeline('blue', 300, 1800), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3());
    expect(root.visible).toBe(false); expect(mesh.geometry.drawRange.count).toBe(0);
    fx.clear(); expect(fx.root.visible).toBe(false);
  });
});
