import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CURSES, type CurseKey } from '../src/core/curses';
import { createCurseActor, CURSE_CENTER } from '../src/scene/CurseActor';
import { CONTACT_MS, combatTimeline, persistentTargetTimeline } from '../src/scene/combatTimeline';
import { makePalette } from '../src/scene/materials';
import { TECHNIQUES } from '../src/core/techniques';

describe('Gojo domain head explosion', () => {
  it.each(Object.keys(CURSES) as CurseKey[])('%s loses its head with two seconds left and keeps its body until manual respawn', key => {
    const duration = TECHNIQUES.domain.effectMs, burstAt = duration - 2000;
    const actor = createCurseActor(makePalette(), key), body = actor.root.children[0];
    const head = actor.root.getObjectByName('Curse head parts')!;
    const torso = actor.root.getObjectByName(`${key} torso`)!;
    const fragments = actor.root.getObjectByName('Curse fracture head')!;
    const shards = fragments.children as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[];
    const originalPositions = shards.map(shard => shard.position.clone());
    const meshCount = actor.root.getObjectsByProperty('type', 'Mesh').length;
    expect(actor.root.getObjectByName(`${key} head`)!.parent).toBe(head);
    expect(torso.parent).toBe(body); expect(shards.length).toBeGreaterThanOrEqual(6);
    for (const shard of shards) {
      shard.geometry.computeBoundingBox();
      expect(shard.geometry.boundingBox!.min.y + shard.position.y).toBeGreaterThan(1.3);
    }
    for (const elapsed of [CONTACT_MS.domain, burstAt - 1]) {
      actor.animate(elapsed / 1000, combatTimeline('domain', elapsed, duration), CURSE_CENTER);
      expect(head.visible).toBe(true); expect(fragments.visible).toBe(false);
      expect(actor.uniforms.stun.value).toBe(1);
    }
    expect(actor.root.getObjectByName('Void head pressure')!.visible).toBe(true);
    actor.reset(); expect(actor.root.getObjectByName('Void head energy')!.visible).toBe(false);
    actor.animate(burstAt / 1000, persistentTargetTimeline('domain', burstAt, duration), CURSE_CENTER);
    expect(head.visible).toBe(false); expect(fragments.visible).toBe(true);
    actor.animate((burstAt + 150) / 1000, persistentTargetTimeline('domain', burstAt + 150, duration), CURSE_CENTER);
    expect(head.visible).toBe(false); expect(body.visible && torso.visible).toBe(true);
    expect(fragments.visible).toBe(true); expect(actor.uniforms.dissolve.value).toBe(0);
    expect(shards.some((shard, i) => shard.position.distanceTo(originalPositions[i]) > .1)).toBe(true);
    expect(actor.root.getObjectByName('Curse fracture dense')!.visible).toBe(false);
    actor.animate(30, persistentTargetTimeline('domain', 30000, 8000), CURSE_CENTER);
    expect(head.visible).toBe(false); expect(body.visible).toBe(true);
    expect(shards.every(shard => shard.visible && shard.material.opacity === 1)).toBe(true);
    for (const shard of shards) expect([...shard.position, ...shard.quaternion, ...shard.scale].every(Number.isFinite)).toBe(true);
    actor.reset();
    expect(head.visible && body.visible).toBe(true); expect(fragments.visible).toBe(false);
    expect(actor.root.getObjectsByProperty('type', 'Mesh')).toHaveLength(meshCount);
    shards.forEach((shard, i) => expect(shard.position.toArray()).toEqual(originalPositions[i].toArray()));
    actor.animate((burstAt + 500) / 1000, combatTimeline('domain', burstAt + 500, duration, true), CURSE_CENTER);
    expect(head.visible).toBe(true); expect(actor.root.getObjectByName('Curse physical destruction')!.visible).toBe(false);
  });
  it('respects reduced flashes and zero intensity while retaining physical head destruction', () => {
    const actor = createCurseActor(makePalette());
    const duration = TECHNIQUES.domain.effectMs;
    const state = persistentTargetTimeline('domain', duration - 2000 + 30, duration);
    const flash = actor.root.getObjectByName('Curse head burst flash')!;
    const wave = actor.root.getObjectByName('Curse head shockwave')!;
    actor.setSettings(.8, 'low', true); actor.animate(state.elapsed / 1000, state, CURSE_CENTER);
    expect(flash.visible).toBe(false); expect(wave.visible).toBe(true);
    actor.setSettings(.8, 'high', false); actor.animate(state.elapsed / 1000, state, CURSE_CENTER);
    expect(flash.visible).toBe(true);
    actor.setSettings(0, 'low', false); actor.animate(state.elapsed / 1000, state, CURSE_CENTER);
    expect(flash.visible || wave.visible).toBe(false);
    expect(actor.root.getObjectByName('Curse head parts')!.visible).toBe(false);
  });
});
