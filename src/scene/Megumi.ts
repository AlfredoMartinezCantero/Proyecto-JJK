import * as THREE from 'three';
import { makePalette, outlined } from './materials';
import type { CombatState } from './combatTimeline';
import { TECHNIQUES } from '../core/techniques';
import { isShadowPose, SHADOW_SIGNS } from '../core/shadowConfig';
import { isMegumiTechnique } from './megumiTimeline';

/** Original procedural caster; the tracked player hands remain a separate real-input rig. */
export function createMegumi(palette: ReturnType<typeof makePalette>) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body); root.name = 'Megumi Fushiguro';
  const navy = palette.toon('#1d293e'), trim = palette.toon('#303d55'), skin = palette.toon('#e5c7b7');
  const hair = palette.toon('#15202a'), ink = palette.toon('#101622'), gold = palette.toon('#ad9770');
  const add = (g: THREE.BufferGeometry,m: THREE.Material,x: number,y: number,z: number,parent = body,name = '') => {
    const mesh = outlined(g,m); mesh.position.set(x,y,z); mesh.name = name; parent.add(mesh); return mesh;
  };
  for (const side of [-1,1]) {
    add(new THREE.CapsuleGeometry(.13,.74,5,12),navy,side*.20,.61,0);
    add(new THREE.BoxGeometry(.27,.16,.43),ink,side*.21,.10,.09);
    add(new THREE.BoxGeometry(.28,.035,.44),trim,side*.21,.035,.09);
  }
  const torso = add(new THREE.LatheGeometry([[.27,-.43],[.30,-.30],[.29,-.03],[.35,.25],[.36,.34],[.23,.43]]
    .map(([x,y]) => new THREE.Vector2(x,y)),28),navy,0,1.39,0,body,'Megumi uniform'); torso.scale.z = .78;
  add(new THREE.CylinderGeometry(.225,.25,.25,24),navy,0,1.90,-.005,body,'Megumi high collar');
  for (const y of [1.39,1.62,1.87]) add(new THREE.SphereGeometry(.021,10,8),gold,.12,y,.30);
  add(new THREE.BoxGeometry(.012,.56,.014),trim,.12,1.54,.29);
  const head = add(new THREE.SphereGeometry(.27,24,18),skin,0,2.18,0,body,'Megumi head'); head.scale.set(.96,1.07,.96);
  add(new THREE.SphereGeometry(.278,24,16,0,Math.PI*2,0,Math.PI*.56),hair,0,2.27,-.015);
  for (let i = 0; i < 20; i++) {
    const a = i*2.39996, ring = i < 13, radius = ring ? .22 : .10;
    const spike = add(new THREE.ConeGeometry(ring?.095:.08,.29+(i%4)*.035,5,3),hair,
      Math.cos(a)*radius,2.44+(ring?0:.11),Math.sin(a)*radius-.015,body,'Megumi hair spike');
    spike.rotation.set(Math.sin(a)*(ring?.95:.35),a,-Math.cos(a)*(ring?.95:.35));
  }
  for (let i = 0; i < 5; i++) {
    const fringe = add(new THREE.ConeGeometry(.055,.22,5),hair,(i-2)*.082,2.32,.24-Math.abs(i-2)*.016);
    fringe.rotation.set(.1,0,Math.PI+(i-2)*.18);
  }
  for (const side of [-1,1]) {
    add(new THREE.SphereGeometry(.057,14,10),skin,side*.267,2.17,0).scale.set(.5,1,.7);
    add(new THREE.SphereGeometry(.052,14,10),palette.toon('#e8eee9'),side*.105,2.19,.246).scale.set(1.1,.43,.23);
    add(new THREE.SphereGeometry(.026,12,8),palette.toon('#49716c'),side*.105,2.19,.258).scale.set(.72,.9,.27);
    add(new THREE.SphereGeometry(.013,10,8),ink,side*.105,2.19,.265).scale.z = .25;
    const brow = add(new THREE.BoxGeometry(.12,.021,.014),hair,side*.11,2.254,.242); brow.rotation.z = side*.18;
    const seam = add(new THREE.BoxGeometry(.012,.51,.014),trim,side*.23,1.34,.23); seam.rotation.z = side*.09;
  }
  const nose = add(new THREE.ConeGeometry(.027,.075,7),skin,0,2.12,.267); nose.rotation.x = Math.PI/2;
  add(new THREE.BoxGeometry(.082,.012,.014),ink,0,2.06,.245);
  const arms: { shoulder: THREE.Group; elbow: THREE.Group; hands: Record<string,THREE.Group> }[] = [];
  for (const side of [-1,1]) {
    const shoulder = new THREE.Group(), elbow = new THREE.Group(); shoulder.position.set(side*.38,1.75,0); body.add(shoulder);
    elbow.position.y = -.39; shoulder.add(elbow);
    add(new THREE.CapsuleGeometry(.12,.24,5,12),navy,0,-.19,0,shoulder);
    add(new THREE.CapsuleGeometry(.10,.23,5,12),navy,0,-.17,0,elbow);
    add(new THREE.CylinderGeometry(.105,.11,.055,16),trim,0,-.34,0,elbow);
    const hand = (pose:'wolf'|'palm'|'fist'|'blue') => {
      const group = new THREE.Group(); group.name = pose==='wolf'?'Megumi shadow-sign hand':pose==='palm'?'Megumi open hand':pose==='fist'?'Megumi closed hand':'Megumi two-finger hand'; group.position.set(0,-.45,0); elbow.add(group);
      add(new THREE.SphereGeometry(.095,16,12),skin,0,0,0,group).scale.set(.82,1.1,.5);
      for (let finger = 0; finger < 4; finger++) {
        const extended = pose==='palm'||pose==='wolf'&&(finger===0||finger===3)||pose==='blue'&&finger<2;
        add(new THREE.CapsuleGeometry(.019,extended?.115:.055,4,8),skin,(finger-1.5)*.039,extended?-.135:-.075,extended?0:.04,group).rotation.x = extended?0:1.2;
      }
      const thumb = add(new THREE.CapsuleGeometry(.023,.075,4,8),skin,side*.075,-.01,.015,group); thumb.rotation.z = side*.7;
      return group;
    };
    arms.push({shoulder,elbow,hands:{wolf:hand('wolf'),palm:hand('palm'),fist:hand('fist'),blue:hand('blue')}});
  }
  root.position.set(-2.65,.04,.8); root.rotation.y = .55; root.visible = false;
  return { root, animate(time: number,charge: number,combat?: CombatState,step=0) {
    const invoking = combat?.active && isMegumiTechnique(combat.key) ? Math.max(0,1-combat.elapsed/(combat.key==='mahoraga'?3300:1900)) : 0;
    const raise = Math.max(charge,invoking), wings = combat?.key === 'nue';
    const technique=combat&&isMegumiTechnique(combat.key)?TECHNIQUES[combat.key]:TECHNIQUES['divine-dogs'];
    const pose=technique.steps[combat?.active?technique.steps.length-1:Math.min(step,technique.steps.length-1)].pose;
    const signs=isShadowPose(pose)?SHADOW_SIGNS[pose]:['wolf','wolf'];
    body.position.y = Math.sin(time*1.5)*.01;
    arms.forEach(({shoulder,elbow,hands},i) => {
      shoulder.rotation.set(-.15-raise*.85,0,(i?1:-1)*(.14+(wings?.32:-.08)*raise));
      elbow.rotation.x = -.25-raise*.9;Object.entries(hands).forEach(([sign,hand])=>{hand.visible=sign===signs[i];});
    });
  } };
}
