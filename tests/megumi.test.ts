import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import catalog from '../src/config/megumi.json';
import { CHARACTERS, MEGUMI_KEYS, TECHNIQUES, validateCatalog } from '../src/core/techniques';
import { evaluatePose } from '../src/core/gesture';
import { TechniqueRecognizer, type TechniqueResult } from '../src/core/TechniqueRecognizer';
import type { TechniqueKey, TrackedHand } from '../src/core/types';
import { handFrame, poseHand, trackedPose } from './fixtures';
import { combatTimeline, persistentTargetTimeline } from '../src/scene/combatTimeline';
import { MEGUMI_CONTACT, DOG_SECOND_HIT_MS } from '../src/scene/megumiTimeline';
import { createCurseActor, CURSE_CENTER } from '../src/scene/CurseActor';
import { CURSES, type CurseKey } from '../src/core/curses';
import { makePalette } from '../src/scene/materials';
import { createMegumi } from '../src/scene/Megumi';
import { createDivineDog, createNue } from '../src/scene/shadowShikigami';
import { MegumiEffects } from '../src/scene/MegumiEffects';
import { HandRig } from '../src/scene/HandRig';

const closePair = (pose: 'wolf' | 'open' = 'wolf') => [trackedPose(pose,.435,1),trackedPose(pose,.565,2)];
const widePair = () => [trackedPose('open',.27,1),trackedPose('open',.73,2)];
function practice(key: TechniqueKey = 'divine-dogs') {
  const recognizer = new TechniqueRecognizer(TECHNIQUES[key]); let time = -50, fires = 0, last: TechniqueResult;
  const frame = (hands: TrackedHand[],gap = 50) => { time += gap; last = recognizer.update(handFrame(time,hands)); if(last.fire)fires++; return last; };
  const hold = (hands: TrackedHand[],ms: number) => { for(let i=0;i<=ms/50;i++)frame(hands); };
  return {recognizer,frame,hold,get fires(){return fires;},get last(){return last;},get time(){return time;}};
}
describe('Megumi bimanual summons (synthetic camera landmarks)', () => {
  it('validates all eight lessons and keeps the shadow sign distinct from other finger templates', () => {
    expect(validateCatalog(catalog,MEGUMI_KEYS,'megumi').map(t=>t.key)).toEqual(['divine-dogs','nue','totality','toad','max-elephant','rabbit-escape','mahoraga','chimera-garden']);
    expect(CHARACTERS.megumi.techniques.every(t=>t.handCount===2)).toBe(true);
    expect(evaluatePose(poseHand('wolf'),960,720,'wolf').valid).toBe(true);
    expect(evaluatePose(poseHand('wolf').map(p=>({...p,x:1-p.x})),960,720,'wolf','detailed').valid).toBe(true);
    for(const pose of ['blue','open','fist','red'] as const) expect(evaluatePose(poseHand(pose),960,720,'wolf').valid).toBe(false);
  });
  it('requires both complete hands and sustained valid observations, not an isolated sign', () => {
    const h=practice(); h.frame(closePair()); expect(h.fires).toBe(0);
    h.hold(closePair().slice(0,1),1800); expect(h.fires).toBe(0);
    h.hold(closePair(),1200); expect(h.fires).toBe(1);
  });
  it('retains tracked roles when detection order changes and fires once until both hands open', () => {
    const h=practice(); for(let i=0;i<30;i++)h.frame(i%2?closePair():closePair().reverse());
    expect(h.fires).toBe(1); h.hold(closePair(),5300); expect(h.fires).toBe(1);
    h.hold([trackedPose('open',.435,1),trackedPose('wolf',.565,2)],700); expect(h.last.phase).toBe('release');
    h.hold(closePair('open'),700); expect(h.last.phase).toBe('ready');
  });
  it('rejects palms too far apart, superposed hands and a wrong finger shape', () => {
    for(const pair of [[trackedPose('wolf',.27,1),trackedPose('wolf',.73,2)],
      [trackedPose('wolf',.48,1),trackedPose('wolf',.52,2)],closePair('open')]) {
      const h=practice(); h.hold(pair,1500); expect(h.fires).toBe(0);
    }
  });
  it('requires the near-open preparation before spreading Nue wings and only then activates', () => {
    const h=practice('nue'); h.hold(widePair(),1800); expect(h.recognizer.currentStep).toBe(0);
    h.hold(closePair('open'),700); expect(h.recognizer.currentStep).toBe(1); expect(h.fires).toBe(0);
    h.hold(closePair('open'),1100); expect(h.fires).toBe(0);
    h.hold(widePair(),1000); expect(h.fires).toBe(1);
  });
  it('requires the same original pair throughout Nue and cancels a missing hand', () => {
    const h=practice('nue'); h.hold(closePair('open'),700);
    h.hold([trackedPose('open',.27,1),trackedPose('open',.73,3)],1100); expect(h.fires).toBe(0);
    const missing=practice('nue'); missing.hold(closePair('open'),700); missing.hold([],350);
    expect(missing.recognizer.currentStep).toBe(0); missing.hold(widePair(),1200); expect(missing.fires).toBe(0);
  });
  it('checks raw and filtered positions and both finger shapes independently', () => {
    const h=practice('nue'); h.hold(closePair('open'),700);
    const wrong=widePair().map((hand,i)=>({...hand,landmarks:closePair('open')[i].landmarks}));
    h.hold(wrong,1100); expect(h.fires).toBe(0); expect(h.last.span).toBeLessThan(3); expect(h.last.spanRaw).toBeGreaterThan(3);
    h.hold(widePair(),1000); expect(h.fires).toBe(1);
    const dogs=practice(); dogs.hold(closePair().map(h=>({...h,raw:poseHand('open',h.raw[0].x)})),1400); expect(dogs.fires).toBe(0);
  });
  it('rejects excessive vertical separation and resets on pause or a ten-second phase timeout', () => {
    const h=practice(), pair=closePair(); const points=pair[1].raw.map(p=>({...p,y:p.y-.16}));
    h.hold([pair[0],{...pair[1],raw:points,landmarks:points}],1400); expect(h.fires).toBe(0);
    const paused=practice('nue'); paused.hold(closePair('open'),700); paused.recognizer.interrupt(); paused.hold(widePair(),1100); expect(paused.fires).toBe(0);
    const timeout=practice('nue'); timeout.hold(closePair('open'),700); timeout.hold(closePair('open'),10100);
    timeout.hold(widePair(),1100); expect(timeout.fires).toBe(0);
  });
  it('never accumulates stale captures or makes an absent pair count as release', () => {
    const h=practice(); h.hold(closePair(),700);
    for(let i=0;i<30;i++) { const result=h.recognizer.update({...handFrame(h.time,closePair()),receivedAt:h.time+500+i*50}); expect(result.fire).toBe(false); }
    const fired=practice(); fired.hold(closePair(),1200); fired.hold([],6000); expect(fired.fires).toBe(1); expect(fired.last.phase).not.toBe('ready');
  });
});

describe('Megumi models, summon choreography and target reactions (CPU)', () => {
  it('builds an identifiable caster, two articulated wolves and a feathered bird with moving wings', () => {
    const palette=makePalette(), actor=createMegumi(palette), white=createDivineDog(palette,true),black=createDivineDog(palette,false),bird=createNue(palette);
    expect(actor.root.getObjectsByProperty('name','Megumi hair spike')).toHaveLength(20);
    expect(actor.root.getObjectByName('Megumi high collar')).toBeDefined(); expect(white.root.name).not.toBe(black.root.name);
    expect(bird.root.getObjectByName('Nue left wing')).toBeDefined(); expect(bird.root.getObjectByName('Nue right wing')).toBeDefined();
    const first=bird.root.getObjectByName('Nue left wing')!; bird.animate(1,0); const before=first.rotation.z; bird.animate(1.3,0); expect(first.rotation.z).not.toBe(before);
    for(const object of [actor,white,black,bird])object.root.traverse(o=>expect([...o.position.toArray(),...o.scale.toArray(),...o.quaternion.toArray()].every(Number.isFinite)).toBe(true));
    actor.animate(1,1,combatTimeline('nue',800,4500)); expect(actor.root.getObjectsByProperty('name','Megumi open hand').every(o=>o.visible)).toBe(true);
  });
  it('provides Megumi with an entire own hand anatomy and natural nails', () => {
    const rig=new HandRig('megumi'); expect(rig.mesh.geometry.userData.character).toBe('megumi');
    expect(rig.mesh.getObjectByName('Sukuna wrist markings')!.visible).toBe(false);
    expect(rig.mesh.getObjectByName('Gojo natural nails')!.visible).toBe(true);
  });
  for(const key of Object.keys(CURSES) as CurseKey[]) it(`${key}: first dog bite recoils, second tears the body, remains fragmented until respawn`, () => {
    const actor=createCurseActor(makePalette(),key),body=actor.root.children[0],contact=MEGUMI_CONTACT['divine-dogs'];
    actor.animate(1,combatTimeline('divine-dogs',contact-1,4600),CURSE_CENTER); expect(body.visible).toBe(true); expect(actor.uniforms.cuts.value).toBe(0);
    actor.animate(1,combatTimeline('divine-dogs',contact+100,4600),CURSE_CENTER); expect(body.visible).toBe(true); expect(actor.uniforms.cuts.value).toBeGreaterThan(0);
    actor.animate(2,combatTimeline('divine-dogs',contact+DOG_SECOND_HIT_MS,4600),CURSE_CENTER); expect(body.visible).toBe(false);
    actor.animate(30,persistentTargetTimeline('divine-dogs',30000,4600),CURSE_CENTER); expect(body.visible).toBe(false);
    actor.reset(); expect(body.visible).toBe(true); expect(actor.uniforms.cuts.value).toBe(0);
  });
  for(const key of Object.keys(CURSES) as CurseKey[]) it(`${key}: Nue shocks, darkens and knocks down the body while harmless preview leaves it intact`, () => {
    const actor=createCurseActor(makePalette(),key),body=actor.root.children[0],contact=MEGUMI_CONTACT.nue;
    actor.animate(1,combatTimeline('nue',contact-1,4500),CURSE_CENTER); expect(actor.uniforms.burn.value).toBe(0);
    actor.animate(1,combatTimeline('nue',contact+50,4500),CURSE_CENTER); expect(actor.uniforms.stun.value).toBeGreaterThan(.5);
    actor.animate(30,persistentTargetTimeline('nue',30000,4500),CURSE_CENTER); expect(body.rotation.x).toBeGreaterThan(1.4); expect(actor.uniforms.burn.value).toBeGreaterThan(.5);
    actor.reset(); actor.animate(1,combatTimeline('nue',3000,4500,true),CURSE_CENTER); expect(body.rotation.x).toBe(0); expect(actor.uniforms.burn.value).toBe(0);
  });
  it('places charging energy between both observed hands and hides it with missing tracking', () => {
    const scene=new THREE.Scene(),effects=new MegumiEffects(scene,new THREE.PerspectiveCamera());
    effects.setPalms(new THREE.Vector3(1,2,3),new THREE.Vector3(3,4,5)); effects.setCharge(.7); effects.update(100);
    expect(effects.root.getObjectByName('Observed hands shadow seed')!.position.toArray()).toEqual([2,3,4]);
    effects.setPalms(null,null); effects.update(150); expect(effects.root.visible).toBe(false);
  });
  it('times creature emergence, both dog bites, Nue electricity and final disappearance without reallocating', () => {
    const effects=new MegumiEffects(new THREE.Scene(),new THREE.PerspectiveCamera()); const objects:THREE.Object3D[]=[];effects.root.traverse(o=>objects.push(o));
    for(let repeat=0;repeat<3;repeat++)for(const key of MEGUMI_KEYS) {
      effects.setTechnique(key); effects.activate(0,false);
      for(const now of [0,650,1000,1350,1600,1750,2500,4000]) {
        effects.update(now); effects.root.traverse(o=>{
          expect([...o.position.toArray(),...o.scale.toArray(),...o.quaternion.toArray()].every(Number.isFinite)).toBe(true);
          if(o instanceof THREE.InstancedMesh)expect(Array.from(o.instanceMatrix.array).every(Number.isFinite)).toBe(true);
        });
        const electricity=effects.root.getObjectByName('Nue contact lightning')!;
        expect(electricity.visible).toBe(key==='nue'&&now>=1600&&now<2250);
      }
      effects.update(TECHNIQUES[key].effectMs); expect(effects.root.visible).toBe(false);
    }
    const after:THREE.Object3D[]=[];effects.root.traverse(o=>after.push(o));expect(after).toEqual(objects);
  });
  it('honors intensity zero, reduced effects, lightweight particle budget and explicit clearing', () => {
    const effects=new MegumiEffects(new THREE.Scene(),new THREE.PerspectiveCamera());
    effects.setSettings(.5,true,'low'); effects.setTechnique('nue'); effects.activate(0,false);effects.update(1700);
    expect((effects.root.getObjectByName('Shikigami emergence mist') as THREE.Points).geometry.drawRange.count).toBe(160);
    effects.setSettings(0,true);effects.update(1800);expect(effects.root.visible).toBe(false);
    effects.clear();expect(effects.root.visible).toBe(false);
  });
});
