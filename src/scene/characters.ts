import * as THREE from 'three';
import { makePalette, outlined } from './materials';
import { createCurseActor } from './CurseActor';
import { addCasterDetails, addCasterHand } from './casterDetails';

type Palette = ReturnType<typeof makePalette>;
export function createGojo(palette: Palette) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const dark = palette.toon('#192134'), skin = palette.toon('#efd4bc'), white = palette.toon('#e7f6f7');
  const part = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
    const mesh = outlined(geometry, material); mesh.position.set(x, y, z); body.add(mesh); return mesh;
  };
  for (const x of [-.22, .22]) {
    part(new THREE.CapsuleGeometry(.14, .72, 4, 8), dark, x, .63, 0);
    part(new THREE.BoxGeometry(.29, .18, .5), palette.toon('#111729'), x, .1, .1);
  }
  part(new THREE.LatheGeometry([[.29, -.43], [.32, -.34], [.31, -.1], [.37, .2], [.38, .32], [.25, .43]]
    .map(([x, y]) => new THREE.Vector2(x, y)), 24), dark, 0, 1.4, 0);
  part(new THREE.CylinderGeometry(.25, .27, .3, 24), dark, 0, 1.94, -.01);
  part(new THREE.SphereGeometry(.28, 12, 10), skin, 0, 2.17, 0);
  const blindfold = part(new THREE.CylinderGeometry(.287, .287, .15, 16, 1, true),
    palette.toon('#101627'), 0, 2.2, 0);
  blindfold.rotation.x = .06;
  part(new THREE.SphereGeometry(.29, 12, 8, 0, Math.PI * 2, 0, Math.PI * .6), white, 0, 2.3, 0);
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2;
    const spike = part(new THREE.ConeGeometry(.10, .35 + (i % 3) * .07, 8, 3), white,
      Math.cos(a) * .2, 2.48, Math.sin(a) * .2);
    spike.rotation.set(Math.sin(a) * .5, a, -Math.cos(a) * .5);
  }
  const arm = new THREE.Group(); arm.position.set(.4, 1.73, 0); body.add(arm);
  const sleeve = outlined(new THREE.CapsuleGeometry(.13, .48, 4, 8), dark);
  sleeve.position.y = -.3; arm.add(sleeve);
  const hand = outlined(new THREE.SphereGeometry(.13, 10, 8), skin);
  hand.scale.set(.8, 1.25, .7); hand.position.set(0, -.67, 0); arm.add(hand);
  hand.visible = false; addCasterHand(arm, skin, 0, -.67, 0);
  const other = part(new THREE.CapsuleGeometry(.13, .57, 4, 8), dark, -.46, 1.44, 0);
  other.rotation.z = -.12;
  addCasterHand(body, skin, -.5, 1.02, .01);
  addCasterDetails(body, 'gojo', palette);
  root.position.set(-2.65, .04, .8); root.rotation.y = .55;
  return { root, animate(time: number, charging: number) {
    body.position.y = Math.sin(time * 1.4) * .012;
    arm.rotation.x = THREE.MathUtils.lerp(arm.rotation.x, -.25 - charging * 1.25, .08);
    arm.rotation.z = .13 + Math.sin(time) * .025;
  } };
}

export function createSukuna(palette: Palette) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  root.name = 'Ryomen Sukuna';
  const skin = palette.toon('#ddae9a'), robe = palette.toon('#e3d8c7'), ink = palette.toon('#251e2c');
  const part = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
    const mesh = outlined(geometry, material); mesh.position.set(x, y, z); body.add(mesh); return mesh;
  };
  for (const x of [-.22, .22]) {
    part(new THREE.CapsuleGeometry(.15, .65, 4, 8), palette.toon('#2a1d2c'), x, .57, 0);
    part(new THREE.BoxGeometry(.3, .15, .48), ink, x, .09, .1);
  }
  part(new THREE.LatheGeometry([[.47, -.47], [.46, -.38], [.37, -.22], [.34, -.08], [.38, .25], [.41, .35], [.23, .47]]
    .map(([x, y]) => new THREE.Vector2(x, y)), 24), robe, 0, 1.35, 0);
  part(new THREE.CylinderGeometry(.43, .43, .15, 8), palette.toon('#3d1524'), 0, 1.02, 0);
  const lapelA = part(new THREE.BoxGeometry(.085, .72, .06), ink, -.14, 1.57, .35); lapelA.rotation.z = -.35;
  const lapelB = part(new THREE.BoxGeometry(.085, .72, .06), ink, .14, 1.57, .35); lapelB.rotation.z = .35;
  part(new THREE.CylinderGeometry(.13, .15, .22, 8), skin, 0, 1.94, 0);
  part(new THREE.SphereGeometry(.29, 16, 12), skin, 0, 2.16, 0);
  const hair = palette.toon('#c47784');
  part(new THREE.SphereGeometry(.295, 12, 8, 0, Math.PI * 2, 0, Math.PI * .55), hair, 0, 2.29, 0);
  for (let i = 0; i < 13; i++) {
    const a = i / 13 * Math.PI * 2;
    const spike = part(new THREE.ConeGeometry(.095, .28 + i % 3 * .05, 8, 3), hair, Math.cos(a) * .21, 2.43, Math.sin(a) * .21);
    spike.rotation.set(Math.sin(a) * .5, a, -Math.cos(a) * .5);
  }
  for (const side of [-1, 1]) {
    const eye = part(new THREE.SphereGeometry(.043, 8, 6), palette.toon('#e34859'), side * .13, 2.18, .25);
    eye.scale.set(1.4, .55, .45);
    const lowerEye = part(new THREE.BoxGeometry(.085, .018, .015), ink, side * .14, 2.08, .257);
    lowerEye.rotation.z = side * .15;
    const cheek = part(new THREE.BoxGeometry(.022, .16, .016), ink, side * .21, 2.07, .21); cheek.rotation.z = side * .35;
  }
  part(new THREE.BoxGeometry(.04, .11, .016), ink, 0, 2.33, .26);
  part(new THREE.BoxGeometry(.12, .025, .018), ink, 0, 2.0, .25);
  part(new THREE.BoxGeometry(.025, .11, .02), ink, 0, 1.98, .24);
  const arms: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(side * .46, 1.75, 0); body.add(arm); arms.push(arm);
    const sleeve = outlined(new THREE.CylinderGeometry(.17, .21, .55, 8), robe); sleeve.position.y = -.24; arm.add(sleeve);
    const forearm = outlined(new THREE.CapsuleGeometry(.11, .25, 3, 8), skin); forearm.position.y = -.63; arm.add(forearm);
    for (const y of [-.5, -.64]) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(.115, .115, .035, 8), ink); band.position.y = y; arm.add(band);
    }
    addCasterHand(arm, skin, 0, -.86, 0);
    arm.rotation.z = side * .2;
  }
  addCasterDetails(body, 'sukuna', palette);
  root.position.set(-2.65, .04, .8); root.rotation.y = .55; root.visible = false;
  return { root, animate(time: number, charge: number, domainPose = 0) {
    body.position.y = Math.sin(time * 1.2) * .01;
    arms.forEach((arm, i) => {
      arm.rotation.x = THREE.MathUtils.lerp(arm.rotation.x, THREE.MathUtils.lerp(-.1 - charge * 1.2, -1.3, domainPose), .08);
      arm.rotation.z = (i === 0 ? -1 : 1) * THREE.MathUtils.lerp(.2 + charge * .18, -.42, domainPose);
    });
  } };
}

export function createCurse(palette: Palette) {
  return createCurseActor(palette);
}
