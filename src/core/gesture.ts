import { BLUE } from './techniques';
import { POSE_PRECISION } from './posePrecision';
import { SWIPE_LIMITS } from './swipeConfig';
import type { GestureMetrics, GesturePrecision, Point, SinglePose } from './types';

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export function jointAngle(a: Point, b: Point, c: Point): number {
  const ux = a.x - b.x, uy = a.y - b.y;
  const vx = c.x - b.x, vy = c.y - b.y;
  const length = Math.hypot(ux, uy) * Math.hypot(vx, vy);
  return length < 0.000001 ? 0 : Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / length))) * 180 / Math.PI;
}

function unusable(message: string): GestureMetrics {
  return { usable: false, valid: false, open: false, match: 0, message, angles: [], curls: [], palmPixels: 0, separation: 0 };
}

export function evaluateBlue(points: Point[] | undefined, width: number, height: number): GestureMetrics {
  if (!points || points.length !== 21 || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 ||
      points.some(p => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z))) {
    return unusable('Muestra una mano completa frente a la cámara.');
  }
  if (points.some(p => p.x < .025 || p.x > .975 || p.y < .025 || p.y > .975)) {
    return unusable('Mantén toda la mano dentro del encuadre.');
  }
  // Pixel coordinates compensate for the camera's aspect ratio.
  const p = points.map(value => ({ x: value.x * width, y: value.y * height, z: value.z }));
  const palmPixels = distance(p[0], p[9]);
  if (palmPixels < BLUE.gesture.minPalmPixels) return unusable('Acerca un poco la mano.');
  if (distance(p[5], p[17]) / palmPixels < BLUE.gesture.minPalmAspect) {
    return unusable('Orienta la palma hacia la cámara.');
  }
  const angles = [5, 9, 13, 17].map(i => jointAngle(p[i], p[i + 1], p[i + 2]));
  const tips = [5, 9, 13, 17].map(i => jointAngle(p[i + 1], p[i + 2], p[i + 3]));
  const curls = angles.map(value => clamp((180 - value) / 100));
  const separation = distance(p[8], p[12]) / palmPixels;
  const extended = angles[0] > BLUE.gesture.extendedAngle && angles[1] > BLUE.gesture.extendedAngle &&
    tips[0] > BLUE.gesture.extendedAngle && tips[1] > BLUE.gesture.extendedAngle;
  const folded = angles[2] < BLUE.gesture.foldedAngle && angles[3] < BLUE.gesture.foldedAngle;
  const spaced = separation > BLUE.gesture.minSeparation && separation < BLUE.gesture.maxSeparation;
  const valid = extended && folded && spaced;
  // This is a geometric similarity, not a calibrated probability.
  const match = [
    clamp((Math.min(angles[0], tips[0]) - 100) / 65),
    clamp((Math.min(angles[1], tips[1]) - 100) / 65),
    clamp((170 - angles[2]) / 65),
    clamp((170 - angles[3]) / 65),
    spaced ? 1 : 0,
  ].reduce((a, b) => a + b, 0) / 5;
  return {
    usable: true, valid, open: angles.every(a => a > 150) && tips.every(a => a > 150),
    match, angles, curls, palmPixels, separation,
    message: !extended ? 'Extiende índice y corazón.' : !folded ? 'Flexiona anular y meñique; pulgar libre.' :
      !spaced ? 'Ajusta la separación entre los dos dedos.' : 'Bien. Mantén el gesto sin forzar la mano.',
  };
}

export function evaluatePose(points: Point[] | undefined, width: number, height: number,
  pose: SinglePose, precision: GesturePrecision = 'standard'): GestureMetrics {
  if (pose === 'prepare-blue') pose = 'blue';
  const base = evaluateBlue(points, width, height);
  if (!base.usable || !points || pose === 'blue' && precision === 'standard') return base;
  const p = points.map(value => ({ x: value.x * width, y: value.y * height, z: value.z }));
  const dips = [5, 9, 13, 17].map(i => jointAngle(p[i + 1], p[i + 2], p[i + 3]));
  const template = pose === 'red' || pose === 'blade' || pose === 'slash-sweep' || pose === 'bow' ? [true, false, false, false] :
    pose === 'palm' ? [true, true, true, true] : pose === 'wolf' ? [true, false, false, true] : pose === 'fist' || pose === 'strike' ? [false, false, false, false] :
    pose === 'purple' && precision === 'standard' ? [true, true, true, false] : [true, true, false, false];
  const crossedDomain = pose === 'domain' && precision === 'detailed';
  const tracing = pose === 'slash-sweep';
  const extendedAngle = crossedDomain ? POSE_PRECISION.crossingMinJointAngle : tracing ? SWIPE_LIMITS.extendedAngle : BLUE.gesture.extendedAngle;
  const foldedAngle = tracing ? SWIPE_LIMITS.foldedAngle : BLUE.gesture.foldedAngle;
  const fingers = template.map((extended, i) => extended
    ? base.angles[i] > extendedAngle && dips[i] > extendedAngle
    : base.angles[i] < foldedAngle);
  const thumbDistance = distance(p[4], p[9]) / base.palmPixels;
  const thumbAngle = jointAngle(p[2], p[3], p[4]);
  const baseWidth = distance(p[5], p[9]);
  // Palm-local lateral axis: independent of mirroring, image rotation and hand size.
  // A reversal of the two tip positions is evidence of a projected crossing, not physical contact.
  const crossing = ((p[8].x - p[12].x) * (p[9].x - p[5].x) + (p[8].y - p[12].y) * (p[9].y - p[5].y)) /
    Math.max(1, baseWidth * base.palmPixels);
  const spaced = pose === 'domain' ? (crossedDomain ? crossing > POSE_PRECISION.crossingMinPalmDistance &&
    base.separation < POSE_PRECISION.crossingMaxTipSeparation : base.separation > .08 && base.separation < .55) :
    pose === 'blue' || pose === 'purple' && precision === 'detailed' ? base.separation > .12 && base.separation < 1.5 : true;
  const openThumb = pose === 'bow' || pose === 'purple' && precision === 'detailed';
  const thumb = openThumb ? thumbDistance > POSE_PRECISION.thumbOpenMinPalmDistance && thumbAngle > POSE_PRECISION.thumbOpenMinJointAngle :
    precision !== 'detailed' || !['blue', 'red', 'domain'].includes(pose) || thumbDistance < POSE_PRECISION.thumbMaxPalmDistance;
  const thumbX = p[4].x - p[2].x, thumbY = p[4].y - p[2].y;
  const fingerX = p[8].x - p[5].x, fingerY = p[8].y - p[5].y;
  const thumbAlignment = Math.abs(thumbX * fingerX + thumbY * fingerY) /
    Math.max(.001, Math.hypot(thumbX, thumbY) * Math.hypot(fingerX, fingerY));
  const bow = pose !== 'bow' || thumbAlignment < POSE_PRECISION.bowMaxFingerThumbAlignment;
  const scores = template.map((extended, i) => extended
    ? clamp((Math.min(base.angles[i], dips[i]) - 100) / 65)
    : clamp((170 - base.angles[i]) / 65));
  const names = ['índice', 'corazón', 'anular', 'meñique'];
  const wrong = fingers.findIndex(valid => !valid);
  return { ...base, thumbDistance, thumbAngle, thumbAlignment, crossing, valid: fingers.every(Boolean) && spaced && thumb && bow,
    match: (scores.reduce((a, b) => a + b, 0) + (spaced ? 1 : 0) + (thumb && bow ? 1 : 0)) / 6,
    message: wrong >= 0 ? `${template[wrong] ? 'Extiende' : 'Flexiona'} el ${names[wrong]}.` :
      !spaced ? crossedDomain ? 'Cruce no observable. Gira ligeramente la palma o usa el modo jugable; no fuerces los dedos.' :
        pose === 'domain' ? 'Acerca índice y corazón cómodamente, sin forzar el cruce.' : 'Separa ligeramente índice y corazón.' :
      !thumb ? openThumb ? 'Abre el pulgar cómodamente; mantén visibles sus articulaciones.' :
        'Recoge el pulgar sobre los dedos flexionados, sin apretar.' : !bow ? 'Forma una L cómoda con índice y pulgar.' : 'Bien. Mantén el gesto.',
  };
}
