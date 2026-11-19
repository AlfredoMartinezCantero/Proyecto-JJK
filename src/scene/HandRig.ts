import * as THREE from 'three';
import { HAND_CONNECTIONS } from '../core/techniques';
import type { CharacterKey, TrackedHand } from '../core/types';
import { HAND_APPEARANCE } from './handAppearance';
import { CharacterHandDetails } from './CharacterHandDetails';
import { createAnatomicalHand, createHandOutline } from './anatomicalHand';
import { HAND_CHILDREN, HAND_PARENTS, HAND_REST } from './handSkeleton';

export class HandRig {
  readonly mesh: THREE.SkinnedMesh;
  private readonly bones: THREE.Bone[];
  private readonly outline: THREE.SkinnedMesh;
  private readonly variants = new Map<CharacterKey, { skin: THREE.BufferGeometry; outline: THREE.BufferGeometry }>();
  private readonly skeletonLines: THREE.LineSegments;
  private readonly linePositions = new Float32Array(HAND_CONNECTIONS.length * 6);
  private readonly targets = HAND_REST.map(() => new THREE.Vector3());
  private readonly rotations = HAND_REST.map(() => new THREE.Quaternion());
  private readonly desired = HAND_REST.map(() => new THREE.Matrix4());
  private readonly restDirections = HAND_REST.map((p, i) => i === 0 ? HAND_REST[9].clone() :
    HAND_CHILDREN[i] >= 0 ? HAND_REST[HAND_CHILDREN[i]].clone().sub(p) : p.clone().sub(HAND_REST[HAND_PARENTS[i]]));
  private readonly up = new THREE.Vector3();
  private readonly side = new THREE.Vector3();
  private readonly normal = new THREE.Vector3();
  private readonly direction = new THREE.Vector3();
  private readonly reference = new THREE.Vector3();
  private readonly palmRotation = new THREE.Quaternion();
  private readonly swing = new THREE.Quaternion();
  private readonly matrix = new THREE.Matrix4();
  private readonly stretch = new THREE.Matrix4();
  private readonly material = new THREE.MeshToonMaterial({ color: HAND_APPEARANCE.gojo.skin, vertexColors: true, side: THREE.DoubleSide });
  private readonly details: CharacterHandDetails;
  private characterKey: CharacterKey = 'gojo';

  constructor(character: CharacterKey = 'gojo') {
    const variant = this.variant(character);
    this.mesh = new THREE.SkinnedMesh(variant.skin, this.material);
    this.mesh.renderOrder = 20; this.mesh.frustumCulled = false; this.mesh.visible = false;
    this.bones = HAND_REST.map(() => new THREE.Bone());
    for (let i = 0; i < 21; i++) {
      this.bones[i].position.copy(HAND_REST[i]);
      if (i === 0) this.mesh.add(this.bones[i]);
      else {
        this.bones[i].position.sub(HAND_REST[HAND_PARENTS[i]]);
        this.bones[HAND_PARENTS[i]].add(this.bones[i]);
      }
    }
    this.mesh.bind(new THREE.Skeleton(this.bones));
    this.bones.forEach(bone => { bone.matrixAutoUpdate = false; });
    this.outline = new THREE.SkinnedMesh(variant.outline,
      new THREE.MeshBasicMaterial({ color: '#211b27', side: THREE.BackSide }));
    this.outline.name = 'Hand ink outline'; this.outline.renderOrder = 19; this.outline.frustumCulled = false;
    this.outline.bind(this.mesh.skeleton, this.mesh.bindMatrix); this.mesh.add(this.outline);
    const lines = new THREE.BufferGeometry(); lines.setAttribute('position', new THREE.BufferAttribute(this.linePositions, 3));
    this.skeletonLines = new THREE.LineSegments(lines, new THREE.LineBasicMaterial({ color: '#84edff', depthTest: false }));
    this.skeletonLines.renderOrder = 22; this.skeletonLines.frustumCulled = false; this.mesh.add(this.skeletonLines);
    this.details = new CharacterHandDetails(this.mesh); this.setCharacter(character);
  }

  get character() { return this.characterKey; }
  /** Includes inactive variants so scene teardown also releases their GPU buffers. */
  ownedGeometries(): THREE.BufferGeometry[] { return [...this.variants.values()].flatMap(v => [v.skin, v.outline]); }
  private variant(character: CharacterKey) {
    let variant = this.variants.get(character);
    if (!variant) {
      const skin = createAnatomicalHand(character); variant = { skin, outline: createHandOutline(skin, character) };
      this.variants.set(character,variant);
    }
    return variant;
  }
  setCharacter(character: CharacterKey): void {
    this.characterKey = character; this.mesh.userData.character = character;
    this.mesh.name = `${character} tracked hand`; this.material.color.set(HAND_APPEARANCE[character].skin);
    const variant = this.variant(character);
    this.mesh.geometry = variant.skin; this.outline.geometry = variant.outline;
    this.details.setCharacter(character);
  }

  update(hand: TrackedHand, camera: THREE.PerspectiveCamera, imageAspect: number, debug: boolean): void {
    const distance = 4.2;
    const viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * distance;
    const viewWidth = viewHeight * camera.aspect;
    const imageWidth = Math.min(viewWidth * .86, viewHeight * imageAspect * .9);
    const imageHeight = imageWidth / imageAspect;
    const wrist = hand.landmarks[0];
    this.mesh.position.set((.5 - wrist.x) * imageWidth, (.5 - wrist.y) * imageHeight - .16, -distance);
    hand.landmarks.forEach((point, i) => {
      this.targets[i].set(-(point.x - wrist.x) * imageWidth,
        -(point.y - wrist.y) * imageHeight, -(point.z - wrist.z) * imageWidth * .65);
    });
    // Reflect the anatomy for the other hand, keeping the observed anchors identical.
    const scale = Math.max(.001, this.targets[9].length() / HAND_REST[9].length());
    const mirror = hand.handedness === 'Left' ? -1 : 1;
    this.mesh.scale.set(scale * mirror, scale, scale);
    this.targets.forEach(point => { point.divideScalar(scale); point.x *= mirror; });
    this.poseSkeleton();
    HAND_CONNECTIONS.forEach(([a, b], index) => {
      this.targets[a].toArray(this.linePositions, index * 6);
      this.targets[b].toArray(this.linePositions, index * 6 + 3);
    });
    this.skeletonLines.geometry.getAttribute('position').needsUpdate = true;
    this.skeletonLines.visible = debug;
    this.details.update(this.targets, this.rotations);
    this.mesh.visible = true; this.mesh.updateMatrixWorld(true);
  }

  private poseSkeleton() {
    this.up.copy(this.targets[9]).sub(this.targets[0]);
    if (this.up.lengthSq() < 1e-8) this.up.set(0, 1, 0); else this.up.normalize();
    this.side.copy(this.targets[17]).sub(this.targets[5]).addScaledVector(this.up, -this.side.dot(this.up));
    if (this.side.lengthSq() < 1e-8) {
      this.side.set(Math.abs(this.up.x) < .8 ? 1 : 0, 0, Math.abs(this.up.x) < .8 ? 0 : 1);
      this.side.addScaledVector(this.up, -this.side.dot(this.up));
    }
    this.side.normalize(); this.normal.crossVectors(this.side, this.up).normalize();
    this.matrix.makeBasis(this.side, this.up, this.normal); this.palmRotation.setFromRotationMatrix(this.matrix);
    for (let i = 0; i < 21; i++) {
      const child = HAND_CHILDREN[i], rest = this.restDirections[i], restLength = rest.length();
      if (i === 0) this.direction.copy(this.up).multiplyScalar(restLength);
      else if (child >= 0) this.direction.copy(this.targets[child]).sub(this.targets[i]);
      else this.direction.copy(this.targets[i]).sub(this.targets[HAND_PARENTS[i]]);
      const length = this.direction.length();
      this.reference.copy(rest).divideScalar(restLength).applyQuaternion(this.palmRotation);
      if (length > 1e-8) this.swing.setFromUnitVectors(this.reference, this.direction.divideScalar(length)); else this.swing.identity();
      this.rotations[i].copy(this.swing).multiply(this.palmRotation);
      this.desired[i].makeRotationFromQuaternion(this.rotations[i]);
      // Stretch only along the observed phalanx. Thickness and curved cross-sections remain intact.
      const ratio = i && child >= 0 ? THREE.MathUtils.clamp(length / restLength, .05, 4) : 1;
      const x = rest.x / restLength, y = rest.y / restLength, z = rest.z / restLength, k = ratio - 1;
      this.stretch.set(1 + k*x*x, k*x*y, k*x*z, 0, k*y*x, 1 + k*y*y, k*y*z, 0,
        k*z*x, k*z*y, 1 + k*z*z, 0, 0, 0, 0, 1);
      this.desired[i].multiply(this.stretch).setPosition(this.targets[i]);
      if (i === 0) this.bones[i].matrix.copy(this.desired[i]);
      else this.bones[i].matrix.copy(this.desired[HAND_PARENTS[i]]).invert().multiply(this.desired[i]);
      this.bones[i].matrix.decompose(this.bones[i].position, this.bones[i].quaternion, this.bones[i].scale);
      this.bones[i].matrixWorldNeedsUpdate = true;
    }
  }

  palmWorld(): THREE.Vector3 { return this.landmarkWorld(9); }
  landmarkWorld(index: number): THREE.Vector3 {
    this.mesh.updateWorldMatrix(true, false);
    return this.mesh.localToWorld(this.targets[index].clone());
  }
}
