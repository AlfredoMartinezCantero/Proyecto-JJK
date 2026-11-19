import { describe, expect, it } from 'vitest';
import { SUKUNA_KEYS, SUKUNA_TECHNIQUES, TECHNIQUES, validateCatalog } from '../src/core/techniques';
import { evaluatePose } from '../src/core/gesture';
import { TechniqueRecognizer, type TechniqueResult } from '../src/core/TechniqueRecognizer';
import { normalizeProgress } from '../src/core/progress';
import { createSukuna } from '../src/scene/characters';
import { makePalette } from '../src/scene/materials';
import { sukunaTimeline } from '../src/scene/SukunaEffects';
import config from '../src/config/sukuna.json';
import type { TechniqueKey, TrackedHand } from '../src/core/types';
import { handFrame, trackedPose, poseHand } from './fixtures';

const openPair = (close = false) => [trackedPose('open', close ? .435 : .27, 1), trackedPose('open', close ? .565 : .73, 2)];
const shrinePair = () => [trackedPose('blue', .435, 1), trackedPose('blue', .565, 2)];
function harness(key: TechniqueKey) {
  const recognizer = new TechniqueRecognizer(TECHNIQUES[key]); let time = -50, fires = 0, last: TechniqueResult;
  const frame = (hands: TrackedHand[]) => { time += 50; last = recognizer.update(handFrame(time, hands)); if (last.fire) fires++; return last; };
  return { recognizer, frame, get last() { return last; }, get fires() { return fires; },
    hold(hands: TrackedHand[], ms: number) { for (let i = 0; i <= ms / 50; i++) frame(hands); return last!; },
  };
}

describe('Sukuna catalog and model', () => {
  it('validates four Sukuna lessons and character ownership', () => {
    expect(validateCatalog(config, SUKUNA_KEYS, 'sukuna')).toHaveLength(4);
    expect(SUKUNA_TECHNIQUES.every(t => t.character === 'sukuna')).toBe(true);
  });
  it('preserves separate completion records without unlocking the other character', () => {
    expect(normalizeProgress(['shrine', 'flame'], true)).toEqual(['blue', 'flame', 'shrine']);
  });
  it('creates and animates a distinct procedural Sukuna', () => {
    const character = createSukuna(makePalette()); expect(character.root.name).toBe('Ryomen Sukuna');
    character.animate(1, 1); character.root.updateMatrixWorld(true);
    character.root.traverse(object => expect([...object.position.toArray(), ...object.quaternion.toArray()].every(Number.isFinite)).toBe(true));
  });
  it('evaluates palm, fist and blade templates independently', () => {
    expect(evaluatePose(poseHand('open'), 960, 720, 'palm').valid).toBe(true);
    expect(evaluatePose(poseHand('fist'), 960, 720, 'fist').valid).toBe(true);
    expect(evaluatePose(poseHand('red'), 960, 720, 'blade').valid).toBe(true);
    expect(evaluatePose(poseHand('open'), 960, 720, 'blade').valid).toBe(false);
  });
});

describe('synthetic Sukuna gesture sequences', () => {
  it('does not cut from a static index or from elapsed time', () => {
    const h = harness('dismantle'); h.hold([trackedPose('red', .4)], 7000); expect(h.fires).toBe(0);
  });
  it('requires a smooth horizontal displacement and a final sustained stop', () => {
    const h = harness('dismantle'); h.hold([trackedPose('red', .4)], 700);
    expect(h.recognizer.currentStep).toBe(1);
    for (const x of [.425, .45, .475, .5, .525, .55]) h.frame([trackedPose('red', x)]);
    expect(h.fires).toBe(0); h.hold([trackedPose('red', .55)], 750); expect(h.fires).toBe(1);
    h.hold([trackedPose('red', .55)], 4000); expect(h.fires).toBe(1);
  });
  it('rejects a one-frame position jump', () => {
    const h = harness('dismantle'); h.hold([trackedPose('red', .4)], 700);
    h.frame([trackedPose('red', .65)]); expect(h.recognizer.currentStep).toBe(0); expect(h.fires).toBe(0);
  });
  it('accepts either horizontal direction but rejects a vertical excursion', () => {
    const left = harness('dismantle'); left.hold([trackedPose('red', .6)], 700);
    for (const x of [.575, .55, .525, .5, .475, .45]) left.frame([trackedPose('red', x)]);
    left.hold([trackedPose('red', .45)], 750); expect(left.fires).toBe(1);
    const vertical = harness('dismantle'); vertical.hold([trackedPose('red', .4)], 700);
    const hand = trackedPose('red', .4);
    hand.raw = hand.raw.map(p => ({ ...p, y: p.y + .2 })); hand.landmarks = hand.raw;
    vertical.frame([hand]); expect(vertical.recognizer.currentStep).toBe(0); expect(vertical.fires).toBe(0);
  });
  it('requires matching raw and smoothed displacement', () => {
    const h = harness('dismantle'); h.hold([trackedPose('red', .4)], 700);
    for (const x of [.425, .45, .475, .5, .525, .55]) {
      const hand = trackedPose('red', x); hand.landmarks = poseHand('red', .4); h.frame([hand]);
    }
    expect(h.fires).toBe(0); expect(h.last.progress).toBe(0);
  });
  it('does not transfer a prepared cut to another tracking identity', () => {
    const h = harness('dismantle'); h.hold([trackedPose('red', .4)], 700);
    h.hold([trackedPose('red', .4, 2)], 350); expect(h.recognizer.currentStep).toBe(0); expect(h.fires).toBe(0);
  });
  it('cleaves only after separated open palms then convergence', () => {
    const h = harness('cleave'); h.hold(openPair(), 600); expect(h.fires).toBe(0);
    h.hold(openPair(true).reverse(), 850); expect(h.fires).toBe(1);
  });
  it('cannot skip the preparation of Cleave', () => {
    const h = harness('cleave'); h.hold(openPair(true), 3000); expect(h.fires).toBe(0);
  });
  it('Fuga permits either hand to take the fist or index role after preparation', () => {
    for (const swap of [false, true]) {
      const h = harness('flame'); h.hold(openPair(), 800);
      h.hold([trackedPose(swap ? 'red' : 'fist', .27, 1), trackedPose(swap ? 'fist' : 'red', .73, 2)], 900);
      expect(h.fires).toBe(1);
    }
  });
  it('cannot fire Fuga from the release pose alone or substitute a new hand', () => {
    const h = harness('flame'); h.hold([trackedPose('fist', .27, 1), trackedPose('red', .73, 2)], 2000);
    expect(h.fires).toBe(0); h.hold(openPair(), 800);
    h.hold([trackedPose('fist', .27, 3), trackedPose('red', .73, 2)], 900); expect(h.fires).toBe(0);
  });
  it('requires two complete hands and sustained posture for the shrine', () => {
    const h = harness('shrine'); h.hold([shrinePair()[0]], 2000); expect(h.fires).toBe(0);
    h.hold(shrinePair(), 1800); expect(h.fires).toBe(1);
    h.hold(shrinePair(), 10000); expect(h.fires).toBe(1);
    h.hold(openPair(), 700); expect(h.last.phase).toBe('ready');
  });
  it('a pause discards the prepared slash', () => {
    const h = harness('dismantle'); h.hold([trackedPose('red', .4)], 700); h.recognizer.interrupt();
    expect(h.recognizer.currentStep).toBe(0);
  });
  it('cannot continue a swipe across a gap without camera samples', () => {
    const h = harness('dismantle'); h.hold([trackedPose('red', .4)], 700);
    const result = h.recognizer.update(handFrame(1800, [trackedPose('red', .4)]));
    expect(result.stepIndex).toBe(0); expect(result.fire).toBe(false);
  });
});

it('Sukuna effect timelines fade, finish and disable debug gameplay forces', () => {
  for (const key of SUKUNA_KEYS) {
    const duration = TECHNIQUES[key].effectMs;
    expect(sukunaTimeline(key, duration, duration, false).fade).toBe(0);
    expect(sukunaTimeline(key, 1500, duration, true).impact).toBe(0);
  }
  expect(sukunaTimeline('shrine', 2000, 8000, false).shrine).toBe(1);
});
