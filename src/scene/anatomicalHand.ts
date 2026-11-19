import * as THREE from 'three';
import type { CharacterKey } from '../core/types';
import { HAND_CHAINS, HAND_REST } from './handSkeleton';

export const HAND_SHAPE = {
  gojo: { palm: 1, finger: 1, knuckle: 1.04, tip: .066, blend: .055, tendon: .007, creases: .28, outline: .0045 },
  sukuna: { palm: .94, finger: .93, knuckle: 1.28, tip: .052, blend: .035, tendon: .024, creases: .5, outline: .007 },
  yuji: { palm: 1.06, finger: 1.1, knuckle: 1.17, tip: .073, blend: .052, tendon: .013, creases: .35, outline: .0055 },
  megumi: { palm: .97, finger: .95, knuckle: 1.09, tip: .062, blend: .05, tendon: .011, creases: .32, outline: .005 },
};
const cache = new Map<CharacterKey, THREE.BufferGeometry>();
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (x: number) => { const t = clamp(x); return t * t * (3 - 2 * t); };
const blend = (a: number, b: number, k: number) => { const h = clamp(.5 + .5 * (b - a) / k); return b + (a - b) * h - k * h * (1 - h); };
type Segment = { a: THREE.Vector3; b: THREE.Vector3; x: number; y: number; z: number; length2: number; start: number; end: number; r0: number; r1: number };
function projection(x: number, y: number, z: number, s: Segment) {
  return clamp(((x - s.a.x) * s.x + (y - s.a.y) * s.y + (z - s.a.z) * s.z) / s.length2);
}
function segmentDistance(x: number, y: number, z: number, s: Segment, t: number) {
  return Math.hypot(x - s.a.x - s.x * t, y - s.a.y - s.y * t, z - s.a.z - s.z * t);
}
function lineDistance(x: number, y: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay, t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy));
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
}
const CREASES = [
  [[-.24, .62], [-.28, .46], [-.25, .29], [-.14, .14]],
  [[-.24, .52], [-.05, .45], [.12, .43], [.34, .48]],
  [[-.24, .66], [-.04, .64], [.17, .62], [.39, .58]],
  [[-.15, .035], [.02, .02], [.18, .05]],
];

/** Closed implicit skin: palm, thenar pad, webs, knuckles and fingers share vertices. */
export function createAnatomicalHand(character: CharacterKey): THREE.BufferGeometry {
  const cached = cache.get(character); if (cached) return cached.clone();
  const style = HAND_SHAPE[character], segments: Segment[] = [];
  HAND_CHAINS.forEach((chain, finger) => {
    const base = [.10, .083, .086, .079, .069][finger] * style.finger;
    const radii = [base * 1.1, base * style.knuckle, base * .86, style.tip * (finger === 0 ? 1.18 : finger === 4 ? .9 : 1)];
    for (let j = 0; j < 3; j++) {
      const a = HAND_REST[chain[j]], b = HAND_REST[chain[j + 1]], d = b.clone().sub(a);
      segments.push({ a, b, x: d.x, y: d.y, z: d.z, length2: d.lengthSq(), start: chain[j], end: chain[j + 1], r0: radii[j], r1: radii[j + 1] });
    }
  });
  const ellipsoid = (x: number, y: number, z: number, cx: number, cy: number, cz: number, rx: number, ry: number, rz: number) => {
    x -= cx; y -= cy; z -= cz;
    const k0 = Math.hypot(x / rx, y / ry, z / rz), k1 = Math.hypot(x / (rx * rx), y / (ry * ry), z / (rz * rz));
    return k1 < 1e-8 ? -Math.min(rx, ry, rz) : k0 * (k0 - 1) / k1;
  };
  const palm = (x: number, y: number, z: number) => {
    let d = ellipsoid(x, y, z, .055, .36, 0, .39 * style.palm, .43, .12);
    d = blend(d, ellipsoid(x, y, z, -.22, .22, -.012, .21 * style.palm, .29, .137), .075);
    d = blend(d, ellipsoid(x, y, z, .30, .27, 0, .21 * style.palm, .31, .12), .065);
    d = blend(d, ellipsoid(x, y, z, .08, .56, .005, .43 * style.palm, .245, .117), .06);
    return blend(d, ellipsoid(x, y, z, 0, -.045, 0, .18, .25, .115), .06);
  };
  const field = (x: number, y: number, z: number) => {
    let d = palm(x, y, z);
    for (const s of segments) { const t = projection(x, y, z, s); d = blend(d, segmentDistance(x, y, z, s, t) - (s.r0 + (s.r1 - s.r0) * t), style.blend); }
    return d;
  };
  const step = .022, min = [-1.01, -.39, -.24], size = [83, 111, 24];
  const [nx, ny, nz] = size, total = nx * ny * nz, values = new Float32Array(total);
  const at = (x: number, y: number, z: number) => (z * ny + y) * nx + x;
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) values[at(x, y, z)] = field(min[0] + x * step, min[1] + y * step, min[2] + z * step);
  const positions: number[] = [], triangles: number[] = [], edges = new Map<number, number>();
  const offsets = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
  const tetrahedra = [[0, 5, 1, 6], [0, 1, 2, 6], [0, 2, 3, 6], [0, 3, 7, 6], [0, 7, 4, 6], [0, 4, 5, 6]];
  const point = (id: number) => [min[0] + id % nx * step, min[1] + Math.floor(id / nx) % ny * step, min[2] + Math.floor(id / (nx * ny)) * step];
  const vertex = (a: number, b: number) => {
    const key = Math.abs(values[a]) < 1e-8 ? a : Math.abs(values[b]) < 1e-8 ? b : total + Math.min(a, b) * total + Math.max(a, b);
    let id = edges.get(key); if (id !== undefined) return id;
    const p = point(a), q = point(b), t = values[a] / (values[a] - values[b]);
    id = positions.length / 3; positions.push(...p.map((v, i) => v + (q[i] - v) * t)); edges.set(key, id); return id;
  };
  const emit = (a: number, b: number, c: number, out: number[]) => {
    if (a === b || a === c || b === c) return;
    const ax = positions[b * 3] - positions[a * 3], ay = positions[b * 3 + 1] - positions[a * 3 + 1], az = positions[b * 3 + 2] - positions[a * 3 + 2];
    const bx = positions[c * 3] - positions[a * 3], by = positions[c * 3 + 1] - positions[a * 3 + 1], bz = positions[c * 3 + 2] - positions[a * 3 + 2];
    if ((ay * bz - az * by) * out[0] + (az * bx - ax * bz) * out[1] + (ax * by - ay * bx) * out[2] < 0) triangles.push(a, c, b);
    else triangles.push(a, b, c);
  };
  for (let z = 0; z < nz - 1; z++) for (let y = 0; y < ny - 1; y++) for (let x = 0; x < nx - 1; x++) {
    const cube = offsets.map(o => at(x + o[0], y + o[1], z + o[2]));
    if (cube.every(i => values[i] >= 0) || cube.every(i => values[i] < 0)) continue;
    for (const tet of tetrahedra) {
      const ids = tet.map(i => cube[i]), inside = ids.filter(i => values[i] < 0), outside = ids.filter(i => values[i] >= 0);
      if (!inside.length || !outside.length) continue;
      const out = [0, 1, 2].map(axis => outside.reduce((sum, i) => sum + point(i)[axis], 0) / outside.length - inside.reduce((sum, i) => sum + point(i)[axis], 0) / inside.length);
      if (inside.length === 1) emit(...outside.map(i => vertex(inside[0], i)) as [number, number, number], out);
      else if (outside.length === 1) emit(...inside.map(i => vertex(i, outside[0])) as [number, number, number], out);
      else {
        const a = vertex(inside[0], outside[0]), b = vertex(inside[0], outside[1]), c = vertex(inside[1], outside[1]), d = vertex(inside[1], outside[0]);
        emit(a, b, c, out); emit(a, c, d, out);
      }
    }
  }
  const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(triangles);
  // Two opposing relaxation passes soften grid facets without shrinking the hand.
  const neighbors = Array.from({ length: positions.length/3 }, () => new Set<number>());
  for (let i = 0; i < triangles.length; i += 3) for (let j = 0; j < 3; j++) {
    const a = triangles[i+j], b = triangles[i+(j+1)%3]; neighbors[a].add(b); neighbors[b].add(a);
  }
  const surface = geometry.getAttribute('position'), relaxed = new Float32Array(surface.array.length);
  for (const factor of [.28, -.29]) {
    for (let i = 0; i < surface.count; i++) {
      let x = 0, y = 0, z = 0;
      neighbors[i].forEach(j => { x += surface.getX(j); y += surface.getY(j); z += surface.getZ(j); });
      const count = neighbors[i].size;
      relaxed[i*3] = surface.getX(i) + factor*(x/count-surface.getX(i));
      relaxed[i*3+1] = surface.getY(i) + factor*(y/count-surface.getY(i));
      relaxed[i*3+2] = surface.getZ(i) + factor*(z/count-surface.getZ(i));
    }
    surface.array.set(relaxed);
  }
  geometry.computeVertexNormals();
  const p = geometry.getAttribute('position'), n = geometry.getAttribute('normal');
  const colors: number[] = [], boneIndices: number[] = [], boneWeights: number[] = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    let tendon = Infinity;
    for (const joint of [5, 9, 13, 17]) tendon = Math.min(tendon, lineDistance(x, y, .015, .09, HAND_REST[joint].x, HAND_REST[joint].y));
    const dorsal = smooth(n.getZ(i)), palmar = smooth(-n.getZ(i));
    const tendonMask = Math.exp(-tendon * tendon / .00055) * smooth((y - .12) / .13) * (1 - smooth((y - .72) / .13));
    p.setZ(i, z + dorsal * style.tendon * tendonMask);
    let crease = Infinity;
    for (const path of CREASES) for (let j = 1; j < path.length; j++) crease = Math.min(crease, lineDistance(x, y, ...path[j - 1] as [number, number], ...path[j] as [number, number]));
    let jointCrease = Infinity;
    for (const chain of HAND_CHAINS) for (const joint of chain.slice(1, 3)) {
      const q = HAND_REST[joint], parent = HAND_REST[joint - 1], dx = q.x - parent.x, dy = q.y - parent.y;
      const len = Math.hypot(dx, dy), along = Math.abs(((x - q.x) * dx + (y - q.y) * dy) / len);
      if (Math.hypot(x - q.x, y - q.y) < .12) jointCrease = Math.min(jointCrease, along);
    }
    const ink = Math.max(palmar * (1 - smooth((crease - .004) / .017)), (palmar + dorsal * .25) * (1 - smooth((jointCrease - .003) / .013)), dorsal * tendonMask * (character === 'sukuna' ? .6 : .15));
    const shade = 1 - Math.min(1, ink) * style.creases;
    colors.push(shade, shade * .995, shade * .985);
    const distances = segments.map(s => {
      const t = projection(x, y, z, s);
      return { s, t, d: segmentDistance(x, y, z, s, t) - (s.r0 + (s.r1-s.r0)*t) };
    });
    const best = Math.min(...distances.map(v => v.d));
    const weights = new Map<number, number>(), upper = smooth((y - .25) / .58) * .85;
    weights.set(0, 1 - upper);
    const mcp = [5, 9, 13, 17];
    const right = Math.max(1, mcp.findIndex(j => HAND_REST[j].x > x));
    const a = x >= HAND_REST[17].x ? 17 : mcp[right-1], b = x >= HAND_REST[17].x ? 17 : mcp[right];
    const along = a === b ? 0 : clamp((x-HAND_REST[a].x)/(HAND_REST[b].x-HAND_REST[a].x));
    weights.set(a, upper*(1-along)); if (a !== b) weights.set(b, upper*along);
    // Only skin belonging to the fingers receives phalanx weights. Nearest-finger
    // switches across the palm must never pull its surface into different bones.
    const fingerBlend = smooth((palm(x, y, z) - best + style.blend) / (style.blend*2));
    weights.forEach((w, j) => weights.set(j, w * (1 - fingerBlend)));
    const proximity = distances.map(v => Math.exp(-(v.d-best)/.018)), totalProximity = proximity.reduce((a,b) => a+b, 0);
    distances.forEach(({ s, t }, j) => {
      const w = proximity[j]/totalProximity*fingerBlend;
      weights.set(s.start, (weights.get(s.start) ?? 0) + (1-t)*w);
      weights.set(s.end, (weights.get(s.end) ?? 0) + t*w);
    });
    const selected = [...weights].sort((a, b) => b[1] - a[1]).slice(0, 4), totalWeight = selected.reduce((s, v) => s + v[1], 0);
    for (let j = 0; j < 4; j++) { boneIndices.push(selected[j]?.[0] ?? 0); boneWeights.push((selected[j]?.[1] ?? 0) / totalWeight); }
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(boneIndices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(boneWeights, 4));
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  geometry.name = `${character} anatomical hand`; geometry.userData.character = character;
  cache.set(character, geometry); return geometry.clone();
}

export function createHandOutline(skin: THREE.BufferGeometry, character: CharacterKey) {
  const result = skin.clone(), p = result.getAttribute('position'), n = result.getAttribute('normal');
  for (let i = 0; i < p.count; i++) { const width = HAND_SHAPE[character].outline; p.setXYZ(i, p.getX(i) + n.getX(i) * width, p.getY(i) + n.getY(i) * width, p.getZ(i) + n.getZ(i) * width); }
  result.computeBoundingSphere(); return result;
}
