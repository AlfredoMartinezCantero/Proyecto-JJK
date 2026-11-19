import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CURSES, isCurseKey, type CurseKey } from '../src/core/curses';
import { createCurseActor, CURSE_CENTER } from '../src/scene/CurseActor';
import { createGojo, createSukuna } from '../src/scene/characters';
import { makePalette } from '../src/scene/materials';
import { combatTimeline } from '../src/scene/combatTimeline';
import { ALL_TECHNIQUES } from '../src/core/techniques';

describe('selectable curse models and destruction', () => {
  it('validates the public target catalog', () => {
    expect(Object.keys(CURSES)).toEqual(['mahito', 'hanami', 'jogo', 'dagon']);
    expect(isCurseKey('__proto__')).toBe(false); expect(isCurseKey(null)).toBe(false);
  });
  it.each(Object.keys(CURSES) as CurseKey[])('%s supports all impacts and returns intact', key => {
    const actor = createCurseActor(makePalette(), key);
    expect(actor.root.name).toBe(key); expect(actor.root.getObjectByName(`${key} head`)).toBeDefined();
    for (const technique of ALL_TECHNIQUES) {
      actor.animate(2.7, combatTimeline(technique.key, technique.key === 'purple' ? 2700 : technique.effectMs * .55, technique.effectMs), CURSE_CENTER);
      actor.root.traverse(object => {
        expect([...object.position.toArray(), ...object.scale.toArray(), ...object.quaternion.toArray()].every(Number.isFinite)).toBe(true);
      });
      actor.reset(); expect(actor.root.children[0].visible).toBe(true);
      expect(actor.root.getObjectByName('Curse physical destruction')!.visible).toBe(false);
      expect(Object.values(actor.uniforms).every(u => u.value === 0)).toBe(true);
    }
    actor.animate(2.7, combatTimeline('purple', 2700, 4200), CURSE_CENTER);
    expect(actor.root.children[0].visible).toBe(false);
    actor.reset(); actor.animate(1, combatTimeline('dismantle', 1000, 2000), CURSE_CENTER);
    expect(actor.root.getObjectByName('Curse fracture bisect')!.children).toHaveLength(2);
  });
  it('uses different geometry for all four silhouettes', () => {
    const budgets = Object.keys(CURSES).map(key => { const actor = createCurseActor(makePalette(), key as CurseKey); let count = 0;
      actor.root.children[0].traverse(o => { if (o instanceof THREE.Mesh) count += o.geometry.getAttribute('position').count; }); return count;
    });
    expect(new Set(budgets).size).toBe(4);
  });
  it.each([createGojo, createSukuna])('casters have two detailed hands and finite animated poses', factory => {
    const actor = factory(makePalette()); expect(actor.root.getObjectsByProperty('name', 'Articulated caster hand')).toHaveLength(2);
    actor.animate(1, .8); actor.root.traverse(o => expect([...o.position.toArray(), ...o.rotation.toArray().slice(0, 3) as number[]].every(Number.isFinite)).toBe(true));
  });
});
