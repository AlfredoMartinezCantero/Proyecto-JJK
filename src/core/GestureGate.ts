import type { GatePhase, GateResult, GateSample, Timing } from './types';

export class GestureGate {
  private phase: GatePhase = 'ready';
  private charge = 0;
  private release = 0;
  private until = 0;
  private lastTime: number | null = null;
  private lastValid: number | null = null;
  private chargedHand: GateSample['trackId'] = null;
  private previous: GateSample | null = null;

  constructor(private readonly timing: Timing) {}
  beginCooldown(now: number): void {
    this.phase = 'cooldown'; this.until = now + this.timing.cooldownMs;
    this.charge = 0; this.release = 0; this.lastTime = null; this.lastValid = null; this.previous = null; this.chargedHand = null;
  }

  reset(): void {
    this.phase = 'ready'; this.charge = 0; this.release = 0; this.until = 0;
    this.lastTime = null; this.lastValid = null; this.previous = null; this.chargedHand = null;
  }

  // Pausing discards the charge, but never bypasses the release after a spell.
  interrupt(): void {
    if (this.phase === 'holding' || this.phase === 'paused') this.phase = 'ready';
    this.charge = 0; this.release = 0; this.lastTime = null;
    this.lastValid = null; this.previous = null; this.chargedHand = null;
  }

  snapshot(now: number, fire = false): GateResult {
    return { phase: this.phase, progress: fire ? 1 : this.charge / this.timing.holdMs,
      releaseProgress: this.release / this.timing.releaseMs,
      cooldownRemaining: Math.max(0, this.until - now), fire };
  }

  update(now: number, sample: GateSample): GateResult {
    if (!Number.isFinite(now) || (this.lastTime !== null && now <= this.lastTime)) {
      return this.snapshot(this.lastTime ?? 0);
    }
    const gap = this.lastTime === null ? 0 : now - this.lastTime;
    const dt = this.lastTime === null ? 0 : Math.min(100, gap);
    const previous = this.previous;
    this.lastTime = now;
    // Old or future frames cannot contribute to recognition.
    const fresh = now - sample.capturedAt <= 200 && sample.capturedAt <= now &&
      (previous === null || sample.capturedAt > previous.capturedAt);
    const current = fresh ? sample : { ...sample, usable: false, valid: false, open: false };
    this.previous = current;

    if (this.phase === 'cooldown') {
      if (now < this.until) return this.snapshot(now);
      this.phase = 'release'; this.release = 0;
      return this.snapshot(now);
    }
    if (this.phase === 'release') {
      const continuous = gap <= this.timing.lostGraceMs && previous?.usable && previous.open &&
        previous.trackId === current.trackId;
      this.release = current.usable && current.open && !current.valid ? (continuous ? this.release + dt : 0) : 0;
      if (this.release >= this.timing.releaseMs) {
        this.phase = 'ready'; this.release = 0; this.lastValid = null;
      }
      return this.snapshot(now);
    }
    if (this.lastValid !== null && now - this.lastValid > this.timing.lostGraceMs) this.charge = 0;
    if (current.valid && current.usable) {
      const continuous = previous?.valid && previous.usable && previous.trackId === current.trackId &&
        gap <= this.timing.lostGraceMs;
      if (this.chargedHand !== null && this.chargedHand !== current.trackId) this.charge = 0;
      this.chargedHand = current.trackId;
      this.charge += continuous ? dt : 0;
      this.lastValid = now;
      this.phase = 'holding';
      if (this.charge >= this.timing.holdMs) {
        this.phase = 'cooldown'; this.until = now + this.timing.cooldownMs;
        this.charge = 0; this.release = 0;
        return this.snapshot(now, true);
      }
    } else if (current.usable) {
      this.charge = 0; this.lastValid = null; this.chargedHand = null; this.phase = 'ready';
    } else {
      this.phase = this.charge > 0 ? 'paused' : 'ready';
    }
    return this.snapshot(now);
  }
}
