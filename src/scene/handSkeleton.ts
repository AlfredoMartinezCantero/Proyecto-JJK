import * as THREE from 'three';

export const HAND_PARENTS = [-1, 0, 1, 2, 3, 0, 5, 6, 7, 0, 9, 10, 11, 0, 13, 14, 15, 0, 17, 18, 19];
export const HAND_REST = [
  [0, 0, 0], [-.25, .18, 0], [-.48, .36, 0], [-.64, .53, 0], [-.73, .72, 0],
  [-.3, .72, 0], [-.32, 1.15, 0], [-.32, 1.43, 0], [-.32, 1.67, 0],
  [0, .8, 0], [0, 1.3, 0], [0, 1.62, 0], [0, 1.88, 0],
  [.27, .73, 0], [.3, 1.18, 0], [.3, 1.48, 0], [.3, 1.7, 0],
  [.47, .6, 0], [.53, .96, 0], [.53, 1.2, 0], [.53, 1.42, 0],
].map(p => new THREE.Vector3(...p as [number, number, number]));
export const HAND_CHAINS = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]];
export const HAND_CHILDREN = HAND_REST.map((_, i) => i === 0 ? 9 : HAND_PARENTS.findIndex(parent => parent === i));
