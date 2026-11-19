import { describe, expect, it } from 'vitest';
import { HandContinuity } from '../src/core/HandContinuity';
import { OneEuroFilter } from '../src/core/OneEuroFilter';
import { observation } from './fixtures';

describe('hand association before smoothing', () => {
  it('preserves identities when detector array order changes', () => {
    const continuity = new HandContinuity();
    const first = continuity.update([observation(-.2), observation(.2)], 0);
    const second = continuity.update([observation(.2), observation(-.2)], 50);
    expect(second[0].id).toBe(first[1].id); expect(second[1].id).toBe(first[0].id);
  });
  it('creates a new identity after a large jump', () => {
    const continuity = new HandContinuity();
    const first = continuity.update([observation(-.2)], 0)[0];
    const second = continuity.update([observation(.2)], 50)[0];
    expect(second.id).not.toBe(first.id);
  });
  it('does not reuse smoothing across a long tracking loss', () => {
    const continuity = new HandContinuity();
    const first = continuity.update([observation()], 0)[0];
    const second = continuity.update([observation(.05)], 1000)[0];
    expect(second.id).not.toBe(first.id); expect(second.landmarks[0].x).toBe(second.raw[0].x);
  });
  it('resets ambiguous overlapping tracks instead of mixing fingers', () => {
    const continuity = new HandContinuity();
    const first = continuity.update([observation(-.05), observation(.05)], 0);
    const second = continuity.update([observation()], 50);
    expect(first.map(h => h.id)).not.toContain(second[0].id);
  });
  it('drops malformed detections', () => {
    const continuity = new HandContinuity(), hand = observation(); hand.landmarks[0].z = NaN;
    expect(continuity.update([hand], 0)).toEqual([]);
  });
});

describe('One Euro', () => {
  it('returns the first value without lag', () => expect(new OneEuroFilter().filter(.3, 0)).toBe(.3));
  it('reduces a sudden change while retaining its direction', () => {
    const filter = new OneEuroFilter(); filter.filter(0, 0);
    const value = filter.filter(1, 50); expect(value).toBeGreaterThan(0); expect(value).toBeLessThan(1);
  });
  it('resets across a long interruption', () => {
    const filter = new OneEuroFilter(); filter.filter(0, 0); expect(filter.filter(1, 1000)).toBe(1);
  });
});
