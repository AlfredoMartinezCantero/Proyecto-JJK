import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { TECHNIQUES } from '../src/core/techniques';
import { TechniqueRecognizer, type TechniqueResult } from '../src/core/TechniqueRecognizer';
import type { TrackedHand } from '../src/core/types';
import type { ShadowPose } from '../src/core/shadowConfig';
import { handFrame, shadowPair, trackedPose } from './fixtures';
import { combatTimeline, persistentTargetTimeline } from '../src/scene/combatTimeline';
import { ExpandedShadowEffects } from '../src/scene/ExpandedShadowEffects';
import { type ExpandedShadowKey, megumiContactTimes, MEGUMI_CONTACT } from '../src/scene/megumiTimeline';
import { createCurseActor, CURSE_CENTER } from '../src/scene/CurseActor';
import { CURSES, type CurseKey } from '../src/core/curses';
import { makePalette } from '../src/scene/materials';
import { createMahoraga, createTotality, createRabbitGeometry } from '../src/scene/expandedShikigami';
import { CombatAccents } from '../src/scene/CombatAccents';
import { ImpactLens } from '../src/scene/ImpactLens';

const keys:ExpandedShadowKey[]=['totality','toad','max-elephant','rabbit-escape','mahoraga','chimera-garden'];
function session(key:ExpandedShadowKey){
  const recognizer=new TechniqueRecognizer(TECHNIQUES[key]);let time=-50,fires=0,last:TechniqueResult;
  const frame=(hands:TrackedHand[])=>{time+=50;last=recognizer.update(handFrame(time,hands));if(last.fire)fires++;return last;};
  const hold=(hands:TrackedHand[],ms:number)=>{for(let i=0;i<=ms/50;i++)frame(hands);};
  return {recognizer,frame,hold,get fires(){return fires;},get last(){return last;},get time(){return time;}};
}
describe('six new Ten Shadows gestures (synthetic observations)',()=>{
  for(const key of keys)it(`${key}: completes only its sustained ordered sequence, fires once and requires both visible releases`,()=>{
    const h=session(key),t=TECHNIQUES[key];
    t.steps.forEach((step,index)=>{h.hold(shadowPair(step.pose as ShadowPose),step.holdMs);expect(h.fires).toBe(index===t.steps.length-1?1:0);});
    h.hold(shadowPair(t.steps.at(-1)!.pose as ShadowPose),t.timing.cooldownMs+100);expect(h.fires).toBe(1);
    h.hold([],900);expect(h.last.phase).not.toBe('ready');
    h.hold([trackedPose('open',.435,1)],700);expect(h.last.phase).not.toBe('ready');
    h.hold([trackedPose('open',.435,1),trackedPose('open',.565,2)],700);expect(['ready','holding']).toContain(h.last.phase);expect(h.last.stepIndex).toBe(0);expect(h.fires).toBe(1);
  });
  for(const key of keys)it(`${key}: rejects isolated frames, one hand and mismatched raw/filtered data`,()=>{
    const h=session(key),pair=shadowPair(TECHNIQUES[key].steps[0].pose as ShadowPose);h.frame(pair);expect(h.fires).toBe(0);
    h.hold(pair.slice(0,1),2500);expect(h.fires).toBe(0);
    h.hold(pair.map(hand=>({...hand,landmarks:[]})),2500);expect(h.fires).toBe(0);expect(h.last.usable).toBe(false);
  });
  it('accepts either original hand as the elephant trunk fist after the shared palm preparation',()=>{
    const h=session('max-elephant');h.hold(shadowPair('elephant-gather'),800);
    h.hold([trackedPose('open',.27,1),trackedPose('fist',.73,2)],1000);expect(h.fires).toBe(1);
  });
  for(const key of ['totality','max-elephant','chimera-garden'] as const)it(`${key}: final pose cannot bypass preparation or replace an original hand`,()=>{
    const h=session(key),t=TECHNIQUES[key],last=t.steps.at(-1)!;
    h.hold(shadowPair(last.pose as ShadowPose),2200);expect(h.fires).toBe(0);expect(h.recognizer.currentStep).toBe(0);
    h.hold(shadowPair(t.steps[0].pose as ShadowPose),t.steps[0].holdMs);
    const wrong=shadowPair(last.pose as ShadowPose).map((hand,i)=>({...hand,id:i===1?3:hand.id}));h.hold(wrong,2200);expect(h.fires).toBe(0);
  });
  it('pause cancels a domain preparation and stale frames never complete a ritual',()=>{
    const h=session('chimera-garden');h.hold(shadowPair('chimera-gather'),1700);h.recognizer.interrupt();h.hold(shadowPair('chimera-release'),1500);expect(h.fires).toBe(0);
    const ritual=session('mahoraga');ritual.hold(shadowPair('ritual'),1000);
    for(let i=0;i<40;i++)expect(ritual.recognizer.update({...handFrame(ritual.time,shadowPair('ritual')),receivedAt:ritual.time+500+i*50}).fire).toBe(false);
  });
});

describe('six presentations and pooled scene resources (CPU, no shaders rendered)',()=>{
  let effects:ExpandedShadowEffects;
  beforeAll(()=>{effects=new ExpandedShadowEffects(new THREE.Scene(),new THREE.PerspectiveCamera(42,16/9,.1,100));});
  it('has a bipedal clawed wolf, eight-handled wheel/sword and one shared colored rabbit geometry',()=>{
    const wolf=createTotality(makePalette()),general=createMahoraga(makePalette()),rabbit=createRabbitGeometry();
    expect(new THREE.Box3().setFromObject(wolf.root).max.y).toBeGreaterThan(2.5);
    expect(general.root.getObjectByName('Mahoraga Sword of Extermination')).toBeDefined();
    expect(general.wheel.children.filter(c=>c.name.startsWith('Mahoraga wheel spoke'))).toHaveLength(8);
    expect(rabbit.getAttribute('color').count).toBe(rabbit.getAttribute('position').count);rabbit.dispose();
  });
  for(const key of keys)it(`${key}: remains finite, uses existing buffers and ends cleanly`,()=>{
    effects.setTechnique(key);const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
    effects.root.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Points){geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));}});
    effects.activate(0,false);
    for(const elapsed of [0,800,1250,1850,2200,3300,4200,5800,TECHNIQUES[key].effectMs-1]){
      effects.update(elapsed);let finite=true;
      effects.root.traverse(o=>{finite&&=[...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray()].every(Number.isFinite);
        if(o instanceof THREE.InstancedMesh)finite&&=Array.from(o.instanceMatrix.array).every(Number.isFinite);
        if(o instanceof THREE.Mesh||o instanceof THREE.Points){expect(geometries.has(o.geometry)).toBe(true);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>expect(materials.has(m)).toBe(true));}
      });expect(finite).toBe(true);
    }
    effects.update(TECHNIQUES[key].effectMs);expect(effects.root.visible).toBe(false);expect(effects.domainMix).toBe(0);effects.clear();
  });
  it('moves the tongue coil with its captured target and maintains finite tube normals',()=>{
    effects.setTechnique('toad');effects.activate(0,false);effects.update(1350);
    const tongue=effects.root.getObjectByName('Sapo articulated capture tongue') as THREE.Mesh;expect(tongue.visible).toBe(true);
    tongue.geometry.computeBoundingBox();const first=tongue.geometry.boundingBox!.max.x;
    effects.update(2400);tongue.geometry.computeBoundingBox();expect(tongue.geometry.boundingBox!.max.x).toBeLessThan(first-1);
    expect(Array.from(tongue.geometry.getAttribute('normal').array).every(Number.isFinite)).toBe(true);
    effects.update(3200);expect(tongue.visible).toBe(false);
  });
  it('emits the water jet from the animated trunk and reduces rabbit/particle budgets at low quality',()=>{
    effects.setTechnique('max-elephant');effects.activate(0,false);effects.update(2100);expect(effects.root.getObjectByName('Max Elephant turbulent water jet')!.visible).toBe(false);
    effects.update(2200);expect(effects.root.getObjectByName('Max Elephant turbulent water jet')!.visible).toBe(true);
    effects.setSettings(.7,true,'low');effects.setTechnique('rabbit-escape');effects.activate(0,false);effects.update(1500);
    expect((effects.root.getObjectByName('Rabbit Escape swarm') as THREE.InstancedMesh).count).toBe(32);
    expect((effects.root.getObjectByName('Expanded shadow water and light particles') as THREE.Points).geometry.drawRange.count).toBe(300);
    effects.setSettings(.7,true,'high');effects.update(1600);expect((effects.root.getObjectByName('Rabbit Escape swarm') as THREE.InstancedMesh).count).toBe(96);
  });
  it('expands an open liquid domain with doubles and shikigami, restores it on cancel and honors zero intensity',()=>{
    effects.setTechnique('chimera-garden');effects.activate(0,false);effects.update(3500);expect(effects.domainMix).toBeGreaterThan(.1);
    for(const name of ['Chimera fluid shadow garden','Chimera shadow double 0','Chimera shadow double 1','Chimera shadow hound 0','Rabbit Escape swarm'])expect(effects.root.getObjectByName(name)!.visible).toBe(true);
    effects.clear();expect(effects.root.visible).toBe(false);expect(effects.domainMix).toBe(0);
    effects.setSettings(0,true);effects.activate(0,false);effects.update(3500);expect(effects.root.visible).toBe(false);expect(effects.domainMix).toBe(0);effects.setSettings(.75,true);
  });
});

describe('distinct responses on all four receiving curse models',()=>{
  for(const curse of Object.keys(CURSES) as CurseKey[])for(const key of keys)it(`${curse} receives ${key}, persists as intended and resets explicitly`,()=>{
    const actor=createCurseActor(makePalette(),curse),body=actor.root.children[0],duration=TECHNIQUES[key].effectMs,contact=MEGUMI_CONTACT[key];
    actor.animate(1,combatTimeline(key,contact-1,duration),CURSE_CENTER);expect(body.visible).toBe(true);expect(actor.uniforms.dissolve.value).toBe(0);
    actor.animate(2,combatTimeline(key,contact+100,duration,true),CURSE_CENTER);expect(body.visible).toBe(true);expect(actor.uniforms.cuts.value).toBe(0);
    actor.animate(30,persistentTargetTimeline(key,30000,duration),CURSE_CENTER);
    if(key==='totality'||key==='mahoraga')expect(body.visible).toBe(false);
    if(key==='toad'){expect(body.rotation.x).toBeGreaterThan(1.4);expect(actor.root.position.x).toBeCloseTo(0);}
    if(key==='max-elephant')expect(body.rotation.x).toBeGreaterThan(1.4);
    if(key==='rabbit-escape'){expect(body.visible).toBe(true);expect(body.rotation.x).toBe(0);expect(actor.uniforms.burn.value).toBe(0);expect(actor.uniforms.cuts.value).toBe(0);}
    if(key==='chimera-garden'){expect(actor.root.position.y).toBeLessThan(-3);expect(body.visible).toBe(false);expect(actor.root.getObjectByName('Chimera target shadow remnant')!.visible).toBe(true);}
    actor.reset();expect(body.visible).toBe(true);expect(actor.root.position.y).toBeCloseTo(.02);expect(actor.root.getObjectByName('Chimera target shadow remnant')!.visible).toBe(false);
  });
  it('splits then purifies the Mahoraga target and leaves Rabbits/Toad without explosion accents or lens pulses',()=>{
    const actor=createCurseActor(makePalette(),'mahito'),duration=TECHNIQUES.mahoraga.effectMs;
    actor.animate(1,combatTimeline('mahoraga',3350,duration),CURSE_CENTER);
    const shards=actor.root.getObjectByName('Curse fracture bisect')!;expect(shards.children.some(c=>c.visible)).toBe(true);
    actor.animate(2,combatTimeline('mahoraga',4600,duration),CURSE_CENTER);expect(shards.children.every(c=>!c.visible)).toBe(true);
    const accents=new CombatAccents(new THREE.Scene()),lens=new ImpactLens(),camera=new THREE.PerspectiveCamera();
    for(const key of ['rabbit-escape','toad'] as const){const state=combatTimeline(key,MEGUMI_CONTACT[key]+20,TECHNIQUES[key].effectMs);accents.update(state,CURSE_CENTER,CURSE_CENTER,new THREE.Vector3());lens.update(state,camera,CURSE_CENTER,.75,false);expect(accents.root.visible).toBe(false);expect(lens.enabled).toBe(false);}
    expect(megumiContactTimes('chimera-garden')).toEqual([2600,3400,4200,5000,5800]);
  });
});
