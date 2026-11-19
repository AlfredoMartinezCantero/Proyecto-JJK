import type { HandFrame, HandObservation, Point, TrackedHand } from '../src/core/types';
import type { ShadowPose } from '../src/core/shadowConfig';

export function openHand(offset = 0): Point[] {
  const hand = Array.from({ length: 21 }, () => ({ x: .5 + offset, y: .55, z: 0 }));
  hand[0] = { x: .5 + offset, y: .85, z: 0 };
  [5, 9, 13, 17].forEach((base, j) => {
    const x = .3 + j * .12 + offset;
    [0, 1, 2, 3].forEach((n) => { hand[base + n] = { x, y: .6 - n * .15, z: 0 }; });
  });
  hand[1] = { x: .32 + offset, y: .72, z: 0 };
  hand[2] = { x: .23 + offset, y: .64, z: 0 };
  hand[3] = { x: .2 + offset, y: .55, z: 0 };
  hand[4] = { x: .18 + offset, y: .49, z: 0 };
  return hand;
}
export function blueHand(offset = 0): Point[] {
  const hand = openHand(offset);
  for (const base of [13, 17]) {
    const x = hand[base].x;
    hand[base + 2] = { x: x + .05, y: .57, z: -.02 };
    hand[base + 3] = { x: x + .08, y: .65, z: -.04 };
  }
  return hand;
}
export function observation(offset = 0): HandObservation {
  return { landmarks: blueHand(offset), handedness: 'Right', handednessScore: .9 };
}

export function poseHand(pose: 'blue' | 'red' | 'purple' | 'domain' | 'open' | 'fist' | 'bow' | 'wolf', x = .5, scale = .42): Point[] {
  const hand = openHand();
  const extended = pose === 'open' ? 4 : pose === 'fist' ? 0 : pose === 'red' || pose === 'bow' ? 1 : pose === 'purple' ? 3 : 2;
  [5, 9, 13, 17].forEach((base, finger) => {
    if (pose === 'wolf' ? finger === 0 || finger === 3 : finger < extended) return;
    const baseX = hand[base].x;
    hand[base + 2] = { x: baseX + .05, y: .57, z: -.02 };
    hand[base + 3] = { x: baseX + .08, y: .65, z: -.04 };
  });
  if (pose === 'domain') {
    for (let i = 0; i < 4; i++) {
      hand[5 + i].x = .3 + i / 3 * .04;
      hand[9 + i].x = .42 - i / 3 * .04;
    }
  }
  if (pose === 'bow') {
    hand[3] = { ...hand[2], x: hand[2].x - .08 };
    hand[4] = { ...hand[2], x: hand[2].x - .16 };
  }
  return hand.map(p => ({ x: x + (p.x - .5) * scale, y: .74 + (p.y - .85) * scale, z: p.z * scale }));
}
export function trackedPose(pose: Parameters<typeof poseHand>[0], x = .5, id = 1): TrackedHand {
  const points = poseHand(pose, x);
  return { id, raw: points, landmarks: points, handedness: 'Right', handednessScore: .9 };
}
export function handFrame(time: number, hands: TrackedHand[]): HandFrame {
  return { capturedAt: time, receivedAt: time + 5, width: 960, height: 720, hands };
}
export const splitHands = () => [trackedPose('blue', .27, 1), trackedPose('red', .73, 2)];
export const mergedHands = () => [trackedPose('blue', .435, 1), trackedPose('red', .565, 2)];

/** Intended input examples, independent of the recognizer's pose table. */
export function shadowPair(pose:ShadowPose):TrackedHand[]{
  const signs:Record<ShadowPose,[Parameters<typeof poseHand>[0],Parameters<typeof poseHand>[0]]>={
    hounds:['wolf','wolf'],'nue-gather':['open','open'],'nue-spread':['open','open'],
    'totality-gather':['wolf','wolf'],'totality-release':['wolf','wolf'],'toad-sign':['blue','open'],
    'elephant-gather':['open','open'],'elephant-release':['fist','open'],'rabbit-sign':['blue','blue'],
    ritual:['fist','fist'],'chimera-gather':['fist','fist'],'chimera-release':['open','open'],
  };
  const wide=['nue-spread','totality-release','elephant-release','chimera-release'].includes(pose);
  return [trackedPose(signs[pose][0],wide?.27:.435,1),trackedPose(signs[pose][1],wide?.73:.565,2)];
}
