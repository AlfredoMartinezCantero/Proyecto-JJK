import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CHARACTERS, TECHNIQUES, validateCatalog, YUJI_KEYS } from '../src/core/techniques';
import catalog from '../src/config/yuji.json';
import { TechniqueRecognizer, type TechniqueResult } from '../src/core/TechniqueRecognizer';
import type { TechniqueKey, TrackedHand } from '../src/core/types';
import { handFrame, trackedPose, poseHand } from './fixtures';
import { combatTimeline, persistentTargetTimeline } from '../src/scene/combatTimeline';
import { DIVERGENT_DELAY_MS, YUJI_CONTACT } from '../src/scene/yujiTimeline';
import { createYuji } from '../src/scene/Yuji';
import { makePalette } from '../src/scene/materials';
import { createCurseActor, CURSE_CENTER } from '../src/scene/CurseActor';
import { CURSES, type CurseKey } from '../src/core/curses';
import { YujiEffects } from '../src/scene/YujiEffects';
import { HandRig } from '../src/scene/HandRig';
import { HAND_APPEARANCE } from '../src/scene/handAppearance';

function practice(key: TechniqueKey = 'divergent') {
  const recognizer = new TechniqueRecognizer(TECHNIQUES[key]); let time = -50, fires = 0, result: TechniqueResult;
  const frame = (hands: TrackedHand[]) => { time += 50; result = recognizer.update(handFrame(time,hands)); if (result.fire) fires++; return result; };
  const hold = (hand: TrackedHand, ms: number) => { for (let i = 0; i <= ms/50; i++) frame([hand]); };
  const prepare = () => hold(trackedPose('fist',.4),TECHNIQUES[key].steps[0].holdMs);
  const stroke = (direction = 1) => { for (let i = 1; i <= 5; i++) frame([trackedPose('fist',.4+direction*i*.016)]); };
  return { recognizer,frame,hold,prepare,stroke,get fires(){return fires;},get result(){return result;},get time(){return time;} };
}

describe('Yuji catalog and actual fist motion (synthetic landmarks)', () => {
  it('has two validated lessons and independent tutorial progress', () => {
    expect(validateCatalog(catalog,YUJI_KEYS,'yuji').map(t => t.key)).toEqual(['divergent','black-flash']);
    expect(CHARACTERS.yuji.techniques).toHaveLength(2); expect(TECHNIQUES.divergent.handCount).toBe(1);
    expect(() => validateCatalog(catalog)).toThrow();
  });
  for (const key of YUJI_KEYS) for (const direction of [-1,1]) it(`${key}: prepares, moves ${direction < 0 ? 'left' : 'right'}, settles and fires exactly once`, () => {
    const h = practice(key); h.prepare(); expect(h.recognizer.currentStep).toBe(1); expect(h.fires).toBe(0);
    h.stroke(direction); expect(h.fires).toBe(0); h.hold(trackedPose('fist',.4+direction*.08),800);
    expect(h.fires).toBe(1); h.hold(trackedPose('fist',.4+direction*.08),5000); expect(h.fires).toBe(1);
    h.hold(trackedPose('open',.4),700); expect(h.result.phase).toBe('ready');
  });
  it('does not fire from a still fist, jitter, an open hand or one isolated pose', () => {
    const h = practice(); h.frame([trackedPose('fist',.4)]); expect(h.recognizer.currentStep).toBe(0);
    h.prepare(); for (let i = 0; i < 50; i++) h.frame([trackedPose('fist',.4+Math.sin(i)*.004)]);
    expect(h.fires).toBe(0); h.hold(trackedPose('fist',.4),6000); expect(h.fires).toBe(0);
    const open = practice(); open.hold(trackedPose('open',.4),1000); open.stroke(); expect(open.fires).toBe(0);
  });
  it('requires both raw and filtered knuckles to move in the same direction', () => {
    const h = practice(); h.prepare();
    for (let i = 1; i <= 5; i++) h.frame([{...trackedPose('fist',.4+i*.016),landmarks:poseHand('fist',.4)}]);
    for (let i = 0; i < 16; i++) h.frame([{...trackedPose('fist',.48),landmarks:poseHand('fist',.4)}]);
    expect(h.fires).toBe(0); expect(h.result.valid).toBe(false);
    for (let i = 1; i <= 5; i++) h.frame([{...trackedPose('fist',.48),landmarks:poseHand('fist',.4+i*.016)}]);
    h.hold(trackedPose('fist',.48),800); expect(h.fires).toBe(1);
  });
  it('rejects a tracking jump, a vertical-only move and changing the prepared hand', () => {
    const jump = practice(); jump.prepare(); jump.frame([trackedPose('fist',.60)]); jump.hold(trackedPose('fist',.60),800); expect(jump.fires).toBe(0);
    const vertical = practice(); vertical.prepare();
    for (let i = 1; i <= 5; i++) {
      const h = trackedPose('fist',.4), points = h.raw.map(p => ({...p,y:p.y+i*.02})); vertical.frame([{...h,raw:points,landmarks:points}]);
    }
    expect(vertical.fires).toBe(0);
    const changed = practice(); changed.prepare();
    for (let i = 1; i <= 5; i++) changed.frame([trackedPose('fist',.4+i*.016,2)]);
    changed.hold(trackedPose('fist',.48,2),800); expect(changed.fires).toBe(0);
  });
  it('cancels the sequence on pause, stale samples and a sustained invalid pose', () => {
    const h = practice(); h.prepare(); h.stroke(); h.recognizer.interrupt(); h.hold(trackedPose('fist',.48),800); expect(h.fires).toBe(0);
    const stale = practice(); stale.prepare(); stale.stroke();
    for (let i = 0; i < 30; i++) {
      const result = stale.recognizer.update({...handFrame(stale.time,[trackedPose('fist',.48)]),receivedAt:stale.time+1000+i*50});
      expect(result.fire).toBe(false); expect(result.progress).toBe(0);
    }
    stale.recognizer.update(handFrame(stale.time+2600,[trackedPose('fist',.48)]));
    expect(stale.fires).toBe(0); expect(stale.recognizer.currentStep).toBe(0);
    const invalid = practice(); invalid.prepare(); invalid.stroke(); invalid.hold(trackedPose('open',.48),300);
    expect(invalid.recognizer.currentStep).toBe(0); expect(invalid.fires).toBe(0);
  });
  it('allows the final hold to finish after a slow stroke near its three-second limit', () => {
    const h = practice(); h.prepare();
    for (let i = 1; i <= 50; i++) h.frame([trackedPose('fist',.4+i*.0016)]);
    h.hold(trackedPose('fist',.48),800); expect(h.fires).toBe(1);
  });
});

describe('Yuji model, effects and receiving curses (CPU scene graph)', () => {
  it('has a distinct uniform, natural hands and a repeatable dash/punch/return animation', () => {
    const actor = createYuji(makePalette()); actor.animate(1,.7); const base = actor.root.position.clone();
    expect(actor.root.getObjectsByProperty('name','Yuji closed fist')).toHaveLength(2);
    expect(actor.root.getObjectByName('Yuji red hood')).toBeDefined();
    actor.animate(1,0,combatTimeline('black-flash',620,3100)); expect(actor.root.position.distanceTo(base)).toBeGreaterThan(3);
    actor.root.traverse(o => expect([...o.position.toArray(),...o.rotation.toArray().slice(0,3),...o.scale.toArray()].every(Number.isFinite)).toBe(true));
    actor.animate(2,0,combatTimeline('black-flash',3100,3100)); expect(actor.root.position.distanceTo(base)).toBe(0);
    const rig = new HandRig('yuji'); expect(rig.mesh.geometry.userData.character).toBe('yuji');
    expect((rig.mesh.material as THREE.MeshToonMaterial).color.getHexString()).toBe(HAND_APPEARANCE.yuji.skin.slice(1));
    expect(rig.mesh.getObjectByName('Sukuna wrist markings')!.visible).toBe(false);
  });
  it('has two distinct contact pulses separated by 320 ms, with no damage before contact', () => {
    const contact = YUJI_CONTACT.divergent;
    expect(combatTimeline('divergent',contact-1,2800).pulse).toBe(0);
    expect(combatTimeline('divergent',contact,2800).pulse).toBeCloseTo(.55);
    expect(combatTimeline('divergent',contact+DIVERGENT_DELAY_MS-1,2800).pulse).toBeLessThan(.1);
    expect(combatTimeline('divergent',contact+DIVERGENT_DELAY_MS,2800).pulse).toBe(1);
    expect(combatTimeline('divergent',contact,2800).collapse).toBe(0);
    expect(combatTimeline('divergent',1600,2800).collapse).toBe(1);
  });
  for (const key of Object.keys(CURSES) as CurseKey[]) it(`${key}: falls after Divergent Fist, breaks after Black Flash and waits for manual respawn`, () => {
    const actor = createCurseActor(makePalette(),key), body = actor.root.children[0];
    actor.animate(1,combatTimeline('divergent',459,2800),CURSE_CENTER); expect(body.rotation.x).toBe(0);
    actor.animate(2,persistentTargetTimeline('divergent',30000,2800),CURSE_CENTER); expect(body.visible).toBe(true); expect(body.rotation.x).toBeGreaterThan(1.4);
    actor.reset(); expect(body.rotation.x).toBe(0);
    actor.animate(3,combatTimeline('black-flash',619,3100),CURSE_CENTER); expect(body.visible).toBe(true);
    actor.animate(3,combatTimeline('black-flash',700,3100),CURSE_CENTER); expect(body.visible).toBe(false);
    actor.animate(30,persistentTargetTimeline('black-flash',30000,3100),CURSE_CENTER); expect(body.visible).toBe(false);
    actor.reset(); expect(body.visible).toBe(true); expect(actor.uniforms.dissolve.value).toBe(0);
  });
  it('keeps debug previews harmless and honors zero intensity/low quality while pooling effects', () => {
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(), effects = new YujiEffects(scene,camera);
    const actor = createCurseActor(makePalette(),'mahito');
    actor.animate(1,combatTimeline('black-flash',700,3100,true),CURSE_CENTER); expect(actor.root.children[0].visible).toBe(true);
    const objects: THREE.Object3D[] = []; effects.root.traverse(o => objects.push(o));
    effects.setTechnique('black-flash'); effects.setPalms(new THREE.Vector3(-1,2,1),null); effects.setCharge(.7); effects.update(0);
    expect(effects.root.getObjectByName('Observed fist cursed aura')!.visible).toBe(true);
    effects.activate(100,false); effects.update(720); expect(effects.root.getObjectByName('Black Flash black lightning cores')!.visible).toBe(true);
    effects.root.traverse(o => {
      expect([...o.position.toArray(),...o.scale.toArray()].every(Number.isFinite)).toBe(true);
      if (o instanceof THREE.InstancedMesh) expect(Array.from(o.instanceMatrix.array).every(Number.isFinite)).toBe(true);
    });
    effects.setSettings(.5,true,'low'); expect((effects.root.getObjectByName('Yuji contact sparks') as THREE.Points).geometry.drawRange.count).toBe(220);
    effects.setSettings(0,true); effects.update(750); expect(effects.root.visible).toBe(false);
    effects.clear(); const current: THREE.Object3D[] = []; effects.root.traverse(o => current.push(o)); expect(current).toEqual(objects);
  });
});
