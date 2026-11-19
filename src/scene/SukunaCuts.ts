import * as THREE from 'three';
import { CONTACT_MS, smooth01 } from './combatTimeline';

export type CuttingTechnique = 'dismantle' | 'cleave' | 'shrine';
export function cutStroke(key: CuttingTechnique, index: number, elapsed: number) {
  const after = (elapsed - CONTACT_MS[key]) / 1000;
  const grid = key === 'cleave', shrine = key === 'shrine';
  const age = shrine ? (Math.max(0, after) % .42) : elapsed / 1000;
  const count = grid ? 12 : shrine ? 24 : 4;
  const delay = grid ? (index % 6) * .009 + Math.floor(index / 6) * .018 : shrine ? index % 6 * .012 : index * .035;
  const local = age - delay;
  const fade = grid ? 1 - smooth01((after - .52) / .38) : shrine ? 1 - smooth01((local - .24) / .16) : 1 - smooth01((after - .12) / .4);
  const alpha = local >= 0 && (!shrine || after >= 0) && index < count ? fade * (!grid && !shrine && index > 0 ? .45 / index : 1) : 0;
  const vertical = index < 6;
  let angle = grid ? (vertical ? Math.PI / 2 : 0) - .22 : shrine ? (index < 12 ? (vertical ? Math.PI / 2 : 0) : (index % 2 ? -.75 : .75)) + Math.floor(Math.max(0, after) / .42) * .13 : -.65;
  const offset = (index % 6 - 2.5);
  return { alpha, reveal: smooth01(local / (grid ? .13 : .11)),
    x: grid ? vertical ? offset * .32 : 0 : shrine ? Math.sin(index * 2.4) * (index < 12 ? .7 : 1.5) : -index * .06,
    y: grid ? vertical ? 0 : offset * .36 : shrine ? Math.cos(index * 1.7) * .9 : -.08 + index * .045,
    dx: Math.cos(angle), dy: Math.sin(angle), length: grid ? 2.8 : shrine ? 3.2 : 3.5,
    width: grid ? .035 : shrine ? .03 : index === 0 ? .065 : .025,
    curve: grid ? .025 : shrine ? .1 : .3,
  };
}

/** Separate cutting geometry: a perpendicular lattice, crescent slash and repeated domain barrages. */
export class SukunaCuts {
  readonly root = new THREE.Group();
  readonly geometry: THREE.BufferGeometry;
  private readonly positions = new Float32Array(24 * 48 * 2 * 3);
  private readonly strengths = new Float32Array(24 * 48 * 2);
  private readonly glow: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  constructor(scene: THREE.Object3D, private readonly camera: THREE.Camera) {
    this.root.name = 'Sukuna cutting lattice';
    const uv: number[] = [], indices: number[] = [];
    for (let r = 0; r < 24; r++) for (let i = 0; i < 48; i++) {
      uv.push(i / 47, 0, i / 47, 1);
      if (i < 47) { const a = (r * 48 + i) * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    this.geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
      .setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)).setAttribute('strokeStrength', new THREE.BufferAttribute(this.strengths, 1));
    this.geometry.setIndex(indices);
    const vertexShader = `attribute float strokeStrength;varying vec2 vUv;varying float power;
      void main(){vUv=uv;power=strokeStrength;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
    this.glow = new THREE.Mesh(this.geometry, new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending, uniforms: { strength: { value: 0 } }, vertexShader,
      fragmentShader: `uniform float strength;varying vec2 vUv;varying float power;
        void main(){float across=abs(vUv.y-.5)*2.;float edge=1.-smoothstep(.2,1.,across);
          float core=1.-smoothstep(.02,.24,across);vec3 color=mix(vec3(1.,.09,.23),vec3(1.3,1.2,1.04),core);
          gl_FragColor=vec4(color,edge*power*strength);}`,
    }));
    this.glow.frustumCulled = false; this.glow.renderOrder = 3;
    this.root.add(this.glow); scene.add(this.root); this.clear();
  }
  clear() { this.root.visible = false; this.geometry.setDrawRange(0, 0); }
  update(key: CuttingTechnique, elapsed: number, center: THREE.Vector3, travel: number, intensity: number, reduced: boolean) {
    this.root.visible = intensity > 0;
    const count = key === 'cleave' ? 12 : key === 'shrine' ? 24 : 4;
    this.geometry.setDrawRange(0, count * 47 * 6);
    this.glow.material.uniforms.strength.value = intensity * (reduced ? .72 : 1);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    // Place the impact plane in front of the target's surface, rather than inside its torso.
    const front = new THREE.Vector3(0, 0, 1).applyQuaternion(this.camera.quaternion);
    const scale = key === 'shrine' ? 1 : .4 + travel * .6;
    for (let r = 0; r < count; r++) {
      const stroke = cutStroke(key, r, elapsed);
      for (let i = 0; i < 48; i++) {
        const u = i / 47, along = (Math.min(u, stroke.reveal) - .5) * stroke.length;
        const bend = Math.sin(u * Math.PI) * stroke.curve;
        const taper = Math.pow(Math.max(0, Math.sin(u * Math.PI)), .55);
        for (let side = 0; side < 2; side++) {
          const across = bend + (side ? 1 : -1) * stroke.width * taper;
          const x = (stroke.x + along * stroke.dx - across * stroke.dy) * scale;
          const y = (stroke.y + along * stroke.dy + across * stroke.dx) * scale;
          const p = center.clone().addScaledVector(right, x).addScaledVector(up, y).addScaledVector(front, .58 + r * .001);
          const v = (r * 48 + i) * 2 + side; p.toArray(this.positions, v * 3);
          this.strengths[v] = u <= stroke.reveal ? stroke.alpha : 0;
        }
      }
    }
    this.geometry.getAttribute('position').needsUpdate = true;
    this.geometry.getAttribute('strokeStrength').needsUpdate = true;
  }
}
