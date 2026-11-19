import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { persistentTargetTimeline } from '../src/scene/combatTimeline';
import { createCurseActor, CURSE_CENTER } from '../src/scene/CurseActor';
import { makePalette } from '../src/scene/materials';
import { ALL_TECHNIQUES } from '../src/core/techniques';

describe('manual target lifecycle', () => {
  it.each(ALL_TECHNIQUES)('$key never schedules automatic regeneration', technique => {
    for (const time of [technique.effectMs - 100, technique.effectMs, 30000]) {
      const state = persistentTargetTimeline(technique.key, time, technique.effectMs);
      expect(state.active).toBe(true); expect(state.recovery).toBe(0); expect(state.persistent).toBe(true);
    }
  });
  it('keeps settled fragments present until explicit reset', () => {
    const actor = createCurseActor(makePalette());
    actor.animate(30, persistentTargetTimeline('shrine', 30000, 8000), CURSE_CENTER);
    expect(actor.root.children[0].visible).toBe(false);
    const group = actor.root.getObjectByName('Curse fracture dense')!;
    expect(group.visible).toBe(true); expect(group.children.every(o => o.visible)).toBe(true);
    group.children.forEach(o => expect((o as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>).material.opacity).toBe(1));
    actor.reset(); expect(actor.root.children[0].visible).toBe(true);
    expect(actor.root.getObjectByName('Curse physical destruction')!.visible).toBe(false);
  });
  it('keeps erasure and incineration complete after the effects have expired', () => {
    const actor = createCurseActor(makePalette());
    for (const key of ['purple', 'flame'] as const) {
      actor.animate(30, persistentTargetTimeline(key, 30000, 4200), CURSE_CENTER);
      expect(actor.root.children[0].visible).toBe(false); expect(actor.uniforms.dissolve.value).toBe(1);
      actor.reset(); expect(actor.uniforms.dissolve.value).toBe(0);
    }
  });
});
