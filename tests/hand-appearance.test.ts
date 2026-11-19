import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { HandRig } from '../src/scene/HandRig';
import { HAND_APPEARANCE } from '../src/scene/handAppearance';
import { TrainingScene } from '../src/scene/TrainingScene';
import { ALL_TECHNIQUES } from '../src/core/techniques';
import { trackedPose } from './fixtures';

describe('character-specific tracked hands (CPU geometry and transforms)', () => {
  it('switches the complete cached anatomy, sleeves, wrist marks and nails on the same skeleton', () => {
    const rig = new HandRig(), geometry = rig.mesh.geometry, skeleton = rig.mesh.skeleton;
    rig.setCharacter('sukuna'); const sukunaGeometry = rig.mesh.geometry;
    expect(sukunaGeometry).not.toBe(geometry);
    const details = rig.mesh.getObjectByName('Character hand details')!;
    const marks = rig.mesh.getObjectByName('Sukuna wrist markings')!;
    const natural = rig.mesh.getObjectByName('Gojo natural nails') as THREE.InstancedMesh;
    const pointed = rig.mesh.getObjectByName('Sukuna dark nails') as THREE.InstancedMesh;
    const sleeve = rig.mesh.getObjectByName('Character sleeve') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshToonMaterial>;
    const count = rig.mesh.getObjectsByProperty('type', 'Mesh').length;
    expect(details.parent).toBe(rig.mesh); expect(rig.mesh.visible).toBe(false);
    for (const character of ['gojo', 'sukuna', 'gojo', 'sukuna', 'gojo'] as const) {
      rig.setCharacter(character);
      expect(rig.character).toBe(character);
      expect((rig.mesh.material as THREE.MeshToonMaterial).color.getHexString()).toBe(HAND_APPEARANCE[character].skin.slice(1));
      expect(sleeve.material.color.getHexString()).toBe(HAND_APPEARANCE[character].sleeve.slice(1));
      expect(marks.visible).toBe(character === 'sukuna');
      expect(natural.visible).toBe(character === 'gojo'); expect(pointed.visible).toBe(character === 'sukuna');
      expect((pointed.material as THREE.MeshToonMaterial).color.getHexString()).toBe(HAND_APPEARANCE[character].nail.slice(1));
      expect(rig.mesh.geometry).toBe(character === 'gojo' ? geometry : sukunaGeometry);
      expect(rig.mesh.skeleton).toBe(skeleton);
      expect(rig.ownedGeometries()).toContain(rig.mesh.geometry);
      expect(rig.mesh.getObjectsByProperty('type', 'Mesh')).toHaveLength(count);
    }
  });
  it('preserves all 21 observed world-space landmarks, input data and effect anchors for either appearance', () => {
    const camera = new THREE.PerspectiveCamera(42, 16 / 9, .1, 200), rig = new HandRig();
    camera.position.set(2, 3, 4); camera.lookAt(0, 1, 0); camera.add(rig.mesh); camera.updateMatrixWorld(true);
    const hand = trackedPose('red', .4), input = structuredClone(hand), aspect = 4 / 3;
    const height = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 4.2;
    const imageWidth = Math.min(height * camera.aspect * .86, height * aspect * .9), imageHeight = imageWidth / aspect;
    for (const character of ['gojo', 'sukuna', 'yuji', 'megumi'] as const) for (const handedness of ['Left', 'Right']) {
      rig.setCharacter(character); rig.update({ ...hand, handedness }, camera, aspect, false);
      hand.landmarks.forEach((p, i) => {
        const expected = camera.localToWorld(new THREE.Vector3((.5 - p.x) * imageWidth,
          (.5 - p.y) * imageHeight - .16, -4.2 - (p.z - hand.landmarks[0].z) * imageWidth * .65));
        expect(rig.landmarkWorld(i).distanceTo(expected)).toBeLessThan(1e-8);
        expect(rig.mesh.skeleton.bones[i].getWorldPosition(new THREE.Vector3()).distanceTo(expected)).toBeLessThan(1e-8);
      });
      expect(hand).toEqual(input);
    }
  });
  it('keeps nails and cuffs finite for flexed fingers, either handedness and a degenerate palm', () => {
    const rig = new HandRig('sukuna'), camera = new THREE.PerspectiveCamera(42, 16 / 9, .1, 200);
    for (const pose of ['open', 'fist', 'red', 'domain', 'purple'] as const) for (const handedness of ['Left', 'Right']) {
      rig.update({ ...trackedPose(pose), handedness }, camera, 4 / 3, false);
      rig.mesh.traverse(object => {
        expect([...object.position.toArray(), ...object.quaternion.toArray(), ...object.scale.toArray()].every(Number.isFinite)).toBe(true);
        if (object instanceof THREE.InstancedMesh) expect(Array.from(object.instanceMatrix.array).every(Number.isFinite)).toBe(true);
      });
    }
    const hand = trackedPose('open'), points = hand.landmarks.map(() => ({ ...hand.landmarks[0] }));
    rig.update({ ...hand, raw: points, landmarks: points }, camera, 4 / 3, false);
    expect(rig.mesh.getObjectByName('Character hand details')!.visible).toBe(false);
  });
  it('hides all cosmetic geometry together with a lost tracked hand', () => {
    const camera = new THREE.PerspectiveCamera(42, 1, .1, 200), rig = new HandRig('sukuna'); camera.add(rig.mesh);
    rig.update(trackedPose('open'), camera, 1, false);
    expect(rig.mesh.getObjectByName('Character hand details')!.visible).toBe(true);
    rig.mesh.visible = false; const visible: THREE.Object3D[] = [];
    camera.traverseVisible(object => visible.push(object));
    expect(visible).not.toContain(rig.mesh.getObjectByName('Character sleeve'));
    expect(visible).not.toContain(rig.mesh.getObjectByName('Sukuna dark nails'));
  });
  it('updates both hand slots automatically for every character and technique selection', () => {
    const hands = [new HandRig(), new HandRig()];
    const scene = {
      hands, shrineCamera: { reset() {} }, world: { curse: { reset() {} }, gojo: { root: { visible: true } }, sukuna: { root: { visible: false } }, yuji: { root: { visible: false } }, megumi: { root: { visible: false } } },
      effect: { setTechnique() {}, preloadShrine() { return Promise.resolve(); } }, applyDomain() {}, setCharge() {},
      renderer: { domElement: { setAttribute() {} } },
    };
    for (const technique of ALL_TECHNIQUES) {
      TrainingScene.prototype.setTechnique.call(scene as unknown as TrainingScene, technique.key);
      expect(hands.every(rig => rig.character === technique.character)).toBe(true);
    }
  });
});
