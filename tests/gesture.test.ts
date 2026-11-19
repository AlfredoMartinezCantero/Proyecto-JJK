import { describe, expect, it } from 'vitest';
import { evaluateBlue, jointAngle } from '../src/core/gesture';
import { blueHand, openHand } from './fixtures';

describe('Blue geometry, with synthetic points', () => {
  it('accepts the adapted two-finger pose', () => expect(evaluateBlue(blueHand(), 960, 720).valid).toBe(true));
  it('works with mirrored coordinates', () => expect(evaluateBlue(blueHand().map(p => ({ ...p, x: 1 - p.x })), 960, 720).valid).toBe(true));
  it('rejects an open palm as an activation, and recognizes release', () => {
    const result = evaluateBlue(openHand(), 960, 720);
    expect(result.valid).toBe(false); expect(result.open).toBe(true);
  });
  it('does not mistake folded fingers for a release', () => expect(evaluateBlue(blueHand(), 960, 720).open).toBe(false));
  it('rejects a fist', () => {
    const hand = blueHand();
    for (const base of [5, 9]) {
      hand[base + 2] = { x: hand[base].x + .05, y: .57, z: 0 };
      hand[base + 3] = { x: hand[base].x + .08, y: .65, z: 0 };
    }
    const result = evaluateBlue(hand, 960, 720); expect(result.valid).toBe(false); expect(result.open).toBe(false);
  });
  it('checks the distal joint as well as the PIP joint', () => {
    const hand = blueHand(); hand[8] = { x: .38, y: .4, z: 0 };
    expect(evaluateBlue(hand, 960, 720).valid).toBe(false);
  });
  it('rejects an absent, partial, malformed or non-finite hand', () => {
    expect(evaluateBlue(undefined, 960, 720).usable).toBe(false);
    expect(evaluateBlue(blueHand().slice(0, 20), 960, 720).usable).toBe(false);
    const hand = blueHand(); hand[4].x = NaN;
    expect(evaluateBlue(hand, 960, 720).usable).toBe(false);
  });
  it('rejects hands outside the image', () => {
    const hand = blueHand(); hand[8].y = -.1;
    expect(evaluateBlue(hand, 960, 720).usable).toBe(false);
  });
  it('rejects small palms', () => {
    const hand = blueHand().map(p => ({ x: .5 + (p.x - .5) * .1, y: .5 + (p.y - .5) * .1, z: 0 }));
    expect(evaluateBlue(hand, 960, 720).usable).toBe(false);
  });
  it('rejects a palm seen in profile', () => {
    const hand = blueHand().map(p => ({ ...p, x: .5 + (p.x - .5) * .02 }));
    expect(evaluateBlue(hand, 960, 720).usable).toBe(false);
  });
  it('rejects invalid image dimensions', () => expect(evaluateBlue(blueHand(), 0, 720).usable).toBe(false));
  it('keeps a bounded, finite similarity metric', () => {
    const result = evaluateBlue(blueHand(), 960, 720);
    expect(result.match).toBeGreaterThanOrEqual(0); expect(result.match).toBeLessThanOrEqual(1);
    expect(result.curls.every(Number.isFinite)).toBe(true);
  });
  it('handles zero length joints without NaN', () => {
    const p = { x: 0, y: 0, z: 0 }; expect(jointAngle(p, p, p)).toBe(0);
  });
});
