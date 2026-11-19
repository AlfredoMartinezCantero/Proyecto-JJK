import * as THREE from 'three';

export function makePalette() {
  const ramp = new THREE.DataTexture(new Uint8Array([65, 145, 220, 255]), 4, 1, THREE.RedFormat);
  ramp.minFilter = THREE.NearestFilter; ramp.magFilter = THREE.NearestFilter; ramp.needsUpdate = true;
  const materials = new Map<string, THREE.MeshToonMaterial>();
  return {
    toon(color: THREE.ColorRepresentation): THREE.MeshToonMaterial {
      const key = String(color);
      if (!materials.has(key)) materials.set(key, new THREE.MeshToonMaterial({ color, gradientMap: ramp }));
      return materials.get(key)!;
    },
    ramp,
  };
}

export function outlined(geometry: THREE.BufferGeometry, material: THREE.Material, outline = true): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true; mesh.receiveShadow = true;
  if (outline) {
    const ink = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: '#111526', side: THREE.BackSide }));
    ink.scale.setScalar(1.035); mesh.add(ink);
  }
  return mesh;
}

export function makeGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
  const context = canvas.getContext('2d')!;
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(220,250,255,1)'); gradient.addColorStop(.15, 'rgba(90,190,255,.8)');
  gradient.addColorStop(.45, 'rgba(35,80,255,.25)'); gradient.addColorStop(1, 'rgba(0,40,180,0)');
  context.fillStyle = gradient; context.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}
