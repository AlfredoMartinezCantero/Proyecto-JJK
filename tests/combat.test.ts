import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { combatTimeline, CONTACT_MS } from '../src/scene/combatTimeline';
import { ALL_TECHNIQUES, TECHNIQUES } from '../src/core/techniques';
import { createCurseActor, CURSE_CENTER } from '../src/scene/CurseActor';
import { makePalette } from '../src/scene/materials';
import { TechniqueEffects } from '../src/scene/TechniqueEffects';
import { effectTimeline } from '../src/scene/effectTimeline';

beforeAll(() => vi.stubGlobal('document', { createElement: () => ({ width: 128, height: 128,
  getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillStyle: '', fillRect() {} }) }) }));
afterAll(() => vi.unstubAllGlobals());

describe('contact and target choreography', () => {
  it('Purple moves immediately at the spoken release and its projectile and target share the early contact', () => {
    const duration = TECHNIQUES.purple.effectMs;
    for (const elapsed of [50, CONTACT_MS.purple - 1, CONTACT_MS.purple, CONTACT_MS.purple + 130]) {
      const combat = combatTimeline('purple', elapsed, duration);
      const visual = effectTimeline('purple', elapsed, duration, false);
      expect(visual.travel).toBe(combat.travel); expect(visual.travel).toBeGreaterThan(0);
      if (elapsed < CONTACT_MS.purple) expect(combat.dissolve).toBe(0);
      else expect(combat.travel).toBe(1);
    }
    expect(CONTACT_MS.purple).toBeLessThan(1000);
    expect(combatTimeline('purple', CONTACT_MS.purple + 130, duration).dissolve).toBe(1);
  });
  it('retains a persistent target snapshot when pausing, and restores only on explicit reset', () => {
    const effects = new TechniqueEffects(new THREE.Scene(), new THREE.PerspectiveCamera());
    effects.setTechnique('shrine'); effects.activate(0, false); effects.update(5000);
    expect(effects.targetResponse.persistent).toBe(true); expect(effects.targetResponse.recovery).toBe(0);
    effects.clear(true); effects.update(30000);
    expect(effects.combat.active).toBe(false); expect(effects.targetResponse.elapsed).toBe(5000);
    expect(effects.targetResponse.active).toBe(true); expect(effects.targetResponse.recovery).toBe(0);
    effects.clear(); effects.update(31000); expect(effects.targetResponse.active).toBe(false);
  });
  it.each(['red', 'purple', 'dismantle', 'cleave', 'flame', 'shrine'] as const)('%s cannot damage the receiver before contact', key => {
    const state = combatTimeline(key, CONTACT_MS[key] - 1, TECHNIQUES[key].effectMs);
    expect(state.hitAge).toBe(-1);
    expect(state.knockback + state.dissolve + state.cuts + state.burn).toBe(0);
    const hit = combatTimeline(key, CONTACT_MS[key] + 200, TECHNIQUES[key].effectMs);
    expect(hit.hitAge).toBeGreaterThanOrEqual(0);
    expect(hit.knockback + hit.dissolve + hit.cuts + hit.burn).toBeGreaterThan(0);
  });
  it('Azul attracts and lifts; Rojo pushes after arrival; Purple passes through', () => {
    const blue = combatTimeline('blue', 850, 1800), red = combatTimeline('red', 900, 2200), purple = combatTimeline('purple', 2600, 4200);
    expect(blue.pull).toBe(1); expect(blue.lift).toBeGreaterThan(0); expect(blue.knockback).toBe(0);
    expect(red.knockback).toBeGreaterThan(0); expect(red.pull).toBe(0);
    expect(purple.travel).toBe(1); expect(purple.dissolve).toBe(1); expect(purple.pull).toBe(0);
  });
  it('domains differ: Void holds still and Shrine repeatedly cuts', () => {
    expect(combatTimeline('domain', 2000, 8000).stun).toBe(1);
    expect(combatTimeline('domain', 2000, 8000).cuts).toBe(0);
    expect(combatTimeline('shrine', CONTACT_MS.shrine - 1, 8000).cuts).toBe(0);
    expect(combatTimeline('shrine', CONTACT_MS.shrine + 1500, 8000).cuts).toBe(1);
    expect(combatTimeline('shrine', CONTACT_MS.shrine + 420, 8000).pulse).toBe(1);
    expect(combatTimeline('shrine', CONTACT_MS.shrine + 620, 8000).pulse).toBeLessThan(.4);
  });
  it.each(ALL_TECHNIQUES.map(t => t.key))('fully recovers %s at its end and previews apply no response', key => {
    const duration = TECHNIQUES[key].effectMs;
    for (const elapsed of [-Infinity, -1, duration, duration + 10000]) {
      const s = combatTimeline(key, elapsed, duration);
      expect(s.active).toBe(false); expect(s.pull + s.knockback + s.dissolve + s.cuts + s.burn + s.stun).toBe(0);
      expect(Object.values(s).filter(v => typeof v === 'number').every(Number.isFinite)).toBe(true);
    }
    const s = combatTimeline(key, duration * .65, duration, true);
    expect(s.pull + s.knockback + s.dissolve + s.cuts + s.burn + s.stun + s.lift).toBe(0);
  });
  it('a skipped render frame samples the same response without replaying impulses', () => {
    const actor = createCurseActor(makePalette()), field = CURSE_CENTER.clone().add(new THREE.Vector3(-1, .2, 0));
    const state = combatTimeline('red', 900, 2200);
    actor.animate(.9, state, field); const pose = actor.root.position.toArray();
    actor.animate(.9, state, field); expect(actor.root.position.toArray()).toEqual(pose);
    actor.animate(2.2, combatTimeline('red', 2200, 2200), field);
    expect(actor.root.position.toArray()).toEqual([2, .02, -1.35]); expect(actor.root.scale.toArray()).toEqual([1, 1, 1]);
  });
  it('dissolves surface and outlines without shrinking the entire target, then resets', () => {
    const actor = createCurseActor(makePalette()); actor.animate(2.7, combatTimeline('purple', 2700, 4200), CURSE_CENTER);
    expect(actor.uniforms.dissolve.value).toBe(1); expect(actor.root.scale.toArray()).toEqual([1, 1, 1]);
    actor.reset(); expect(Object.values(actor.uniforms).every(v => v.value === 0)).toBe(true);
    expect(actor.root.visible).toBe(true); expect(actor.root.position.toArray()).toEqual([2, .02, -1.35]);
  });
  it('all pooled effect buffers remain finite across charging, impacts and cleanup', () => {
    const scene = new THREE.Scene(), effects = new TechniqueEffects(scene, new THREE.PerspectiveCamera());
    for (const t of ALL_TECHNIQUES) {
      effects.setTechnique(t.key); effects.setPalms(new THREE.Vector3(-1, 2, 1), new THREE.Vector3(1, 2, 1));
      effects.setCharge(.7, 0); effects.update(0); effects.activate(100, false);
      for (const age of [0, CONTACT_MS[t.key] - 1, CONTACT_MS[t.key] + 150, t.effectMs - 100, t.effectMs]) {
        effects.update(100 + age);
        scene.traverse(object => {
          if (object instanceof THREE.InstancedMesh) expect(Array.from(object.instanceMatrix.array).every(Number.isFinite)).toBe(true);
          if (object instanceof THREE.Points || object instanceof THREE.LineSegments)
            expect(Array.from(object.geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true);
        });
      }
      effects.clear(); expect(effects.combat.active).toBe(false);
    }
  });
  it('allows an explicitly requested cosmetic target preview and clears it on a new technique', () => {
    const effects = new TechniqueEffects(new THREE.Scene(), new THREE.PerspectiveCamera());
    effects.setTechnique('purple'); effects.activate(0, true); effects.update(2700);
    expect(effects.targetResponse.dissolve).toBe(0);
    effects.activate(3000, true, true); effects.update(5700);
    expect(effects.targetResponse.dissolve).toBe(1); expect(effects.combat.preview).toBe(true);
    expect(effects.impact).toBe(0);
    effects.setTechnique('red'); expect(effects.targetResponse.active).toBe(false);
    effects.activate(6000, true); effects.update(6900); expect(effects.targetResponse.knockback).toBe(0);
  });
});
