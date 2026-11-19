import { describe, expect, it } from 'vitest';
import { GestureGate } from '../src/core/GestureGate';
import { BLUE } from '../src/core/techniques';
import type { GateSample } from '../src/core/types';

const pose = (t: number, patch: Partial<GateSample> = {}): GateSample => ({
  valid: true, usable: true, open: false, trackId: 1, capturedAt: t, ...patch,
});
function charge(gate: GestureGate, from = 0, until = 1200): number {
  let fires = 0;
  for (let t = from; t <= until; t += 50) if (gate.update(t, pose(t)).fire) fires++;
  return fires;
}

describe('GestureGate real-time rules', () => {
  it('never fires from one frame', () => expect(new GestureGate(BLUE.timing).update(0, pose(0)).fire).toBe(false));
  it('fires after a sustained hold and only once', () => {
    const gate = new GestureGate(BLUE.timing); expect(charge(gate, 0, 8000)).toBe(1);
    expect(gate.snapshot(8000).phase).toBe('release');
  });
  it('cannot accumulate with an invalid visible pose', () => {
    const gate = new GestureGate(BLUE.timing); charge(gate, 0, 600);
    expect(gate.update(650, pose(650, { valid: false })).progress).toBe(0);
  });
  it('pauses a short loss without crediting time', () => {
    const gate = new GestureGate(BLUE.timing); charge(gate, 0, 500);
    const before = gate.snapshot(500).progress;
    expect(gate.update(550, pose(550, { usable: false, valid: false })).progress).toBe(before);
    expect(gate.update(600, pose(600)).progress).toBe(before);
  });
  it('resets after prolonged loss', () => {
    const gate = new GestureGate(BLUE.timing); charge(gate, 0, 500);
    expect(gate.update(900, pose(900, { usable: false, valid: false })).progress).toBe(0);
  });
  it('does not credit a long gap between valid frames', () => {
    const gate = new GestureGate(BLUE.timing); charge(gate, 0, 500);
    expect(gate.update(5000, pose(5000)).progress).toBe(0);
  });
  it('rejects old, repeated, future or non-monotonic frames', () => {
    const gate = new GestureGate(BLUE.timing); gate.update(0, pose(0));
    expect(gate.update(1000, pose(100)).progress).toBe(0);
    expect(gate.update(1050, pose(100)).progress).toBe(0);
    expect(gate.update(1100, pose(1200)).progress).toBe(0);
    expect(gate.update(100, pose(100)).fire).toBe(false);
  });
  it('does not combine charge from different hands', () => {
    const gate = new GestureGate(BLUE.timing); charge(gate, 0, 1000);
    expect(gate.update(1050, pose(1050, { trackId: 2 })).progress).toBe(0);
  });
  it('cannot release with no hand or a fist', () => {
    const gate = new GestureGate(BLUE.timing); charge(gate); gate.update(3500, pose(3500));
    for (let t = 3550; t < 5000; t += 50) gate.update(t, pose(t, { usable: false, valid: false }));
    for (let t = 5000; t < 6500; t += 50) gate.update(t, pose(t, { valid: false }));
    expect(gate.snapshot(6500).phase).toBe('release');
  });
  it('requires 500 ms of a continuously observed open hand', () => {
    const gate = new GestureGate(BLUE.timing); charge(gate); gate.update(3500, pose(3500));
    for (let t = 3550; t <= 4000; t += 50) gate.update(t, pose(t, { valid: false, open: true }));
    expect(gate.snapshot(4000).phase).toBe('release');
    gate.update(4050, pose(4050, { valid: false, open: true }));
    expect(gate.snapshot(4050).phase).toBe('ready');
    expect(charge(gate, 4100, 5350)).toBe(1);
  });
  it('does not preserve a partial release through a gap', () => {
    const gate = new GestureGate(BLUE.timing); charge(gate); gate.update(3500, pose(3500));
    for (let t = 3550; t <= 3800; t += 50) gate.update(t, pose(t, { valid: false, open: true }));
    expect(gate.update(5000, pose(5000, { valid: false, open: true })).releaseProgress).toBe(0);
    expect(gate.snapshot(5000).phase).toBe('release');
  });
  it('discards charge on pause', () => {
    const gate = new GestureGate(BLUE.timing); charge(gate, 0, 1100); gate.interrupt();
    expect(gate.update(9000, pose(9000)).progress).toBe(0);
  });
  it('cannot transfer a partial charge to another hand after a short loss', () => {
    const gate = new GestureGate(BLUE.timing); charge(gate, 0, 1000);
    gate.update(1050, pose(1050, { usable: false, valid: false, trackId: null }));
    expect(gate.update(1100, pose(1100, { trackId: 2 })).progress).toBe(0);
  });
  it('cannot bypass recovery or release by pausing', () => {
    const gate = new GestureGate(BLUE.timing); charge(gate); gate.interrupt();
    expect(gate.update(2000, pose(2000)).phase).toBe('cooldown'); gate.interrupt();
    expect(gate.update(5000, pose(5000)).phase).toBe('release');
    expect(charge(gate, 5050, 9000)).toBe(0);
  });
});
