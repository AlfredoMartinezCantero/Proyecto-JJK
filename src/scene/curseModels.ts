import * as THREE from 'three';
import type { CurseKey } from '../core/curses';

export type ModelPart = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z?: number, parent?: THREE.Group) => THREE.Mesh;

/** Original procedural interpretations, with distinct silhouettes; no imported anime assets. */
export function buildCurseModel(key: CurseKey, body: THREE.Group, append: ModelPart, material: (color: string) => THREE.Material, headParts: THREE.Group) {
  let owner = body;
  const add: ModelPart = (geometry, m, x, y, z = 0, parent = owner) => append(geometry, m, x, y, z, parent);
  const arms: THREE.Group[] = [], legs: THREE.Group[] = [];
  const skin = material(key === 'mahito' ? '#c9c1bd' : key === 'hanami' ? '#c7bda4' : key === 'jogo' ? '#a6a7a0' : '#b74440');
  const ink = material('#25212c'), cloth = material(key === 'mahito' ? '#374653' : key === 'jogo' ? '#90964e' : '#ece5cf');
  const sphere = (r: number, m: THREE.Material, x: number, y: number, z = 0, sx = 1, sy = 1, sz = 1, parent = owner) => {
    const mesh = add(new THREE.SphereGeometry(r, 16, 12), m, x, y, z, parent); mesh.scale.set(sx, sy, sz); return mesh;
  };
  const line = (points: number[][], radius: number, m: THREE.Material, parent = owner) => add(new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p as [number, number, number]))), 14, radius, 6, false), m, 0, 0, 0, parent);
  const torso = sphere(.43, key === 'mahito' || key === 'jogo' ? cloth : skin, 0, 1.3, 0, key === 'hanami' ? 1.18 : key === 'dagon' ? 1.3 : 1, 1.3, .78);
  torso.name = `${key} torso`;
  owner = headParts;
  const head = sphere(key === 'jogo' ? .34 : .3, skin, 0, 2.05, 0, key === 'dagon' ? 1.2 : 1, 1.16, 1);
  head.name = `${key} head`;
  owner = body;
  for (const side of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(side * .21, .78, 0); body.add(leg); legs.push(leg);
    add(new THREE.CapsuleGeometry(.13, .48, 4, 10), key === 'mahito' || key === 'hanami' ? ink : skin, 0, -.27, 0, leg);
    add(new THREE.BoxGeometry(.25, .14, .38), ink, 0, -.65, .06, leg);
    const arm = new THREE.Group(); arm.position.set(side * (key === 'hanami' || key === 'dagon' ? .5 : .38), 1.68, 0); body.add(arm); arms.push(arm);
    add(new THREE.CapsuleGeometry(.12, .25, 4, 10), skin, side * .09, -.18, 0, arm).rotation.z = side * .25;
    add(new THREE.CapsuleGeometry(.10, .28, 4, 10), skin, side * .17, -.53, .025, arm);
    sphere(.105, skin, side * .18, -.78, .03, 1, 1.25, .65, arm);
    for (let i = 0; i < 4; i++) add(new THREE.CapsuleGeometry(.025, .13, 3, 5), skin, side * .18 + (i - 1.5) * .045, -.92, .045, arm);
    if (key !== 'jogo') {
      sphere(.047, key === 'mahito' ? material(side < 0 ? '#83b8c4' : '#a29b6c') : ink, side * .115, 2.1, .278, 1.3, .65, .45, headParts);
    }
  }
  if (key === 'mahito') {
    owner = headParts;
    const hair = material('#8497a5');
    sphere(.31, hair, 0, 2.23, -.015, 1, .7, 1);
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * Math.PI * 2, x = Math.cos(a) * .26, z = Math.sin(a) * .26;
      line([[x, 2.28, z], [x * 1.15, 2.04, z * 1.15], [x * 1.08, 1.78 - i % 3 * .06, z * 1.1]], .035 + i % 2 * .007, hair);
    }
    for (const y of [1.9, 2.18]) {
      line([[-.23, y, .19], [0, y - .03, .304], [.23, y + .015, .19]], .008, ink);
      for (let i = -3; i <= 3; i++) add(new THREE.BoxGeometry(.008, .046, .012), ink, i * .055, y - .025, .292);
    }
    line([[.02, 2.31, .25], [.04, 2.05, .3], [.07, 1.86, .21]], .008, ink);
    for (let i = 0; i < 6; i++) add(new THREE.BoxGeometry(.04, .008, .012), ink, .04, 1.93 + i * .055, .3);
    owner = body;
    add(new THREE.BoxGeometry(.25, .35, .04), material('#a5aaa8'), -.13, 1.36, .33).rotation.z = -.15;
    line([[-.32, 1.12, .22], [0, 1.04, .34], [.31, 1.11, .22]], .013, ink);
  } else if (key === 'hanami') {
    const bark = material('#53534a');
    for (const side of [-1, 1]) {
      line([[side * .12, 2.13, .23], [side * .23, 2.36, .14], [side * .34, 2.66, .08]], .055, bark, headParts);
      line([[side * .23, 2.36, .14], [side * .48, 2.47, .04], [side * .61, 2.57, -.02]], .028, bark, headParts);
      for (let i = 0; i < 4; i++) line([[side * .13, 1.7 - i * .16, .32], [side * .28, 1.61 - i * .16, .33], [side * .32, 1.49 - i * .16, .23]], .015, bark);
    }
    const wrap = add(new THREE.CapsuleGeometry(.19, .62, 4, 12), cloth, 0, -.42, .02, arms[0]); wrap.rotation.z = -.1;
    for (let i = 0; i < 7; i++) add(new THREE.TorusGeometry(.192, .012, 5, 18), material('#b3ad9c'), 0, -.13 - i * .09, .02, arms[0]).rotation.x = Math.PI / 2;
    for (let i = 0; i < 7; i++) { const a = i * Math.PI * 2 / 7;
      const petal = sphere(.12, material('#904957'), .45 + Math.cos(a) * .11, 1.7 + Math.sin(a) * .11, .16, .55, 1.3, .4); petal.rotation.z = -a;
    }
    sphere(.085, material('#b08d45'), .45, 1.7, .22);
  } else if (key === 'jogo') {
    owner = headParts;
    const rock = material('#70574c'), lava = material('#e56e32');
    add(new THREE.CylinderGeometry(.22, .30, .36, 20, 1, true), rock, 0, 2.38, 0);
    add(new THREE.TorusGeometry(.22, .045, 8, 24), rock, 0, 2.56, 0).rotation.x = Math.PI / 2;
    add(new THREE.CircleGeometry(.19, 24), material('#241619'), 0, 2.48, 0).rotation.x = -Math.PI / 2;
    add(new THREE.TorusGeometry(.105, .025, 6, 24), ink, 0, 2.12, .303);
    sphere(.085, material('#e7d5a0'), 0, 2.12, .32, 1, 1, .3);
    sphere(.038, material('#191318'), 0, 2.12, .348, 1, 1, .25);
    for (const side of [-1, 1]) sphere(.11, rock, side * .33, 2.08, 0, .6, 1, 1);
    sphere(.105, ink, 0, 1.94, .285, 1.5, .35, .25);
    for (let i = 0; i < 6; i++) add(new THREE.ConeGeometry(.018, .04, 4), material('#d9c8a0'), (i - 2.5) * .035, 1.94, .32).rotation.z = Math.PI;
    owner = body;
    const collar = add(new THREE.TorusGeometry(.29, .115, 8, 24), cloth, 0, 1.83, 0); collar.rotation.x = Math.PI / 2;
    for (let i = 0; i < 12; i++) { const a = i * 2.39996;
      sphere(.055 + i % 2 * .02, ink, Math.cos(a) * .39, 1.1 + i % 4 * .16, Math.sin(a) * .27, 1, 1.2, .4);
    }
    for (let i = 0; i < 5; i++) line([[Math.cos(i) * .23, 2.3, Math.sin(i) * .23], [Math.cos(i) * .2, 2.43, Math.sin(i) * .2]], .008, lava, headParts);
  } else {
    owner = headParts;
    const fin = material('#d07562'), deep = material('#713140');
    for (let i = 0; i < 6; i++) {
      const x = (i - 2.5) * .075;
      line([[x, 2.02, .24], [x * 1.4, 1.78, .38], [x * 1.7, 1.51 + i % 2 * .08, .34]], .04, skin);
      for (let j = 0; j < 3; j++) sphere(.014, material('#e7b5a0'), x * (1.1 + j * .2), 1.91 - j * .11, .403, 1, 1, .4);
    }
    owner = body;
    for (const side of [-1, 1]) {
      const crest = add(new THREE.ConeGeometry(.22, .48, 5), fin, side * .34, 2.19, -.02, headParts); crest.scale.z = .25; crest.rotation.z = -side * .8;
      const shoulder = sphere(.25, deep, side * .48, 1.64, -.06, 1.3, .6, 1);
      shoulder.rotation.z = side * .3;
      for (let i = 0; i < 5; i++) sphere(.09, fin, side * (.15 + i % 2 * .16), 1.17 + i * .09, .3, 1.15, .6, .35);
    }
    line([[0, .95, -.28], [0, .65, -.53], [.15, .49, -.73]], .1, skin);
  }
  return { head, arms, legs };
}
