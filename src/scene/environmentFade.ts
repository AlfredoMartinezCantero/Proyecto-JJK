import type { Material } from 'three';

export interface MaterialState { opacity: number; transparent: boolean; depthWrite: boolean }

export function fadeEnvironmentMaterial(material: Material, original: MaterialState, amount: number): void {
  const fading = amount > .001;
  const transparent = fading || original.transparent;
  if (material.transparent !== transparent) {
    material.transparent = transparent;
    // Three caches the OPAQUE shader define: changing the flag needs a new program variant.
    material.needsUpdate = true;
  }
  material.opacity = original.opacity * (1 - Math.min(1, Math.max(0, amount)));
  material.depthWrite = fading ? false : original.depthWrite;
}
