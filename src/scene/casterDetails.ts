import * as THREE from 'three';
import type { makePalette } from './materials';

export function addCasterHand(parent: THREE.Group, skin: THREE.Material, x: number, y: number, z: number) {
  const root = new THREE.Group(); root.name = 'Articulated caster hand'; root.position.set(x, y, z); parent.add(root);
  const palm = new THREE.Mesh(new THREE.SphereGeometry(.1, 12, 8), skin); palm.scale.set(.8, 1.1, .5); root.add(palm);
  for (let i = 0; i < 4; i++) {
    const finger = new THREE.Mesh(new THREE.CapsuleGeometry(.022, .085 + (i === 1 ? .025 : 0), 3, 6), skin);
    finger.position.set((i - 1.5) * .04, -.12 - (i === 1 ? .01 : 0), .015); finger.rotation.x = -.15; root.add(finger);
  }
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(.025, .07, 3, 6), skin); thumb.position.set(-.095, -.015, .03); thumb.rotation.z = -.7; root.add(thumb);
  return root;
}

export function addCasterDetails(body: THREE.Group, kind: 'gojo' | 'sukuna', palette: ReturnType<typeof makePalette>) {
  const skin = palette.toon(kind === 'gojo' ? '#efd4bc' : '#ddae9a'), ink = palette.toon('#241d2c');
  const part = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(g, m); mesh.position.set(x, y, z); mesh.castShadow = true; body.add(mesh); return mesh;
  };
  for (const side of [-1, 1]) {
    const ear = part(new THREE.SphereGeometry(.062, 12, 8), skin, side * .276, 2.16, 0); ear.scale.set(.48, 1, .7);
    const seam = part(new THREE.BoxGeometry(.018, .72, .018), palette.toon(kind === 'gojo' ? '#354258' : '#aa9386'), side * .26, 1.39, .26); seam.rotation.z = side * .13;
    for (let i = 0; i < 3; i++) {
      const fold = part(new THREE.BoxGeometry(.12, .012, .018), palette.toon(kind === 'gojo' ? '#303a51' : '#bfb09c'), side * .19, 1.18 + i * .13, .31);
      fold.rotation.z = side * -.22;
    }
  }
  const nose = part(new THREE.ConeGeometry(.034, .085, 6), skin, 0, 2.12, .276); nose.rotation.x = Math.PI / 2;
  const mouth = part(new THREE.BoxGeometry(.095, .012, .016), ink, 0, 2.035, .25); mouth.rotation.z = kind === 'sukuna' ? -.08 : .02;
  if (kind === 'gojo') {
    for (const y of [1.28, 1.49, 1.7]) part(new THREE.SphereGeometry(.022, 8, 6), palette.toon('#b2b7bd'), .1, y, .365);
    part(new THREE.BoxGeometry(.018, .68, .022), palette.toon('#0e1524'), .065, 1.5, .34);
    const tie = part(new THREE.BoxGeometry(.28, .065, .05), ink, -.04, 2.21, -.27); tie.rotation.z = -.15;
  } else {
    const forehead = part(new THREE.ConeGeometry(.045, .13, 3), ink, 0, 2.3, .272); forehead.rotation.z = Math.PI;
    for (const side of [-1, 1]) {
      for (let i = 0; i < 2; i++) {
        const mark = part(new THREE.BoxGeometry(.10, .016, .02), ink, side * .17, 2.04 - i * .05, .24); mark.rotation.z = side * -.35;
      }
      const eye = part(new THREE.SphereGeometry(.032, 10, 6), palette.toon('#f29683'), side * .15, 2.08, .256); eye.scale.set(1.3, .4, .35);
    }
    part(new THREE.BoxGeometry(.12, .13, .045), palette.toon('#6f2332'), 0, 1.015, .415);
  }
}
