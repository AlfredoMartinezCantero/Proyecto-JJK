import * as THREE from 'three';

const EPS = 1e-5;
interface Vertex { p: THREE.Vector3; n: THREE.Vector3; c: THREE.Color; cap: number }
const key = (p: THREE.Vector3) => `${Math.round(p.x / EPS)},${Math.round(p.y / EPS)},${Math.round(p.z / EPS)}`;
const blend = (a: Vertex, b: Vertex, t: number): Vertex => ({ p: a.p.clone().lerp(b.p, t),
  n: a.n.clone().lerp(b.n, t).normalize(), c: a.c.clone().lerp(b.c, t), cap: a.cap + (b.cap - a.cap) * t });

/** Bake the actual visible surfaces in the target's local coordinates. Ink shells are excluded. */
export function bakeFractureGeometry(meshes: THREE.Mesh[], relativeTo: THREE.Object3D): THREE.BufferGeometry {
  relativeTo.updateWorldMatrix(true, true);
  const inverse = relativeTo.matrixWorld.clone().invert(), positions: number[] = [], normals: number[] = [], colors: number[] = [];
  for (const mesh of meshes) {
    const geometry = mesh.geometry, p = geometry.getAttribute('position'), n = geometry.getAttribute('normal'), index = geometry.getIndex();
    const matrix = inverse.clone().multiply(mesh.matrixWorld), normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
    const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
    const color = material.color ?? new THREE.Color('#705384');
    for (let j = 0; j < (index?.count ?? p.count); j++) {
      const i = index ? index.getX(j) : j;
      new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(matrix).toArray(positions, positions.length);
      new THREE.Vector3().fromBufferAttribute(n, i).applyNormalMatrix(normalMatrix).toArray(normals, normals.length);
      colors.push(color.r, color.g, color.b);
    }
  }
  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    .setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)).setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    .setAttribute('cutFace', new THREE.Float32BufferAttribute(new Float32Array(positions.length / 3), 1));
}

/** Triangle clipping with welded intersection loops and triangulated interior caps. */
export function splitGeometry(source: THREE.BufferGeometry, plane: THREE.Plane): [THREE.BufferGeometry | null, THREE.BufferGeometry | null] {
  const p = source.getAttribute('position'), n = source.getAttribute('normal'), c = source.getAttribute('color'), cap = source.getAttribute('cutFace');
  const index = source.getIndex(), outputs: Vertex[][] = [[], []], segments: [THREE.Vector3, THREE.Vector3][] = [];
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < p.count; i++) { const d = plane.distanceToPoint(new THREE.Vector3().fromBufferAttribute(p, i)); min = Math.min(min, d); max = Math.max(max, d); }
  if (min >= -EPS) return [null, source.clone()];
  if (max <= EPS) return [source.clone(), null];
  const vertex = (i: number): Vertex => ({ p: new THREE.Vector3().fromBufferAttribute(p, i),
    n: n ? new THREE.Vector3().fromBufferAttribute(n, i) : new THREE.Vector3(0, 1, 0),
    c: c ? new THREE.Color(c.getX(i), c.getY(i), c.getZ(i)) : new THREE.Color('#705384'), cap: cap?.getX(i) ?? 0 });
  for (let j = 0; j < (index?.count ?? p.count); j += 3) {
    const tri = [0, 1, 2].map(k => vertex(index ? index.getX(j + k) : j + k));
    const d = tri.map(v => plane.distanceToPoint(v.p)), intersections: THREE.Vector3[] = [];
    for (let k = 0; k < 3; k++) {
      const l = (k + 1) % 3;
      if (Math.abs(d[k]) < EPS) intersections.push(tri[k].p);
      if (d[k] * d[l] < -EPS * EPS) intersections.push(blend(tri[k], tri[l], d[k] / (d[k] - d[l])).p);
    }
    const unique = [...new Map(intersections.map(v => [key(v), v])).values()];
    if (unique.length === 2 && d.some(v => Math.abs(v) > EPS)) segments.push([unique[0], unique[1]]);
    for (let side = 0; side < 2; side++) {
      const sign = side ? 1 : -1, polygon: Vertex[] = [];
      for (let k = 0; k < 3; k++) {
        const l = (k + 1) % 3, inside = sign * d[k] >= -EPS, nextInside = sign * d[l] >= -EPS;
        if (inside) polygon.push(tri[k]);
        if (inside !== nextInside) polygon.push(blend(tri[k], tri[l], d[k] / (d[k] - d[l])));
      }
      for (let k = 1; k < polygon.length - 1; k++) outputs[side].push(polygon[0], polygon[k], polygon[k + 1]);
    }
  }
  const nodes = new Map<string, { p: THREE.Vector3; neighbors: Set<string> }>();
  for (const [a, b] of segments) {
    const ak = key(a), bk = key(b); if (ak === bk) continue;
    if (!nodes.has(ak)) nodes.set(ak, { p: a, neighbors: new Set() });
    if (!nodes.has(bk)) nodes.set(bk, { p: b, neighbors: new Set() });
    nodes.get(ak)!.neighbors.add(bk); nodes.get(bk)!.neighbors.add(ak);
  }
  const visited = new Set<string>(), edge = (a: string, b: string) => a < b ? `${a}|${b}` : `${b}|${a}`;
  const normal = plane.normal, u = new THREE.Vector3(Math.abs(normal.x) > .8 ? 0 : 1, Math.abs(normal.x) > .8 ? 1 : 0, 0).cross(normal).normalize();
  const v = normal.clone().cross(u).normalize(), interior = new THREE.Color('#41204f');
  for (const [start, node] of nodes) for (const first of node.neighbors) {
    if (visited.has(edge(start, first))) continue;
    const loop = [node.p]; let previous = start, current = first, closed = false;
    for (let steps = 0; steps <= nodes.size; steps++) {
      visited.add(edge(previous, current));
      if (current === start) { closed = true; break; }
      loop.push(nodes.get(current)!.p);
      const next = [...nodes.get(current)!.neighbors].find(k => k !== previous && !visited.has(edge(current, k)));
      if (!next) break; previous = current; current = next;
    }
    if (!closed || loop.length < 3) continue;
    const triangles = THREE.ShapeUtils.triangulateShape(loop.map(q => new THREE.Vector2(q.dot(u), q.dot(v))), []);
    for (let side = 0; side < 2; side++) {
      const outNormal = normal.clone().multiplyScalar(side ? -1 : 1);
      for (const t of triangles) {
        const vertices = t.map(i => loop[i]);
        if (vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0])).dot(outNormal) < 0)
          [vertices[1], vertices[2]] = [vertices[2], vertices[1]];
        outputs[side].push(...vertices.map(q => ({ p: q, n: outNormal, c: interior, cap: 1 })));
      }
    }
  }
  return outputs.map(vertices => {
    if (!vertices.length) return null;
    const positions: number[] = [], normals: number[] = [], colors: number[] = [], caps: number[] = [];
    for (const q of vertices) { positions.push(...q.p.toArray()); normals.push(...q.n.toArray()); colors.push(q.c.r, q.c.g, q.c.b); caps.push(q.cap); }
    const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      .setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)).setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
      .setAttribute('cutFace', new THREE.Float32BufferAttribute(caps, 1));
    geometry.computeBoundingBox(); geometry.computeBoundingSphere(); return geometry;
  }) as [THREE.BufferGeometry | null, THREE.BufferGeometry | null];
}

export function fractureGeometry(source: THREE.BufferGeometry, planes: THREE.Plane[]): THREE.BufferGeometry[] {
  let pieces = [source.clone()];
  for (const plane of planes) {
    const next: THREE.BufferGeometry[] = [];
    for (const geometry of pieces) {
      geometry.computeBoundingBox(); const box = geometry.boundingBox!;
      if (!box.intersectsPlane(plane)) { next.push(geometry); continue; }
      const halves = splitGeometry(geometry, plane); geometry.dispose();
      for (const half of halves) if (half && half.getAttribute('position').count > 6) next.push(half);
    }
    pieces = next;
  }
  return pieces;
}
