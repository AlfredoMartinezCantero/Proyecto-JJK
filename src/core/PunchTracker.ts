import type { HandFrame, Point, TrackedHand } from './types';

export const PUNCH_LIMITS = {
  distancePalms: .7, minAdvances: 3, minStepPalms: .06, minMotionMs: 150,
  maxJumpPalms: .65, maxGapMs: 200, windowMs: 3000, poseGraceMs: 180,
  settleMs: 120, settleRadiusPalms: .14, holdRadiusPalms: .3,
} as const;
type XY = { x: number; y: number };
const point = (p: Point, frame: HandFrame): XY => ({ x: p.x*frame.width, y: p.y*frame.height });
const distance = (a: XY, b: XY) => Math.hypot(a.x-b.x, a.y-b.y);

/** A visible, short lateral fist motion. Never interprets monocular z as a punch/contact. */
export class PunchTracker {
  private readonly start: XY[];
  private last: XY[];
  private advance: XY;
  private end: XY[] | null = null;
  private readonly began: number;
  private captured: number;
  private poseAt: number;
  private advances = 0;
  private settling: { points: XY[]; time: number }[] = [];
  private readonly scale: number;
  complete = false;
  expired = false;
  constructor(private readonly id: number, hand: TrackedHand, frame: HandFrame) {
    this.start = [point(hand.raw[9], frame), point(hand.landmarks[9], frame)];
    this.last = this.start; this.advance = this.start[0];
    this.scale = Math.max(1, distance(point(hand.raw[0], frame), this.start[0]));
    this.began = this.captured = this.poseAt = frame.capturedAt;
  }
  get progress() { return Math.min(1, ...this.last.map((p,i) => Math.abs(p.x-this.start[i].x)/(this.scale*PUNCH_LIMITS.distancePalms))); }
  get hint() { return this.complete ? 'Desplazamiento reconocido. Conserva el puño un instante.' :
    this.progress >= 1 ? 'Bien. Frena suavemente y conserva el puño.' : `Golpe ${Math.round(this.progress*100)}%. Desplaza el puño hacia un lado, sin acercarlo a la cámara.`; }
  private expire() { this.expired = true; this.complete = false; }
  update(hand: TrackedHand, frame: HandFrame, valid: boolean) {
    const now = frame.capturedAt;
    if (this.expired || !Number.isFinite(now) || now <= this.captured) return;
    const gap = now-this.captured; this.captured = now;
    if (hand.id !== this.id || gap > PUNCH_LIMITS.maxGapMs || !this.complete && now-this.began > PUNCH_LIMITS.windowMs) { this.expire(); return; }
    if (!valid) { this.complete = false; this.settling = []; if (now-this.poseAt > PUNCH_LIMITS.poseGraceMs) this.expire(); return; }
    this.poseAt = now;
    const next = [point(hand.raw[9], frame), point(hand.landmarks[9], frame)];
    if (next.some((p,i) => distance(p, this.last[i]) > this.scale*PUNCH_LIMITS.maxJumpPalms)) { this.expire(); return; }
    this.last = next;
    const dx = next[0].x-this.start[0].x, filteredDx = next[1].x-this.start[1].x;
    const lateral = next.every((p,i) => Math.abs(p.y-this.start[i].y) <= Math.max(this.scale*.45, Math.abs(p.x-this.start[i].x)*.9));
    if (dx*filteredDx <= 0 || !lateral || this.progress < .7) { this.complete = false; this.settling = []; }
    if (Math.abs(next[0].x-this.advance.x) >= this.scale*PUNCH_LIMITS.minStepPalms && (next[0].x-this.advance.x)*dx > 0) {
      this.advances++; this.advance = next[0];
    }
    if (this.complete) {
      if (next.every((p,i) => distance(p, this.end![i]) <= this.scale*PUNCH_LIMITS.holdRadiusPalms)) return;
      this.complete = false; this.settling = [];
    }
    if (this.progress < 1 || dx*filteredDx <= 0 || !lateral || this.advances < PUNCH_LIMITS.minAdvances || now-this.began < PUNCH_LIMITS.minMotionMs) return;
    this.settling.push({ points: next, time: now });
    while (this.settling.length > 1 && this.settling[1].time <= now-PUNCH_LIMITS.settleMs) this.settling.shift();
    if (now-this.settling[0].time >= PUNCH_LIMITS.settleMs && this.settling.every(s => next.every((p,i) => distance(p,s.points[i]) <= this.scale*PUNCH_LIMITS.settleRadiusPalms))) {
      this.complete = true; this.end = next;
    }
  }
}
