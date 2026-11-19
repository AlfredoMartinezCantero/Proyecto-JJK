import * as THREE from 'three';
import type { CombatState } from './combatTimeline';

const COLORS = { blue: '#5dcaff', red: '#ff3b59', fusion: '#b579ff', purple: '#b579ff',
  domain: '#c5d8ff', dismantle: '#fff2dd', cleave: '#ff8294', flame: '#ff8b2a', shrine: '#ff415e', divergent: '#6ce7ff', 'black-flash': '#ff274b', 'divine-dogs': '#9cafff', nue: '#cb9cff', totality:'#d7dcf3',toad:'#b1dd94','max-elephant':'#91d7eb','rabbit-escape':'#eff3f6',mahoraga:'#e1e9b1','chimera-garden':'#a394d6' };

/** Fixed pools: no meshes, textures or materials are allocated per cast/frame. */
export class CombatAccents {
  readonly root = new THREE.Group();
  private readonly debris: THREE.InstancedMesh;
  private readonly streaks: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  private readonly positions = new Float32Array(96 * 6);
  private readonly impact: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private readonly scorch: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  private readonly cracks: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  private readonly dummy = new THREE.Object3D();
  private intensity = .75;
  private reduced = true;

  constructor(scene: THREE.Scene) {
    this.root.name = 'Technique contact accents';
    this.debris = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.12, 0),
      new THREE.MeshToonMaterial({ color: '#647076', transparent: true }), 40);
    this.debris.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.debris.frustumCulled = false;
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.streaks = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: '#a4cfff', transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false })); this.streaks.frustumCulled = false;
    this.impact = new THREE.Mesh(new THREE.RingGeometry(.86, 1, 80),
      new THREE.MeshBasicMaterial({ color: '#ff7799', transparent: true, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, depthWrite: false }));
    this.impact.rotation.x = -Math.PI / 2;
    this.scorch = new THREE.Mesh(new THREE.CircleGeometry(1, 64),
      new THREE.MeshBasicMaterial({ color: '#141421', transparent: true, depthWrite: false }));
    this.scorch.rotation.x = -Math.PI / 2;
    const crackVertices: number[] = [];
    for (let i = 0; i < 14; i++) {
      const a = i * 2.39996;
      for (let j = 0; j < 3; j++) {
        const angle = a + Math.sin(i + j) * .16, r = .3 + j * .43;
        crackVertices.push(Math.cos(angle) * r, 0, Math.sin(angle) * r,
          Math.cos(angle + .12) * (r + .45), 0, Math.sin(angle + .12) * (r + .45));
      }
    }
    this.cracks = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',
      new THREE.Float32BufferAttribute(crackVertices, 3)), new THREE.LineBasicMaterial({ color: '#d1a2ff', transparent: true, depthWrite: false }));
    this.root.add(this.debris, this.streaks, this.impact, this.scorch, this.cracks); scene.add(this.root); this.clear();
  }
  setSettings(intensity: number, reduced: boolean) { this.intensity = intensity; this.reduced = reduced; }
  clear() { this.root.visible = false; }

  update(state: CombatState, target: THREE.Vector3, field: THREE.Vector3, origin: THREE.Vector3): void {
    if(state.key==='rabbit-escape'||state.key==='toad'){this.clear();return;}
    this.root.visible = state.active && this.intensity > 0;
    if (!this.root.visible) return;
    const color = COLORS[state.key], t = state.elapsed / 1000;
    const vortex = state.key === 'blue' || state.key === 'fusion';
    const hitAge = state.hitAge / 1000, impact = hitAge >= 0 && hitAge < .85;
    const after = (state.key === 'flame' || state.key === 'purple') && state.hitAge >= 0;
    const fade = (1 - state.recovery) * this.intensity;
    this.streaks.visible = vortex || impact || state.key === 'purple' || state.key === 'flame';
    this.streaks.material.color.set(color); this.streaks.material.opacity = fade * (this.reduced ? .4 : .7);
    const center = vortex ? field : target;
    for (let i = 0; i < 96; i++) {
      const a = i * 2.39996 + t * (vortex ? -5 : .7), phase = (i * .137 + t * 1.4) % 1;
      const radius = vortex ? .4 + (1 - phase) * 2.5 : .3 + Math.max(0, hitAge) * (2 + i % 5);
      const y = Math.sin(i * 1.73) * radius * .55;
      const j = i * 6;
      if (!vortex && !impact) {
        // Wake behind the moving projectile, converging into its path.
        const u = state.travel * phase, spread = Math.sin(phase * Math.PI) * .35;
        this.positions.set([origin.x + (target.x - origin.x) * u + Math.cos(a) * spread,
          origin.y + (target.y - origin.y) * u + Math.sin(a) * spread, origin.z + (target.z - origin.z) * u,
          origin.x + (target.x - origin.x) * Math.max(0, u - .055),
          origin.y + (target.y - origin.y) * Math.max(0, u - .055), origin.z + (target.z - origin.z) * Math.max(0, u - .055)], j);
      } else {
        const b = a + (vortex ? .22 : .015), end = radius + (vortex ? -.18 : .45);
        this.positions.set([center.x + Math.cos(a) * radius, center.y + y, center.z + Math.sin(a) * radius,
          center.x + Math.cos(b) * end, center.y + y * .95, center.z + Math.sin(b) * end], j);
      }
    }
    this.streaks.geometry.getAttribute('position').needsUpdate = true;
    this.debris.visible = vortex || impact || after;
    (this.debris.material as THREE.MeshToonMaterial).opacity = fade;
    for (let i = 0; i < 40; i++) {
      const a = i * 2.39996 + (vortex ? t * 2.5 : 0), p = (i * .173 + t * .5) % 1;
      const radius = vortex ? .55 + (1 - p) * 1.9 : .2 + Math.max(0, hitAge) * (1 + i % 4);
      this.dummy.position.set(center.x + Math.cos(a) * radius,
        vortex ? .2 + p * (center.y + .4) : Math.max(.12, .2 + (1 + i % 4) * Math.max(0, hitAge) - 2.8 * hitAge * hitAge),
        center.z + Math.sin(a) * radius);
      this.dummy.rotation.set(t + i, i * .6, t * 2);
      this.dummy.scale.setScalar((.5 + i % 4 * .23) * (vortex ? 1 : Math.max(0, 1 - Math.max(0, hitAge) / 1.8)));
      this.dummy.updateMatrix(); this.debris.setMatrixAt(i, this.dummy.matrix);
    }
    this.debris.instanceMatrix.needsUpdate = true;
    this.impact.visible = impact; this.impact.position.set(target.x, .085, target.z);
    this.impact.scale.setScalar(.25 + Math.max(0, hitAge) * (state.key === 'flame' ? 7 : 5));
    this.impact.material.color.set(color); this.impact.material.opacity = fade * (1 - Math.min(1, Math.max(0, hitAge) / .85)) * .55;
    this.scorch.visible = after; this.scorch.position.set(target.x, .077, target.z);
    this.scorch.scale.setScalar(state.key === 'flame' ? 1.9 : 1.25); this.scorch.material.opacity = fade * .6;
    this.cracks.visible = after || impact; this.cracks.position.set(target.x, .081, target.z);
    this.cracks.material.color.set(color); this.cracks.material.opacity = fade * .55;
  }
}
