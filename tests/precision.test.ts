import { describe, expect, it } from 'vitest';
import { evaluatePose } from '../src/core/gesture';
import { TechniqueRecognizer } from '../src/core/TechniqueRecognizer';
import { TECHNIQUES } from '../src/core/techniques';
import { handFrame, mergedHands, poseHand, splitHands, trackedPose } from './fixtures';
import type { Point, TrackedHand } from '../src/core/types';
import { validatePosePrecision } from '../src/core/posePrecision';
import precisionConfig from '../src/config/pose-precision.json';

function detailedHand(pose: 'red' | 'domain'): Point[] {
  const p = poseHand(pose);
  p[4] = { ...p[13] };
  if (pose === 'domain') {
    const a = p[5].x, b = p[9].x;
    const middle = (a + b) / 2;
    for (let j = 1; j <= 3; j++) {
      p[5 + j].x = a + (middle + .008 - a) * j / 3;
      p[9 + j].x = b + (middle - .008 - b) * j / 3;
    }
  }
  return p;
}
const tracked = (points: Point[]): TrackedHand => ({ ...trackedPose('domain'), raw: points, landmarks: points });
function prepared(hands: TrackedHand[]) {
  return hands.map(hand => { const p = hand.landmarks.map(v => ({ ...v })); p[4] = { ...p[13] };
    return { ...hand, raw: p, landmarks: p }; });
}

describe('optional detailed finger geometry, synthetic observations only', () => {
  it('rejects invalid detailed geometry configuration', () => {
    expect(() => validatePosePrecision(null)).toThrow();
    const config = structuredClone(precisionConfig); config.detailed.crossingMinJointAngle = NaN;
    expect(() => validatePosePrecision(config)).toThrow();
    const overlap = structuredClone(precisionConfig); overlap.detailed.thumbMaxPalmDistance = 1.1;
    expect(() => validatePosePrecision(overlap)).toThrow();
  });
  it('requires the folded thumb in detailed Red without changing playable Red', () => {
    expect(evaluatePose(poseHand('red'), 960, 720, 'red').valid).toBe(true);
    expect(evaluatePose(poseHand('red'), 960, 720, 'red', 'detailed').valid).toBe(false);
    expect(evaluatePose(detailedHand('red'), 960, 720, 'red', 'detailed').valid).toBe(true);
  });
  it('does not label two close parallel fingers as an observable crossing', () => {
    const p = poseHand('domain'); p[4] = { ...p[13] };
    expect(evaluatePose(p, 960, 720, 'domain', 'detailed').valid).toBe(false);
    expect(evaluatePose(p, 960, 720, 'domain').valid).toBe(true);
  });
  it('accepts a projected crossing with either mirrored hand', () => {
    const p = detailedHand('domain');
    const metric = evaluatePose(p, 960, 720, 'domain', 'detailed');
    expect(metric.valid, JSON.stringify(metric)).toBe(true);
    expect(evaluatePose(p.map(v => ({ ...v, x: 1 - v.x })), 960, 720, 'domain', 'detailed').valid).toBe(true);
  });
  it('uses a palm-local axis when the image is rotated', () => {
    const angle = .45, c = Math.cos(angle), s = Math.sin(angle);
    const p = detailedHand('domain').map(v => ({ x: .5 + (v.x - .5) * c - (v.y - .5) * s * 720 / 960,
      y: .5 + (v.x - .5) * s * 960 / 720 + (v.y - .5) * c, z: v.z }));
    expect(evaluatePose(p, 960, 720, 'domain', 'detailed').valid).toBe(true);
  });
  it('requires the raw points as well as smoothing to show the detailed pose', () => {
    const recognizer = new TechniqueRecognizer(TECHNIQUES.domain, 'detailed');
    const hand = tracked(detailedHand('domain')); hand.raw = poseHand('domain');
    for (let t = 0; t < 3000; t += 50) expect(recognizer.update(handFrame(t, [hand])).fire).toBe(false);
  });
  it('holds the detailed seal over multiple fresh frames before firing once', () => {
    const recognizer = new TechniqueRecognizer(TECHNIQUES.domain, 'detailed'); let fires = 0;
    for (let t = 0; t < 3000; t += 50) if (recognizer.update(handFrame(t, [tracked(detailedHand('domain'))])).fire) fires++;
    expect(fires).toBe(1);
  });
  it('changing precision discards a partial hold', () => {
    const recognizer = new TechniqueRecognizer(TECHNIQUES.red); const hand = tracked(detailedHand('red'));
    for (let t = 0; t <= 700; t += 50) recognizer.update(handFrame(t, [hand]));
    recognizer.setPrecision('detailed');
    expect(recognizer.update(handFrame(750, [hand])).progress).toBe(0);
  });
  it('changing precision preserves cooldown and the mandatory open release', () => {
    const recognizer = new TechniqueRecognizer(TECHNIQUES.red); const hand = tracked(detailedHand('red'));
    for (let t = 0; t <= 1100; t += 50) recognizer.update(handFrame(t, [hand]));
    recognizer.setPrecision('detailed'); expect(recognizer.snapshot(1200).phase).toBe('cooldown');
    expect(recognizer.update(handFrame(4000, [hand])).phase).toBe('release');
    expect(recognizer.update(handFrame(4050, [hand])).fire).toBe(false);
  });
  it('detailed Purple uses two fingers and an open thumb, preserving the standard alternative', () => {
    expect(evaluatePose(poseHand('blue'), 960, 720, 'purple', 'detailed').valid).toBe(true);
    expect(evaluatePose(poseHand('purple'), 960, 720, 'purple', 'detailed').valid).toBe(false);
    expect(evaluatePose(poseHand('purple'), 960, 720, 'purple').valid).toBe(true);
    const closed = poseHand('blue'); closed[4] = { ...closed[13] };
    expect(evaluatePose(closed, 960, 720, 'purple', 'detailed').valid).toBe(false);
  });
  it('detailed fusion requires both preparation thumbs folded', () => {
    const recognizer = new TechniqueRecognizer(TECHNIQUES.purple, 'detailed');
    expect(recognizer.inspect(handFrame(0, splitHands())).valid).toBe(false);
    expect(recognizer.inspect(handFrame(50, prepared([splitHands()[0]]))).valid).toBe(true);
  });
  it('completes detailed Purple only after preparation, convergence and thumb opening', () => {
    const recognizer = new TechniqueRecognizer(TECHNIQUES.purple, 'detailed'); let now = 0, fires = 0;
    const hold = (hands: TrackedHand[], ms: number) => { for (let t = 0; t <= ms; t += 50) {
      now += 50; if (recognizer.update(handFrame(now, hands)).fire) fires++;
    } };
    hold(prepared([splitHands()[0]]), 3200); expect(recognizer.currentStep).toBe(1);
    hold(prepared(splitHands()), 2800); expect(recognizer.currentStep).toBe(2);
    hold(prepared(mergedHands()), 900); expect(recognizer.currentStep).toBe(3);
    hold(prepared(mergedHands()), 1200); expect(fires).toBe(0);
    hold([trackedPose('blue', .435, 1)], 1000); expect(fires).toBe(1);
  });
  it('a detailed projection cannot be supplied only by the smoothed thumb', () => {
    const recognizer = new TechniqueRecognizer(TECHNIQUES.purple, 'detailed'); let now = 0;
    for (const [hands, ms] of [[prepared([splitHands()[0]]), 3200], [prepared(splitHands()), 2800], [prepared(mergedHands()), 900]] as const)
      for (let t = 0; t <= ms; t += 50) { now += 50; recognizer.update(handFrame(now, hands)); }
    const hand = trackedPose('blue', .435, 1); hand.raw = hand.raw.map(p => ({ ...p })); hand.raw[4] = { ...hand.raw[13] };
    for (let t = 0; t <= 1500; t += 50) { now += 50; expect(recognizer.update(handFrame(now, [hand])).fire).toBe(false); }
  });
  it('the bow requires an open thumb at an angle to the index', () => {
    expect(evaluatePose(poseHand('bow'), 960, 720, 'bow').valid).toBe(true);
    expect(evaluatePose(poseHand('red'), 960, 720, 'bow').valid).toBe(false);
    expect(evaluatePose(detailedHand('red'), 960, 720, 'bow').valid).toBe(false);
    const p = poseHand('red');
    p[4] = { ...p[2], y: p[2].y - .18 };
    p[3] = { ...p[2], y: p[2].y - .09 };
    expect(evaluatePose(p, 960, 720, 'bow').valid).toBe(false);
  });
  it('the observed bow geometry accepts mirroring and planar rotation', () => {
    const p = poseHand('bow');
    expect(evaluatePose(p.map(v => ({ ...v, x: 1 - v.x })), 960, 720, 'bow').valid).toBe(true);
    const a = .6, c = Math.cos(a), s = Math.sin(a);
    const rotated = p.map(v => ({ x: .5 + (v.x - .5) * c - (v.y - .5) * s * 720 / 960,
      y: .5 + (v.x - .5) * s * 960 / 720 + (v.y - .5) * c, z: v.z }));
    expect(evaluatePose(rotated, 960, 720, 'bow').valid).toBe(true);
  });
  it.each([false, true])('completes the detailed bow using the original pair, swapped=%s', swapped => {
    const recognizer = new TechniqueRecognizer(TECHNIQUES.flame, 'detailed'); let now = 0, fires = 0;
    for (let t = 0; t <= 800; t += 50) { now += 50;
      recognizer.update(handFrame(now, [trackedPose('open', .27, 1), trackedPose('open', .73, 2)])); }
    expect(recognizer.currentStep).toBe(1);
    const hands = swapped ? [trackedPose('bow', .27, 1), trackedPose('fist', .73, 2)] :
      [trackedPose('fist', .27, 1), trackedPose('bow', .73, 2)];
    for (let t = 0; t <= 900; t += 50) { now += 50; if (recognizer.update(handFrame(now, hands)).fire) fires++; }
    expect(fires).toBe(1);
  });
  it('detailed Fuga cannot be supplied only by the filtered open thumb', () => {
    const recognizer = new TechniqueRecognizer(TECHNIQUES.flame, 'detailed'); let now = 0;
    for (let t = 0; t <= 800; t += 50) { now += 50;
      recognizer.update(handFrame(now, [trackedPose('open', .27, 1), trackedPose('open', .73, 2)])); }
    const bow = trackedPose('bow', .73, 2); bow.raw = detailedHand('red').map(v => ({ ...v, x: v.x + .23 }));
    for (let t = 0; t < 1800; t += 50) { now += 50;
      expect(recognizer.update(handFrame(now, [trackedPose('fist', .27, 1), bow])).fire).toBe(false); }
  });
});
