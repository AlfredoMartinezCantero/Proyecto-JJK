import * as THREE from 'three';
import { makePalette, outlined } from './materials';
import type { CombatState } from './combatTimeline';
import { smooth01 } from './combatTimeline';
import { isYujiTechnique } from './yujiTimeline';

/** Original procedural interpretation of Yuji's Shibuya uniform. */
export function createYuji(palette: ReturnType<typeof makePalette>) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body); root.name = 'Yuji Itadori';
  const navy = palette.toon('#222c42'), red = palette.toon('#a62b3e'), skin = palette.toon('#e7b99d');
  const hair = palette.toon('#d99394'), hairShade = palette.toon('#76555c'), ink = palette.toon('#27202a');
  const add = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, parent = body, name = '') => {
    const mesh = outlined(g, m); mesh.position.set(x,y,z); mesh.name = name; parent.add(mesh); return mesh;
  };
  for (const side of [-1,1]) {
    const leg = add(new THREE.CapsuleGeometry(.145,.66,5,12), navy, side*.21,.61,0); leg.rotation.z = side*.07;
    add(new THREE.CapsuleGeometry(.14,.16,4,12).rotateZ(Math.PI/2), red, side*.24,.12,.14, body, 'Yuji red shoe');
    add(new THREE.BoxGeometry(.30,.055,.42), ink, side*.24,.035,.11);
    add(new THREE.BoxGeometry(.12,.02,.16), palette.toon('#d75b64'), side*.24,.20,.23);
  }
  const torso = add(new THREE.LatheGeometry([[.28,-.43],[.32,-.33],[.30,-.09],[.37,.19],[.39,.32],[.25,.44]]
    .map(([x,y]) => new THREE.Vector2(x,y)),28), navy,0,1.39,0, body, 'Yuji uniform'); torso.scale.z = .77;
  const hood = add(new THREE.TorusGeometry(.245,.105,10,28),red,0,1.88,-.02,body,'Yuji red hood'); hood.rotation.x = Math.PI/2;
  add(new THREE.SphereGeometry(.265,20,12),red,0,1.75,-.20).scale.set(1,.85,.5);
  const lapel = add(new THREE.BoxGeometry(.11,.50,.045),red,.15,1.61,.265); lapel.rotation.z = -.14;
  for (const y of [1.48,1.69]) add(new THREE.SphereGeometry(.022,10,8),palette.toon('#d8ae6b'),.20,y,.30);
  add(new THREE.CylinderGeometry(.115,.135,.24,16),skin,0,1.98,0);
  const head = add(new THREE.SphereGeometry(.276,24,18),skin,0,2.18,.015,body,'Yuji head'); head.scale.set(.97,1.06,.94);
  add(new THREE.SphereGeometry(.282,20,12,0,Math.PI*2,0,Math.PI*.54),hairShade,0,2.28,0);
  add(new THREE.SphereGeometry(.286,20,12,0,Math.PI*2,0,Math.PI*.55),hair,0,2.30,0);
  for (let i = 0; i < 7; i++) {
    const tuft = add(new THREE.ConeGeometry(.042,.13+(i%3)*.018,5,2),hair,(i-3)*.064,2.30,.245-Math.abs(i-3)*.012);
    tuft.rotation.set(.18,0,Math.PI+(i-3)*.10);
  }
  for (let i = 0; i < 24; i++) {
    const angle = i*2.39996, radius = i < 14 ? .22 : .11;
    const spike = add(new THREE.ConeGeometry(.073,.16+(i%4)*.025,7,3),hair,Math.cos(angle)*radius,2.45+(i>=14?.055:0),Math.sin(angle)*radius);
    spike.rotation.set(Math.sin(angle)*.55,angle,-Math.cos(angle)*.55);
  }
  for (const side of [-1,1]) {
    add(new THREE.SphereGeometry(.058,14,10),skin,side*.274,2.17,.01).scale.set(.45,1,.7);
    add(new THREE.SphereGeometry(.054,12,10),palette.toon('#f7efdf'),side*.105,2.19,.246).scale.set(1,.52,.24);
    add(new THREE.SphereGeometry(.027,10,8),palette.toon('#735b4c'),side*.105,2.19,.26).scale.set(.7,1,.3);
    add(new THREE.SphereGeometry(.013,10,8),ink,side*.105,2.19,.268).scale.set(.7,1,.2);
    const brow = add(new THREE.BoxGeometry(.115,.02,.015),hairShade,side*.11,2.255,.245); brow.rotation.z = -side*.10;
    const seam = add(new THREE.BoxGeometry(.013,.53,.015),palette.toon('#39435a'),side*.25,1.35,.24); seam.rotation.z = side*.08;
  }
  const nose = add(new THREE.ConeGeometry(.028,.075,7),skin,0,2.13,.27); nose.rotation.x = Math.PI/2;
  add(new THREE.BoxGeometry(.085,.012,.014),ink,0,2.06,.25);
  const arms: { shoulder: THREE.Group; elbow: THREE.Group }[] = [];
  for (const side of [-1,1]) {
    const shoulder = new THREE.Group(); shoulder.position.set(side*.39,1.74,0); body.add(shoulder);
    const elbow = new THREE.Group(); elbow.position.y = -.38; shoulder.add(elbow); arms.push({ shoulder, elbow });
    add(new THREE.CapsuleGeometry(.125,.22,5,12),navy,0,-.18,0,shoulder);
    add(new THREE.CapsuleGeometry(.105,.20,5,12),navy,0,-.16,0,elbow);
    add(new THREE.CylinderGeometry(.108,.11,.075,16),red,0,-.32,0,elbow);
    const fist = new THREE.Group(); fist.name = 'Yuji closed fist'; fist.position.set(0,-.43,.015); elbow.add(fist);
    add(new THREE.SphereGeometry(.105,16,12),skin,0,0,0,fist).scale.set(1,1.04,.73);
    for (let j = 0; j < 4; j++) {
      add(new THREE.CapsuleGeometry(.027,.07,4,8),skin,(j-1.5)*.045,-.025,.066,fist).rotation.x = 1.3;
      add(new THREE.SphereGeometry(.026,10,8),skin,(j-1.5)*.045,-.075,.052,fist);
    }
    const thumb = add(new THREE.CapsuleGeometry(.033,.09,4,10),skin,side*.065,-.012,.09,fist); thumb.rotation.z = side*.7;
  }
  const base = new THREE.Vector3(-2.65,.04,.8), end = new THREE.Vector3(1.02,.04,-1.18);
  root.position.copy(base); root.rotation.y = .55; root.visible = false;
  return { root, animate(time: number, charge: number, combat?: CombatState) {
    const attacking = !!combat?.active && isYujiTechnique(combat.key);
    const elapsed = attacking ? combat!.elapsed : -1, contact = combat?.contactMs ?? 620;
    const dash = attacking ? smooth01(elapsed/contact)*(1-smooth01((elapsed-1250)/850)) : 0;
    const strike = attacking ? smooth01((elapsed-contact+210)/210)*(1-smooth01((elapsed-contact-140)/380)) : 0;
    root.position.copy(base).lerp(end,dash); root.rotation.y = THREE.MathUtils.lerp(.55,1.7,dash);
    body.position.y = Math.sin(time*2)*.012*(1-dash); body.rotation.x = dash*.16; body.rotation.y = strike*-.22;
    arms.forEach(({ shoulder, elbow }, i) => {
      const punching = i === 1 ? strike : 0;
      shoulder.rotation.set(-.48-charge*.28-punching*1.0,0,(i?1:-1)*(.27+charge*.12));
      elbow.rotation.x = -1.15 + punching*1.05;
    });
  } };
}
