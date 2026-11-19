import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createAnatomicalHand } from '../src/scene/anatomicalHand';
import { HandRig } from '../src/scene/HandRig';
import { HAND_REST } from '../src/scene/handSkeleton';
import { trackedPose } from './fixtures';

describe('complete anatomical hands (synthetic CPU geometry)', () => {
  for (const character of ['gojo', 'sukuna', 'yuji', 'megumi'] as const) {
    it(`${character}: has one closed connected skin with valid deformation weights`, () => {
      const geometry = createAnatomicalHand(character), index = geometry.getIndex()!;
      const position = geometry.getAttribute('position'), weights = geometry.getAttribute('skinWeight'), bones = geometry.getAttribute('skinIndex');
      const parent = Array.from({ length: position.count }, (_, i) => i), edges = new Map<number, number>();
      const find = (i: number): number => parent[i] === i ? i : (parent[i] = find(parent[i]));
      for (let i = 0; i < index.count; i += 3) for (let j = 0; j < 3; j++) {
        const a = index.getX(i+j), b = index.getX(i+(j+1)%3), key = Math.min(a,b)*position.count+Math.max(a,b);
        edges.set(key, (edges.get(key) ?? 0)+1); parent[find(a)] = find(b);
      }
      expect(new Set(parent.map((_, i) => find(i))).size).toBe(1);
      expect([...edges.values()].filter(count => count !== 2)).toHaveLength(0);
      let maxWeightError = 0, validWeights = true, validBones = true;
      for (let i = 0; i < position.count; i++) {
        const ws = [weights.getX(i), weights.getY(i), weights.getZ(i), weights.getW(i)];
        maxWeightError = Math.max(maxWeightError, Math.abs(ws.reduce((a,b) => a+b, 0)-1));
        validWeights &&= ws.every(w => w >= 0 && w <= 1 && Number.isFinite(w));
        validBones &&= [bones.getX(i), bones.getY(i), bones.getZ(i), bones.getW(i)].every(b => b >= 0 && b < 21);
      }
      expect(maxWeightError).toBeLessThan(1e-6); expect(validWeights).toBe(true); expect(validBones).toBe(true);
      for (const attribute of Object.values(geometry.attributes)) expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true);
      geometry.dispose();
    });
    it(`${character}: moves the whole surface with a rotated hand without flattening or separating it`, () => {
      const rig = new HandRig(character), camera = new THREE.PerspectiveCamera(42, 1, .1, 200);
      camera.add(rig.mesh);
      const width = 2*Math.tan(THREE.MathUtils.degToRad(21))*4.2*.86;
      const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(.3, .6, -.25));
      const points = HAND_REST.map(p => {
        const q = p.clone().applyQuaternion(rotation);
        return { x: .5-q.x/width, y: .75-q.y/width, z: -q.z/(width*.65) };
      });
      rig.update({ id: 1, raw: points, landmarks: points, handedness: 'Right', handednessScore: 1 }, camera, 1, false);
      rig.mesh.skeleton.update();
      const position = rig.mesh.geometry.getAttribute('position'); let maxError = 0;
      for (let i = 0; i < position.count; i++) {
        const rest = new THREE.Vector3().fromBufferAttribute(position, i);
        maxError = Math.max(maxError, rig.mesh.applyBoneTransform(i, rest.clone()).distanceTo(rest.applyQuaternion(rotation)));
      }
      expect(maxError).toBeLessThan(1e-5);
    });
  }
  it('uses different full skin shapes and palm details for Gojo and Sukuna', () => {
    const gojo = createAnatomicalHand('gojo'), sukuna = createAnatomicalHand('sukuna');
    expect(gojo.getAttribute('position').array).not.toEqual(sukuna.getAttribute('position').array);
    expect(gojo.getAttribute('color').array).not.toEqual(sukuna.getAttribute('color').array);
    for (const geometry of [gojo, sukuna]) {
      const colors = geometry.getAttribute('color');
      expect(Math.min(...Array.from(colors.array))).toBeLessThan(.85);
      geometry.dispose();
    }
  });
  it('deforms all vertices finitely with bent, crossed and rotated fingers on either hand', () => {
    const rig = new HandRig(), camera = new THREE.PerspectiveCamera(42, 1, .1, 200); camera.add(rig.mesh);
    for (const character of ['gojo', 'sukuna', 'yuji'] as const) for (const pose of ['open', 'fist', 'red', 'domain'] as const) for (const handedness of ['Left', 'Right']) {
      rig.setCharacter(character); rig.update({ ...trackedPose(pose), handedness }, camera, 1, false); rig.mesh.skeleton.update();
      const position = rig.mesh.geometry.getAttribute('position'); let finite = true;
      for (let i = 0; i < position.count; i++) {
        const p = rig.mesh.applyBoneTransform(i, new THREE.Vector3().fromBufferAttribute(position, i));
        finite &&= p.toArray().every(Number.isFinite) && p.length() < 8;
      }
      expect(finite).toBe(true);
    }
  });
  it('keeps the palm surface facing outward when the observed palm has different proportions', () => {
    const rig = new HandRig(), camera = new THREE.PerspectiveCamera(42, 1, .1, 200); camera.add(rig.mesh);
    const hand = trackedPose('open'), points = hand.landmarks.map(p => ({ ...p, x: 1-p.x }));
    for (const character of ['gojo', 'sukuna'] as const) {
      rig.setCharacter(character); rig.update({ ...hand, raw: points, landmarks: points }, camera, 1, false); rig.mesh.skeleton.update();
      const geometry = rig.mesh.geometry, index = geometry.getIndex()!, position = geometry.getAttribute('position');
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), normal = new THREE.Vector3();
      let checked = 0, inverted = 0;
      for (let i = 0; i < index.count; i += 3) {
        const ids = [index.getX(i), index.getX(i+1), index.getX(i+2)];
        a.fromBufferAttribute(position, ids[0]); b.fromBufferAttribute(position, ids[1]); c.fromBufferAttribute(position, ids[2]);
        const x = (a.x+b.x+c.x)/3, y = (a.y+b.y+c.y)/3;
        normal.crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize();
        if (y < .15 || y > .63 || x < -.15 || x > .3 || Math.abs(normal.z) < .9) continue;
        const sign = Math.sign(normal.z);
        rig.mesh.applyBoneTransform(ids[0], a); rig.mesh.applyBoneTransform(ids[1], b); rig.mesh.applyBoneTransform(ids[2], c);
        normal.crossVectors(b.sub(a), c.sub(a)); checked++; if (normal.z*sign <= 0) inverted++;
      }
      expect(checked).toBeGreaterThan(100);
      expect(inverted).toBe(0);
    }
  });
});
