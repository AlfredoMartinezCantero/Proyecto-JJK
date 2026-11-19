import { describe, expect, it } from 'vitest';
import { TechniqueRecognizer, type TechniqueResult } from '../src/core/TechniqueRecognizer';
import { TECHNIQUES } from '../src/core/techniques';
import { evaluatePose } from '../src/core/gesture';
import type { Point, TrackedHand } from '../src/core/types';
import { handFrame, poseHand, trackedPose } from './fixtures';

function practice() {
  const recognizer = new TechniqueRecognizer(TECHNIQUES.dismantle);
  let time = -50, fires = 0, last: TechniqueResult;
  const frame = (hand: TrackedHand) => {
    time += 50; last = recognizer.update(handFrame(time, [hand]));
    if (last.fire) fires++;
    return last;
  };
  const hold = (hand: TrackedHand, ms: number) => { for (let i = 0; i <= ms / 50; i++) frame(hand); };
  return { recognizer, frame, hold, get fires() { return fires; }, get last() { return last; } };
}
function move(hand: TrackedHand, y: number) {
  const points = hand.raw.map(p => ({ ...p, y: p.y + y }));
  return { ...hand, raw: points, landmarks: points };
}
function rotate(points: Point[], pivot: number, joints: number[], radians: number): Point[] {
  const result = points.map(p => ({ ...p })), at = points[pivot], c = Math.cos(radians), s = Math.sin(radians);
  for (const i of joints) {
    const x = (points[i].x - at.x) * 960, y = (points[i].y - at.y) * 720;
    result[i].x = at.x + (x * c - y * s) / 960;
    result[i].y = at.y + (x * s + y * c) / 720;
  }
  return result;
}
function point(radians: number): TrackedHand {
  const hand = trackedPose('red', .4), points = rotate(hand.raw, 5, [6, 7, 8], radians);
  return { ...hand, raw: points, landmarks: points };
}
const shortStroke = (h: ReturnType<typeof practice>) => { for (const x of [.427, .454, .48]) h.frame(trackedPose('red', x)); };

describe('natural Desmantelar input with synthetic landmarks', () => {
  it('accepts a fingertip stroke while the wrist remains fixed', () => {
    const h = practice(); h.hold(point(0), 700);
    for (const angle of [.1, .2, .3, .4, .5, .6, .7]) h.frame(point(angle));
    expect(point(0).raw[0]).toEqual(point(.7).raw[0]);
    expect(h.fires).toBe(0); h.hold(point(.7), 800); expect(h.fires).toBe(1);
  });
  it('lets a long stroke continue beyond the minimum distance without restarting preparation', () => {
    const h = practice(); h.hold(trackedPose('red', .25), 700);
    for (let i = 1; i <= 12; i++) {
      h.frame(trackedPose('red', .25 + i * .025));
      expect(h.recognizer.currentStep).toBe(1); expect(h.fires).toBe(0);
    }
    h.hold(trackedPose('red', .55), 800); expect(h.fires).toBe(1);
  });
  it('accepts a slow continuous stroke made of small movements', () => {
    const h = practice(); h.hold(trackedPose('red', .4), 700);
    for (let i = 1; i <= 50; i++) h.frame(trackedPose('red', .4 + i * .0016));
    expect(h.fires).toBe(0); h.hold(trackedPose('red', .48), 800); expect(h.fires).toBe(1);
  });
  it('does not turn ordinary fingertip jitter into a stroke', () => {
    const h = practice(); h.hold(trackedPose('red', .4), 700);
    for (let i = 0; i < 80; i++) h.frame(trackedPose('red', .4 + Math.sin(i * 1.7) * .005));
    expect(h.fires).toBe(0);
  });
  it('restarts only the final hold when the user continues an already settling stroke', () => {
    const h = practice(); h.hold(trackedPose('red', .4), 700); shortStroke(h);
    h.hold(trackedPose('red', .48), 250); expect(h.last.progress).toBeGreaterThan(0);
    for (const x of [.5, .525, .55]) h.frame(trackedPose('red', x));
    expect(h.recognizer.currentStep).toBe(1); expect(h.fires).toBe(0);
    h.hold(trackedPose('red', .55), 800); expect(h.fires).toBe(1);
  });
  it('accepts a short stroke with a natural diagonal arc', () => {
    const h = practice(); h.hold(trackedPose('red', .4), 700);
    for (let i = 1; i <= 5; i++) h.frame(move(trackedPose('red', .4 + i * .02), i * .019));
    h.hold(move(trackedPose('red', .5), .095), 800); expect(h.fires).toBe(1);
  });
  it('waits for the filtered fingertip to catch up before completing a real stroke', () => {
    const h = practice(); h.hold(trackedPose('red', .4), 700);
    for (const x of [.427, .454, .48]) h.frame({ ...trackedPose('red', x), landmarks: poseHand('red', .4) });
    expect(h.last.progress).toBe(0); expect(h.fires).toBe(0);
    for (const x of [.427, .454, .48]) h.frame({ ...trackedPose('red', .48), landmarks: poseHand('red', x) });
    h.hold(trackedPose('red', .48), 800); expect(h.fires).toBe(1);
  });
  it('preserves an observed stroke through one invalid pose frame without charging that frame', () => {
    const h = practice(); h.hold(trackedPose('red', .4), 700); shortStroke(h);
    const invalid = h.frame(trackedPose('open', .48));
    expect(invalid.valid).toBe(false); expect(invalid.progress).toBe(0);
    expect(h.recognizer.currentStep).toBe(1); expect(h.fires).toBe(0);
    h.hold(trackedPose('red', .48), 800); expect(h.fires).toBe(1);
  });
  it('cancels a stroke when the wrong pose persists', () => {
    const h = practice(); h.hold(trackedPose('red', .4), 700); shortStroke(h);
    h.hold(trackedPose('open', .48), 300);
    expect(h.recognizer.currentStep).toBe(0); expect(h.fires).toBe(0);
    h.hold(trackedPose('red', .48), 900); expect(h.fires).toBe(0);
  });
  it('does not count movement made with an open hand even if the index pose returns at the endpoint', () => {
    const h = practice(); h.hold(trackedPose('red', .4), 700);
    for (const x of [.427, .454, .48]) h.frame(trackedPose('open', x));
    h.hold(trackedPose('red', .48), 900); expect(h.fires).toBe(0);
  });
  it('allows time to read the guide and then trace within the longer window', () => {
    const h = practice(); h.hold(trackedPose('red', .4), 700);
    h.hold(trackedPose('red', .4), 2100); expect(h.recognizer.currentStep).toBe(1);
    shortStroke(h); h.hold(trackedPose('red', .48), 800); expect(h.fires).toBe(1);
  });
  it('rejects an isolated moderate displacement after several stationary frames', () => {
    const h = practice(); h.hold(trackedPose('red', .4), 700);
    h.hold(trackedPose('red', .4), 300); h.frame(trackedPose('red', .505));
    h.hold(trackedPose('red', .505), 1100); expect(h.fires).toBe(0);
  });
  it('does not turn a purely vertical movement into a horizontal cut', () => {
    const h = practice(); h.hold(trackedPose('red', .4), 700);
    for (let i = 1; i <= 4; i++) h.frame(move(trackedPose('red', .4), i * .02));
    h.hold(move(trackedPose('red', .4), .08), 1000); expect(h.fires).toBe(0);
  });
  it('tolerates a slightly bent index only during tracing, keeping the preparation and other techniques strict', () => {
    const bent = rotate(poseHand('red'), 6, [7, 8], 34 * Math.PI / 180);
    expect(evaluatePose(bent, 960, 720, 'slash-sweep').valid).toBe(true);
    expect(evaluatePose(bent, 960, 720, 'blade').valid).toBe(false);
    expect(evaluatePose(bent, 960, 720, 'red').valid).toBe(false);
    expect(evaluatePose(poseHand('open'), 960, 720, 'slash-sweep').valid).toBe(false);
    expect(evaluatePose(poseHand('fist'), 960, 720, 'slash-sweep').valid).toBe(false);
  });
});
