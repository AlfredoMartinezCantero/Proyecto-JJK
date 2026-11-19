import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ShrineDomain } from '../src/scene/ShrineDomain';
import { ShrineCamera } from '../src/scene/ShrineCamera';
import { shrineTimeline } from '../src/scene/shrineTimeline';
import { combatTimeline, CONTACT_MS, persistentTargetTimeline } from '../src/scene/combatTimeline';
import { TECHNIQUES } from '../src/core/techniques';

// Geometry/material graph and timing tests. No GPU, image decoding or webcam is simulated as verified.
beforeAll(() => vi.stubGlobal('document', { createElement: () => ({ width: 128, height: 128,
  getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillStyle: '', fillRect() {} }) }) }));
afterAll(() => vi.unstubAllGlobals());
const duration = TECHNIQUES.shrine.effectMs;
function camera() {
  const c = new THREE.PerspectiveCamera(42, 16 / 9, .1, 200); c.position.set(8.7, 5.8, 12.5); c.lookAt(0, 1, -.6); c.updateMatrixWorld(); return c;
}
function model() { return new THREE.Mesh(new THREE.BoxGeometry(12, 9, 11), new THREE.MeshStandardMaterial()); }

describe('imported Malevolent Shrine', () => {
  it('loads the actual GLB geometry, UVs and five complete texture/material pairs', async () => {
    const b = readFileSync(new URL('../public/assets/shrine/malevolent-shrine.glb', import.meta.url));
    const jsonLength = b.readUInt32LE(12), json = JSON.parse(b.subarray(20, 20 + jsonLength).toString());
    expect(b.readUInt32LE(8)).toBe(b.byteLength);
    expect(json.images).toHaveLength(10);
    for (const image of json.images) {
      expect(image.uri).toBeUndefined(); expect(image.mimeType).toBe('image/jpeg');
      const view = json.bufferViews[image.bufferView];
      expect(b.readUInt16BE(28 + jsonLength + view.byteOffset)).toBe(0xffd8);
    }
    const loader = new GLTFLoader();
    loader.register(() => ({ name: 'CPU-texture-placeholders', loadTexture: () => Promise.resolve(new THREE.Texture()) }));
    const gltf = await loader.parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
    let triangles = 0; const materials = new Set<THREE.Material>();
    gltf.scene.traverse(o => {
      if (!(o instanceof THREE.Mesh)) return;
      triangles += o.geometry.index!.count / 3;
      expect(o.geometry.getAttribute('uv').count).toBe(o.geometry.getAttribute('position').count);
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
        materials.add(m); expect(m.map).toBeInstanceOf(THREE.Texture); expect(m.normalMap).toBeInstanceOf(THREE.Texture);
      });
    });
    expect(triangles).toBe(196918); expect(materials.size).toBe(5);
    const bounds = new THREE.Box3().setFromObject(gltf.scene);
    expect(bounds.min.y).toBeCloseTo(0); expect(bounds.getSize(new THREE.Vector3()).x).toBeCloseTo(12);
    expect(gltf.animations).toHaveLength(0);
  });
  it('loads once, keeps a late arrival out of a running fallback shot, and uses it next time', async () => {
    let resolve!: (o: THREE.Object3D) => void;
    const load = vi.fn(() => new Promise<THREE.Object3D>(r => { resolve = r; })), status = vi.fn();
    const domain = new ShrineDomain(status, load);
    const a = domain.preload(), b = domain.preload(); expect(a).toBe(b); expect(load).toHaveBeenCalledTimes(1);
    domain.begin(); domain.update(3000, duration, .75, true, 'high');
    resolve(model()); await a;
    domain.update(3500, duration, .75, true, 'high');
    expect(domain.root.getObjectByName('Imported Malevolent Shrine')!.visible).toBe(false);
    expect(domain.root.getObjectByName('Shrine fallback')!.visible).toBe(true);
    domain.clear(); domain.begin(); domain.update(3000, duration, .75, true, 'high');
    expect(domain.root.getObjectByName('Imported Malevolent Shrine')!.visible).toBe(true);
    expect(domain.root.getObjectByName('Shrine fallback')!.visible).toBe(false);
    await domain.preload(); expect(load).toHaveBeenCalledTimes(1); expect(status.mock.calls.map(c => c[0])).toEqual(['loading', 'ready']);
  });
  it('recovers from a missing asset and disposes a model that finishes after scene disposal', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('404')).mockResolvedValueOnce(model());
    const status = vi.fn(), domain = new ShrineDomain(status, load);
    await domain.preload(); expect(status).toHaveBeenLastCalledWith('error');
    await domain.preload(); expect(status).toHaveBeenLastCalledWith('ready');
    let resolve!: (o: THREE.Object3D) => void;
    const late = new ShrineDomain(vi.fn(), () => new Promise(r => { resolve = r; }));
    const pending = late.preload(), mesh = model(), dispose = vi.spyOn(mesh.geometry, 'dispose');
    late.dispose(); resolve(mesh); await pending;
    expect(dispose).toHaveBeenCalledOnce(); expect(late.root.getObjectByName('Imported Malevolent Shrine')).toBeUndefined();
  });
  it('clears the model/lights, lowers mist/dust budgets and suppresses the presentation at intensity zero', async () => {
    const domain = new ShrineDomain(vi.fn(), async () => model()); await domain.preload(); domain.begin();
    domain.update(3000, duration, .75, true, 'low');
    const mist = domain.root.getObjectByName('Shrine ground mist') as THREE.Points;
    expect(mist.geometry.drawRange.count).toBe(80);
    domain.update(3000, duration, .75, true, 'high'); expect(mist.geometry.drawRange.count).toBe(240);
    domain.update(3000, duration, 0, false, 'high'); expect(domain.root.visible).toBe(false);
    domain.root.traverse(o => { if (o instanceof THREE.Light) expect(o.intensity).toBe(0); });
    domain.begin(); domain.update(duration, duration, .75, false, 'high'); expect(domain.root.visible).toBe(false);
  });
});

describe('domain opening and camera restoration', () => {
  it('finishes the reveal and wide shot before damage and keeps the destroyed target afterward', () => {
    const before = shrineTimeline(CONTACT_MS.shrine - 1, duration);
    expect(before.rise).toBe(1); expect(before.reveal).toBe(1); expect(before.wide).toBeGreaterThan(.99); expect(before.cutting).toBe(false);
    expect(combatTimeline('shrine', CONTACT_MS.shrine - 1, duration).cuts).toBe(0);
    expect(shrineTimeline(CONTACT_MS.shrine, duration).cutting).toBe(true);
    const target = persistentTargetTimeline('shrine', 30000, duration);
    expect(target.cuts).toBe(1); expect(target.recovery).toBe(0);
  });
  it.each([16 / 9, 4 / 3, 9 / 16])('frames the complete roof and front target at aspect %s', aspect => {
    const c = camera(); c.aspect = aspect; c.updateProjectionMatrix();
    const director = new ShrineCamera(c); director.update(combatTimeline('shrine', 3000, duration), .75, true);
    const points = [new THREE.Vector3(2, .06, -1.35), new THREE.Vector3(-2.65, .06, .8)];
    for (const x of [-6, 6]) for (const y of [.065, 9.06]) for (const z of [-14.58, -2.82]) points.push(new THREE.Vector3(x, y, z));
    for (const p of points) {
      const v = p.project(c); expect(Math.abs(v.x)).toBeLessThan(.98); expect(Math.abs(v.y)).toBeLessThan(.98); expect(v.z).toBeLessThan(1);
    }
  });
  it('samples camera motion independently of frame rate and restores its exact original pose on clear/end/change', () => {
    const c = camera(), home = c.position.clone(), rotation = c.quaternion.clone(), director = new ShrineCamera(c);
    for (const time of [0, 500, 1200, 2150, 3000, 7900]) {
      const state = combatTimeline('shrine', time, duration); director.update(state, .75, false);
      const p = c.position.clone(), q = c.quaternion.clone(); director.update(state, .75, false);
      expect(c.position.toArray()).toEqual(p.toArray()); expect(c.quaternion.toArray()).toEqual(q.toArray());
    }
    director.reset(); expect(c.position.toArray()).toEqual(home.toArray()); expect(c.quaternion.toArray()).toEqual(rotation.toArray());
    director.update(combatTimeline('shrine', 3000, duration), .75, true);
    director.update(combatTimeline('shrine', duration, duration), .75, true); expect(c.position.toArray()).toEqual(home.toArray());
    director.update(combatTimeline('shrine', 3000, duration), .75, true);
    director.update(combatTimeline('red', 300, 2200), .75, true); expect(c.quaternion.toArray()).toEqual(rotation.toArray());
    director.update(combatTimeline('shrine', 3000, duration), 0, true); expect(c.position.toArray()).toEqual(home.toArray());
  });
});
