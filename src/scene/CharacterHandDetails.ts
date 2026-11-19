import * as THREE from 'three';
import type { CharacterKey } from '../core/types';
import { HAND_APPEARANCE } from './handAppearance';
import { HAND_SHAPE } from './anatomicalHand';

const TIPS = [4, 8, 12, 16, 20];
const material = (color: string) => new THREE.MeshToonMaterial({ color, side: THREE.DoubleSide });
function nailGeometry(pointed: boolean) {
  if (!pointed) return new THREE.SphereGeometry(.5, 16, 10).scale(1, 1.15, .28);
  // A curved, closed claw with thickness, rather than a flat triangular sticker.
  const positions: number[] = [], indices: number[] = [], rings = 8, sides = 12;
  for (let ring = 0; ring < rings; ring++) {
    const t = ring / rings, radius = .46 * Math.pow(1 - t, .8);
    for (let side = 0; side < sides; side++) {
      const angle = side / sides * Math.PI * 2;
      positions.push(Math.cos(angle) * radius, -.5 + t * 1.65, Math.sin(angle) * radius * .35 + t*t * .32);
    }
  }
  const base = positions.length / 3; positions.push(0, -.5, 0);
  const tip = positions.length / 3; positions.push(0, 1.15, .32);
  for (let side = 0; side < sides; side++) {
    const next = (side + 1) % sides; indices.push(base, side, next);
    for (let ring = 0; ring < rings - 1; ring++) {
      const a = ring*sides + side, b = ring*sides + next;
      indices.push(a, a+sides, b, b, a+sides, b+sides);
    }
    indices.push((rings-1)*sides+side, tip, (rings-1)*sides+next);
  }
  const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

/** Cosmetic details use the observed palm/finger frame, never a gesture template. */
export class CharacterHandDetails {
  readonly root = new THREE.Group();
  private readonly wrist = new THREE.Group();
  private readonly skin = material(HAND_APPEARANCE.gojo.skin);
  private readonly cloth = material(HAND_APPEARANCE.gojo.sleeve);
  private readonly lining = material(HAND_APPEARANCE.gojo.lining);
  private readonly ink = material(HAND_APPEARANCE.sukuna.ink);
  private readonly nailMaterial = material(HAND_APPEARANCE.gojo.nail);
  private readonly sleeve: THREE.Mesh;
  private readonly cuff: THREE.Mesh;
  private readonly seam: THREE.Mesh;
  private readonly marks = new THREE.Group();
  private readonly naturalNails = new THREE.InstancedMesh(nailGeometry(false), this.nailMaterial, 5);
  private readonly pointedNails = new THREE.InstancedMesh(nailGeometry(true), this.nailMaterial, 5);
  private readonly up = new THREE.Vector3();
  private readonly side = new THREE.Vector3();
  private readonly normal = new THREE.Vector3();
  private readonly nailUp = new THREE.Vector3();
  private readonly nailSide = new THREE.Vector3();
  private readonly nailNormal = new THREE.Vector3();
  private readonly matrix = new THREE.Matrix4();
  private readonly dummy = new THREE.Object3D();
  private character: CharacterKey = 'gojo';

  constructor(parent: THREE.Object3D) {
    this.root.name = 'Character hand details'; this.wrist.name = 'Character wrist';
    this.root.add(this.wrist); parent.add(this.root);
    const add = (geometry: THREE.BufferGeometry, m: THREE.Material, name: string) => {
      const mesh = new THREE.Mesh(geometry, m); mesh.name = name; mesh.renderOrder = 20;
      this.wrist.add(mesh); return mesh;
    };
    add(new THREE.CylinderGeometry(.235, .29, 1.3, 20, 3).scale(1, 1, .68).translate(0, -.6, 0), this.skin, 'Character forearm');
    this.sleeve = add(new THREE.CylinderGeometry(1, 1.14, 1, 16, 2, true), this.cloth, 'Character sleeve');
    this.cuff = add(new THREE.TorusGeometry(1, .045, 6, 24), this.lining, 'Character cuff lining');
    this.seam = add(new THREE.TorusGeometry(1, .015, 5, 24), this.cloth, 'Character cuff seam');
    this.cuff.rotation.x = this.seam.rotation.x = Math.PI / 2;
    this.marks.name = 'Sukuna wrist markings'; this.wrist.add(this.marks);
    for (const y of [-.13, -.32]) {
      const radius = .235 + .055 * (.05 - y) / 1.3 + .002;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius + .003, .075, 16, 1, true), this.ink);
      band.name = 'Sukuna wrist band'; band.position.y = y; band.scale.z = .68; band.renderOrder = 21; this.marks.add(band);
    }
    this.naturalNails.name = 'Gojo natural nails'; this.pointedNails.name = 'Sukuna dark nails';
    for (const nails of [this.naturalNails, this.pointedNails]) {
      nails.frustumCulled = false; nails.renderOrder = 21;
      nails.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.root.add(nails);
    }
    this.setCharacter('gojo'); this.root.visible = false;
  }
  setCharacter(character: CharacterKey) {
    this.character = character;
    const style = HAND_APPEARANCE[character]; this.root.userData.character = character;
    this.skin.color.set(style.skin); this.cloth.color.set(style.sleeve);
    this.lining.color.set(style.lining); this.ink.color.set(style.ink); this.nailMaterial.color.set(style.nail);
    this.marks.visible = style.wristMarks;
    this.naturalNails.visible = !style.pointedNails; this.pointedNails.visible = style.pointedNails;
    this.sleeve.position.y = style.cuffAt - style.sleeveLength / 2;
    this.sleeve.scale.set(style.cuffRadius, style.sleeveLength, style.cuffRadius);
    this.cuff.position.y = style.cuffAt; this.cuff.scale.setScalar(style.cuffRadius);
    this.seam.position.y = style.cuffAt - .065; this.seam.scale.setScalar(style.cuffRadius * 1.015);
  }
  update(targets: readonly THREE.Vector3[], rotations: readonly THREE.Quaternion[]) {
    this.up.copy(targets[9]).sub(targets[0]); const size = this.up.length();
    if (size < .001) { this.root.visible = false; return; }
    this.up.divideScalar(size);
    this.side.copy(targets[17]).sub(targets[5]).addScaledVector(this.up, -this.side.dot(this.up));
    if (this.side.lengthSq() < .000001) {
      this.side.set(Math.abs(this.up.x) < .8 ? 1 : 0, 0, Math.abs(this.up.x) < .8 ? 0 : 1);
      this.side.addScaledVector(this.up, -this.side.dot(this.up));
    }
    this.side.normalize(); this.normal.crossVectors(this.side, this.up).normalize();
    this.matrix.makeBasis(this.side, this.up, this.normal);
    this.wrist.position.copy(targets[0]); this.wrist.quaternion.setFromRotationMatrix(this.matrix);
    this.wrist.scale.setScalar(THREE.MathUtils.clamp(size, .12, .8));
    TIPS.forEach((tip, i) => {
      this.nailUp.copy(targets[tip]).sub(targets[tip - 1]); const length = this.nailUp.length();
      if (length < .005) this.dummy.scale.setScalar(0);
      else {
        this.nailUp.divideScalar(length);
        this.nailNormal.set(0, 0, 1).applyQuaternion(rotations[tip]);
        this.nailNormal.addScaledVector(this.nailUp, -this.nailNormal.dot(this.nailUp));
        if (this.nailNormal.lengthSq() < .000001) this.nailNormal.copy(this.side);
        this.nailNormal.normalize(); this.nailSide.crossVectors(this.nailUp, this.nailNormal).normalize();
        this.nailNormal.crossVectors(this.nailSide, this.nailUp).normalize();
        this.matrix.makeBasis(this.nailSide, this.nailUp, this.nailNormal);
        this.dummy.quaternion.setFromRotationMatrix(this.matrix);
        const width = THREE.MathUtils.clamp(length * .65, .035, .095);
        const claw = HAND_APPEARANCE[this.character].pointedNails;
        this.dummy.scale.set(width, claw ? THREE.MathUtils.clamp(length * 1.05, .08, .24) : THREE.MathUtils.clamp(length * .75, .045, .16), width);
        const surface = HAND_SHAPE[this.character].tip * (i === 0 ? 1.18 : i === 4 ? .9 : 1);
        this.dummy.position.copy(targets[tip]).addScaledVector(this.nailUp, -length * (claw ? .18 : .3)).addScaledVector(this.nailNormal, surface * .94);
      }
      this.dummy.updateMatrix(); this.naturalNails.setMatrixAt(i, this.dummy.matrix); this.pointedNails.setMatrixAt(i, this.dummy.matrix);
    });
    this.naturalNails.instanceMatrix.needsUpdate = this.pointedNails.instanceMatrix.needsUpdate = true;
    this.root.visible = true;
  }
}
