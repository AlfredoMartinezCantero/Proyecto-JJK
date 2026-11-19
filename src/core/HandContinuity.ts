import { OneEuroFilter } from './OneEuroFilter';
import type { HandObservation, Point, TrackedHand } from './types';

interface Track { id: number; wrist: Point; seenAt: number; filters: OneEuroFilter[][] }
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export class HandContinuity {
  private tracks: Track[] = [];
  private nextId = 1;
  reset(): void { this.tracks = []; }

  update(observations: HandObservation[], time: number): TrackedHand[] {
    const hands = observations.filter(h => h.landmarks.length === 21 &&
      h.landmarks.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z))).slice(0, 2);
    this.tracks = this.tracks.filter(track => time - track.seenAt <= 250);
    const assignment = new Map<number, Track>();
    const candidates = this.tracks.flatMap(track => hands.map((hand, index) =>
      ({ track, index, distance: distance(track.wrist, hand.landmarks[0]) })));
    candidates.sort((a, b) => a.distance - b.distance);
    const used = new Set<number>();
    for (const candidate of candidates) {
      if (candidate.distance > .25 || assignment.has(candidate.index) || used.has(candidate.track.id)) continue;
      const ambiguous = candidates.some(other => other.track.id !== candidate.track.id &&
        other.index === candidate.index && Math.abs(other.distance - candidate.distance) < .018);
      if (ambiguous) continue; // Occlusion/crossing: start a new track rather than mixing fingers.
      assignment.set(candidate.index, candidate.track); used.add(candidate.track.id);
    }
    const updated: Track[] = [];
    const result = hands.map((hand, index) => {
      const track = assignment.get(index) ?? { id: this.nextId++, wrist: hand.landmarks[0], seenAt: time,
        filters: hand.landmarks.map(() => [new OneEuroFilter(), new OneEuroFilter(), new OneEuroFilter()]) };
      const landmarks = hand.landmarks.map((p, i) => ({
        x: track.filters[i][0].filter(p.x, time), y: track.filters[i][1].filter(p.y, time),
        z: track.filters[i][2].filter(p.z, time),
      }));
      track.wrist = { ...hand.landmarks[0] }; track.seenAt = time; updated.push(track);
      return { ...hand, raw: hand.landmarks, landmarks, id: track.id };
    });
    this.tracks = [...updated, ...this.tracks.filter(track => !updated.some(t => t.id === track.id))];
    return result;
  }
}
