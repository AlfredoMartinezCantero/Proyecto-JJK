import { describe, expect, it } from 'vitest';
import { TECHNIQUES } from '../src/core/techniques';
import { TechniqueRecognizer, type TechniqueResult } from '../src/core/TechniqueRecognizer';
import type { TechniqueKey, TrackedHand } from '../src/core/types';
import { handFrame, mergedHands, poseHand, splitHands, trackedPose } from './fixtures';

function harness(key: TechniqueKey) {
  const recognizer = new TechniqueRecognizer(TECHNIQUES[key]);
  let time = -50, fires = 0, last: TechniqueResult;
  return { recognizer, get time() { return time; }, get fires() { return fires; }, get last() { return last; },
    hold(hands: TrackedHand[], milliseconds: number) {
      for (let i = 0; i <= milliseconds / 50; i++) {
        time += 50; last = recognizer.update(handFrame(time, hands)); if (last.fire) fires++;
      }
      return last!;
    },
    at(timeMs: number, hands: TrackedHand[]) {
      time = timeMs; last = recognizer.update(handFrame(time, hands)); if (last.fire) fires++; return last;
    },
  };
}

function charge(h: ReturnType<typeof harness>) {
  h.hold([splitHands()[0]], TECHNIQUES.purple.steps[0].holdMs);
  h.hold(splitHands(), TECHNIQUES.purple.steps[1].holdMs);
}

describe('multi-technique recognition with synthetic landmarks', () => {
  it.each(['blue', 'red', 'domain'] as const)('holds %s once and requires a visible release', key => {
    const h = harness(key), hands = [trackedPose(key)];
    h.hold(hands, TECHNIQUES[key].timing.holdMs); expect(h.fires).toBe(1);
    h.hold(hands, TECHNIQUES[key].timing.cooldownMs + 1500); expect(h.fires).toBe(1);
    h.hold([], 1000); h.hold([trackedPose('fist')], 1000); expect(h.last.phase).toBe('release');
    h.hold([trackedPose('open')], TECHNIQUES[key].timing.releaseMs + 50); expect(h.last.phase).toBe('ready');
    h.hold(hands, TECHNIQUES[key].timing.holdMs + 50); expect(h.fires).toBe(2);
  });
  it('one frame cannot activate any lesson', () => {
    for (const key of ['blue', 'red', 'fusion', 'purple', 'domain'] as const) {
      const h = harness(key); h.at(0, key === 'fusion' || key === 'purple' ? splitHands() : [trackedPose(key)]);
      expect(h.fires).toBe(0);
    }
  });
  it('fuses only after separated hands then convergence', () => {
    const h = harness('fusion'); charge(h);
    expect(h.fires).toBe(0); expect(h.recognizer.currentStep).toBe(2);
    h.hold(mergedHands(), 900); expect(h.fires).toBe(1); expect(h.last.phase).toBe('cooldown');
  });
  it('cannot skip directly to convergence', () => {
    const h = harness('fusion'); h.hold(mergedHands(), 4000);
    expect(h.fires).toBe(0); expect(h.recognizer.currentStep).toBe(0);
  });
  it('requires a different second hand to add Rojo after Azul', () => {
    const h = harness('fusion'); h.hold([splitHands()[0]], 3200);
    h.hold([trackedPose('blue', .27, 1), trackedPose('blue', .73, 2)], 1500);
    expect(h.recognizer.currentStep).toBe(1); expect(h.fires).toBe(0);
  });
  it.each(['fusion', 'purple'] as const)('%s keeps Azul complete while the user brings the second hand into view', key => {
    const h = harness(key), blue = [splitHands()[0]];
    h.hold(blue, 3200); expect(h.recognizer.currentStep).toBe(1);
    h.hold(blue, 2000); expect(h.recognizer.currentStep).toBe(1); expect(h.fires).toBe(0);
    h.hold(splitHands(), 2800); expect(h.recognizer.currentStep).toBe(2);
    h.hold(mergedHands(), 900);
    if (key === 'purple') h.hold([trackedPose('purple', .435, 1)], 1000);
    expect(h.fires).toBe(1);
  });
  it('waiting for Rojo never advances by itself, and losing the original Azul still resets the sequence', () => {
    const h = harness('purple'), blue = [splitHands()[0]];
    h.hold(blue, 3200); h.hold(blue, 2000);
    expect(h.recognizer.currentStep).toBe(1); expect(h.last.valid).toBe(false); expect(h.last.primaryId).toBe(1);
    expect(h.last.tracked).toBe(true); expect(h.last.progress).toBe(0);
    h.hold([], 350); expect(h.recognizer.currentStep).toBe(0); expect(h.fires).toBe(0);
  });
  it.each(['fusion', 'purple'] as const)('%s rejects simultaneous Azul/Rojo and Rojo-first preparation', key => {
    const h = harness(key); h.hold(splitHands(), 5000);
    expect(h.recognizer.currentStep).toBe(0); expect(h.fires).toBe(0);
    h.hold([trackedPose('red')], 3500); expect(h.recognizer.currentStep).toBe(0);
    h.hold([splitHands()[0]], 3200); expect(h.recognizer.currentStep).toBe(1);
  });
  it('keeps roles when the detector reverses array order', () => {
    const h = harness('fusion'); charge(h); h.hold(mergedHands().reverse(), 900);
    expect(h.fires).toBe(1); expect(h.last.primaryId).toBe(1); expect(h.last.secondaryId).toBe(2);
  });
  it('does not exchange Azul and Rojo between hands mid-sequence', () => {
    const h = harness('fusion'); charge(h);
    h.hold([trackedPose('red', .435, 1), trackedPose('blue', .565, 2)], 1500); expect(h.fires).toBe(0);
  });
  it('requires raw and smoothed finger geometry', () => {
    const h = harness('red'), hand = trackedPose('red'); hand.raw = poseHand('blue');
    h.hold([hand], 2000); expect(h.fires).toBe(0);
  });
  it('requires raw and smoothed hand distances during convergence', () => {
    const h = harness('fusion'); charge(h);
    const hands = mergedHands(), far = splitHands(); hands[0].raw = far[0].raw; hands[1].raw = far[1].raw;
    h.hold(hands, 1500); expect(h.fires).toBe(0);
  });
  it('resets ordered phases after timeout', () => {
    const h = harness('purple'); charge(h);
    h.at(h.time + 10050, mergedHands()); expect(h.recognizer.currentStep).toBe(0); expect(h.fires).toBe(0);
  });
  it('resets a partial sequence after losing a required hand', () => {
    const h = harness('fusion'); charge(h);
    h.hold([mergedHands()[0]], 350); expect(h.recognizer.currentStep).toBe(0);
  });
  it('can restart the first phase with new tracking identities after a loss', () => {
    const h = harness('fusion'); h.hold([splitHands()[0]], 300); h.hold([], 350);
    const next = [splitHands()[0]].map(hand => ({ ...hand, id: hand.id + 10 }));
    h.hold(next, 3200); expect(h.recognizer.currentStep).toBe(1);
  });
  it('requires both palms open to release a bimanual technique', () => {
    const h = harness('fusion'); charge(h); h.hold(mergedHands(), 900);
    h.hold(mergedHands(), 4000); h.hold([trackedPose('open')], 1000); expect(h.last.phase).toBe('release');
    h.hold([trackedPose('open', .27, 1), trackedPose('open', .73, 2)], 700); expect(h.last.phase).toBe('ready');
  });
  it('does not rearm while the selected gesture is held in the other hand', () => {
    const h = harness('red'); h.hold([trackedPose('red')], 1000);
    h.hold([trackedPose('red', .27, 1), trackedPose('open', .73, 2)], 4500);
    expect(h.fires).toBe(1); expect(h.last.phase).toBe('release');
  });
  it('projects Púrpura only after all four phases and the final gesture', () => {
    const h = harness('purple'); charge(h); h.hold(mergedHands(), 900);
    expect(h.fires).toBe(0); expect(h.recognizer.currentStep).toBe(3);
    h.hold([trackedPose('purple', .435, 1)], 1000); expect(h.fires).toBe(1);
  });
  it('cannot use the Rojo hand for the final Púrpura gesture', () => {
    const h = harness('purple'); charge(h); h.hold(mergedHands(), 900);
    h.hold([trackedPose('blue', .435, 1), trackedPose('purple', .565, 2)], 1400); expect(h.fires).toBe(0);
  });
  it('does not count repeated or stale captures across a step transition', () => {
    const h = harness('fusion'); charge(h);
    const capturedAt = h.time;
    for (let t = h.time + 50; t < capturedAt + 1000; t += 50) expect(h.recognizer.update({ ...handFrame(t, mergedHands()), capturedAt }).fire).toBe(false);
    expect(h.recognizer.currentStep).toBe(2); expect(h.fires).toBe(0); expect(h.recognizer.snapshot(h.time + 1000).progress).toBe(0);
  });
  it('pausing discards partial fusion but preserves final recovery and release', () => {
    const h = harness('fusion'); charge(h); h.recognizer.interrupt();
    expect(h.recognizer.currentStep).toBe(0);
    charge(h); h.hold(mergedHands(), 900); expect(h.fires).toBe(1);
    h.recognizer.interrupt(); h.at(h.time + 5000, mergedHands()); expect(h.last.phase).toBe('release');
    h.hold(mergedHands(), 1500); expect(h.fires).toBe(1);
  });
});
