import type { HandFrame, Point, TrackedHand } from './types';
import { SWIPE_LIMITS as LIMITS } from './swipeConfig';

type Pixel = { x: number; y: number };
type Sample = { raw: Pixel; smooth: Pixel; time: number };
const pixels = (p: Point, frame: HandFrame): Pixel => ({ x: p.x * frame.width, y: p.y * frame.height });
const distance = (a: Pixel, b: Pixel) => Math.hypot(a.x - b.x, a.y - b.y);

export class SwipeTracker {
  private readonly startRaw: Pixel;
  private readonly startSmooth: Pixel;
  private lastRaw: Pixel;
  private lastSmooth: Pixel;
  private lastMotionX: number;
  private endRaw: Pixel | null = null;
  private endSmooth: Pixel | null = null;
  private readonly startedAt: number;
  private lastCaptured: number;
  private lastPoseAt: number;
  private motionSamples = 0;
  private qualified = false;
  private lateral = true;
  private settling: Sample[] = [];
  readonly scale: number;
  expired = false;
  complete = false;

  constructor(private readonly handId: number, hand: TrackedHand, frame: HandFrame) {
    // The user draws with the fingertip; the wrist can stay nearly stationary.
    this.startRaw = pixels(hand.raw[8], frame); this.startSmooth = pixels(hand.landmarks[8], frame);
    this.lastRaw = this.startRaw; this.lastSmooth = this.startSmooth;
    this.lastMotionX = this.startRaw.x;
    this.scale = Math.max(1, distance(pixels(hand.raw[0], frame), pixels(hand.raw[9], frame)));
    this.startedAt = this.lastCaptured = this.lastPoseAt = frame.capturedAt;
  }
  get progress(): number {
    const dx = this.lastRaw.x - this.startRaw.x, smoothDx = this.lastSmooth.x - this.startSmooth.x;
    return dx * smoothDx <= 0 ? 0 : Math.min(1, Math.min(Math.abs(dx), Math.abs(smoothDx)) / (this.scale * LIMITS.distancePalms));
  }
  get hint(): string {
    return !this.lateral ? 'Traza hacia un lado; reduce el movimiento vertical.' : this.complete ? 'Trazo reconocido. Mantén el índice un instante.' : this.qualified
      ? 'Trazo listo. Frena suavemente y conserva el índice extendido.'
      : `Trazo ${Math.round(this.progress * 100)}%. Mueve el índice hacia un lado.`;
  }
  private expire() { this.expired = true; this.complete = false; }

  update(hand: TrackedHand, frame: HandFrame, poseValid: boolean): void {
    if (this.expired || !Number.isFinite(frame.capturedAt) || frame.capturedAt <= this.lastCaptured) return;
    const gap = frame.capturedAt - this.lastCaptured; this.lastCaptured = frame.capturedAt;
    if (hand.id !== this.handId || gap > LIMITS.maxSampleGapMs) { this.expire(); return; }
    if (!poseValid) {
      // A short occlusion cannot earn charge, but it needn't erase the observed stroke.
      this.complete = false; this.settling = [];
      if (frame.capturedAt - this.lastPoseAt > LIMITS.poseGraceMs) this.expire();
      return;
    }
    this.lastPoseAt = frame.capturedAt;
    const raw = pixels(hand.raw[8], frame), smooth = pixels(hand.landmarks[8], frame);
    if (distance(raw, this.lastRaw) > this.scale * LIMITS.maxJumpPalms) { this.expire(); return; }
    const dx = raw.x - this.startRaw.x, smoothDx = smooth.x - this.startSmooth.x;
    const motion = raw.x - this.lastMotionX;
    if (Math.abs(motion) >= this.scale * LIMITS.minStepPalms && motion * dx > 0) { this.motionSamples++; this.lastMotionX = raw.x; }
    this.lastRaw = raw; this.lastSmooth = smooth;
    const dy = Math.abs(raw.y - this.startRaw.y), smoothDy = Math.abs(smooth.y - this.startSmooth.y);
    if (dy > this.scale * LIMITS.maxVerticalPalms || smoothDy > this.scale * LIMITS.maxVerticalPalms) { this.expire(); return; }
    this.lateral = dy <= Math.max(this.scale * .5, Math.abs(dx) * LIMITS.maxVerticalSlope) &&
      smoothDy <= Math.max(this.scale * .5, Math.abs(smoothDx) * LIMITS.maxVerticalSlope);
    if (this.qualified && (this.progress < .6 || !this.lateral)) { this.qualified = false; this.complete = false; this.settling = []; }
    if (this.complete) {
      if (distance(raw, this.endRaw!) <= this.scale * LIMITS.holdRadiusPalms && distance(smooth, this.endSmooth!) <= this.scale * LIMITS.holdRadiusPalms) return;
      // Finishing a longer stroke restarts only the final hold, never the preparation.
      this.complete = false; this.settling = [];
    }
    if (frame.capturedAt - this.startedAt > LIMITS.windowMs) { this.expire(); return; }
    if (!this.qualified && this.progress >= 1 && this.lateral && this.motionSamples >= LIMITS.minMotionSamples && frame.capturedAt - this.startedAt >= LIMITS.minMotionMs) this.qualified = true;
    if (!this.qualified) return;
    this.settling.push({ raw, smooth, time: frame.capturedAt });
    while (this.settling.length > 1 && this.settling[1].time <= frame.capturedAt - LIMITS.settleMs) this.settling.shift();
    const stable = frame.capturedAt - this.settling[0].time >= LIMITS.settleMs && this.settling.every(sample =>
      distance(raw, sample.raw) <= this.scale * LIMITS.settleRadiusPalms && distance(smooth, sample.smooth) <= this.scale * LIMITS.settleRadiusPalms);
    if (stable) { this.complete = true; this.endRaw = raw; this.endSmooth = smooth; }
  }
}
