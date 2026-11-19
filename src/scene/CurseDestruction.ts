import * as THREE from 'three';
import { bakeFractureGeometry, fractureGeometry } from './fractureGeometry';
import { ballistic, destructionState, type DestructionKind } from './destructionMotion';
import { smooth01, type CombatState } from './combatTimeline';
import { VoidHeadEffect } from './VoidHeadEffect';

interface Shard { mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>; center: THREE.Vector3; half: THREE.Vector3; seed: number }
interface FractureSet { root: THREE.Group; shards: Shard[] }
const seeded = (i: number) => { const n = Math.sin(i * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };

export class CurseDestruction {
  readonly root = new THREE.Group();
  private readonly sets: Record<'bisect' | 'grid' | 'dense' | 'head', FractureSet>;
  private readonly motes: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly rebuild: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  private readonly headCenter = new THREE.Vector3();
  private readonly headFlash: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  private readonly headWave: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  private readonly headEnergy: VoidHeadEffect;
  private intensity = .75;
  private quality: 'high' | 'low' = 'high';
  private reducedFlashes = true;
  activeKind: DestructionKind = 'none';

  constructor(parent: THREE.Object3D, surfaces: THREE.Mesh[], headSurfaces: THREE.Mesh[]) {
    this.root.name = 'Curse physical destruction';
    const master = bakeFractureGeometry(surfaces, parent);
    const head = bakeFractureGeometry(headSurfaces, parent);
    head.computeBoundingBox(); head.boundingBox!.getCenter(this.headCenter);
    const c = this.headCenter;
    const plane = (x: number, y: number, z: number, at: number) => new THREE.Plane(new THREE.Vector3(x, y, z).normalize(), -at);
    this.sets = {
      bisect: this.build(master, [plane(.6, .8, 0, 1.02)], 'bisect'),
      grid: this.build(master, [plane(1, 0, 0, -.35), plane(1, 0, 0, .35), plane(0, 1, 0, .8), plane(0, 1, 0, 1.6), plane(0, 0, 1, 0)], 'grid'),
      dense: this.build(master, [...[-.45, 0, .45].map(v => plane(1, 0, 0, v)),
        ...[.45, .9, 1.35, 1.8, 2.25].map(v => plane(0, 1, 0, v)), ...[-.16, .16].map(v => plane(0, 0, 1, v))], 'dense'),
      head: this.build(head, [plane(1, 0, 0, c.x - .1), plane(1, 0, 0, c.x + .1),
        plane(0, 1, 0, c.y), plane(0, 0, 1, c.z)], 'head'),
    };
    this.headEnergy = new VoidHeadEffect(this.root, head); head.dispose();
    this.headFlash = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), new THREE.MeshBasicMaterial({
      color: '#cfcaff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.headFlash.name = 'Curse head burst flash'; this.headFlash.position.copy(c);
    this.headWave = new THREE.Mesh(new THREE.TorusGeometry(.3, .015, 6, 48), new THREE.MeshBasicMaterial({
      color: '#b8a7ff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.headWave.name = 'Curse head shockwave'; this.headWave.position.copy(c);
    this.root.add(this.headFlash, this.headWave);
    const positions = new Float32Array(2400 * 3), seeds = new Float32Array(2400);
    const source = master.getAttribute('position');
    for (let i = 0; i < 2400; i++) {
      const j = Math.floor(seeded(i + 31) * source.count);
      positions.set([source.getX(j), source.getY(j), source.getZ(j)], i * 3); seeds[i] = seeded(i + 79);
    }
    master.dispose();
    const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(positions, 3))
      .setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
    this.motes = new THREE.Points(geometry, new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, uniforms: { age: { value: 0 }, mode: { value: 0 }, regeneration: { value: 0 }, strength: { value: 0 } },
      vertexShader: `uniform float age;uniform float mode;uniform float regeneration;attribute float seed;varying float life;varying float heat;
        void main(){float t=max(0.,age-seed*.32);vec3 p=position;heat=seed;
        if(regeneration>0.){p+=normalize(position-vec3(0.,1.3,0.)+vec3(.001))*pow(1.-regeneration,2.)*3.;life=sin(regeneration*3.14159);}
        else {vec3 drift=mode<.5?vec3(t*3.,sin(t*3.+seed*12.)*.3,t*t*.8):vec3(sin(seed*23.+t)*t*.35,t*1.5+t*t*.25,cos(seed*31.)*t*.4);
          p+=drift;life=step(seed*.32,age)*(1.-smoothstep(mode<.5?.4:.8,mode<.5?1.1:2.6,t));}
        vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
        gl_PointSize=clamp((mode<.5?2.5:4.)*(.5+seed)*16./max(1.,-mv.z),1.,8.);}`,
      fragmentShader: `uniform float mode;uniform float strength;uniform float regeneration;varying float life;varying float heat;
        void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;
        vec3 c=mode<.5||regeneration>0.?mix(vec3(.35,.12,.8),vec3(.8,.6,1.),heat):mix(vec3(.2,.13,.15),vec3(1.,.35,.04),pow(heat,4.));
        gl_FragColor=vec4(c,(1.-r*r)*life*strength);}`,
    }));
    this.motes.name = 'Curse surface particles'; this.motes.frustumCulled = false;
    this.rebuild = new THREE.Mesh(new THREE.TorusGeometry(.64, .012, 6, 96),
      new THREE.MeshBasicMaterial({ color: '#d3a2ff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.rebuild.rotation.x = Math.PI / 2;
    this.root.add(this.motes, this.rebuild); parent.add(this.root); this.reset();
  }

  private build(master: THREE.BufferGeometry, planes: THREE.Plane[], label: string): FractureSet {
    const root = new THREE.Group(); root.name = `Curse fracture ${label}`;
    const shards = fractureGeometry(master, planes).map((geometry, i) => {
      geometry.computeBoundingBox(); const box = geometry.boundingBox!, center = box.getCenter(new THREE.Vector3()), half = box.getSize(new THREE.Vector3()).multiplyScalar(.5);
      geometry.translate(-center.x, -center.y, -center.z); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      const material = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: .64, metalness: .12,
        emissive: '#17081e', emissiveIntensity: .3, transparent: true, depthWrite: true });
      const mesh = new THREE.Mesh(geometry, material); mesh.name = `Curse ${label} shard ${i}`;
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.position.copy(center); root.add(mesh);
      return { mesh, center, half, seed: seeded(i + 7) };
    });
    this.root.add(root); return { root, shards };
  }
  setSettings(intensity: number, quality: 'high' | 'low', reducedFlashes = true) {
    this.intensity = intensity; this.quality = quality; this.reducedFlashes = reducedFlashes;
    this.motes.geometry.setDrawRange(0, quality === 'high' ? 2400 : 700);
  }
  reset() {
    this.activeKind = 'none'; this.root.visible = false;
    Object.values(this.sets).forEach(set => { set.root.visible = false; for (const shard of set.shards) {
      shard.mesh.position.copy(shard.center); shard.mesh.rotation.set(0, 0, 0); shard.mesh.visible = true;
      shard.mesh.material.opacity = 1; shard.mesh.scale.setScalar(1);
      shard.mesh.material.emissive.set('#17081e'); shard.mesh.material.emissiveIntensity=.3;
    } });
    this.motes.visible = false; this.rebuild.visible = false; this.headFlash.visible = false; this.headWave.visible = false;
    this.headEnergy.root.visible = false;
  }

  update(state: CombatState, body: THREE.Group, uniforms: { dissolve: { value: number }; burn: { value: number } }, headParts: THREE.Group) {
    const d = destructionState(state); this.activeKind = d.engaged ? d.kind : 'none';
    this.root.visible = this.headEnergy.update(state, this.intensity, this.reducedFlashes, this.quality) || d.engaged;
    Object.values(this.sets).forEach(set => { set.root.visible = false; });
    this.motes.visible = false; this.rebuild.visible = false; this.headFlash.visible = false; this.headWave.visible = false;
    if (!d.engaged) return;
    const headOnly = d.kind === 'head-burst';
    const fractured = headOnly || ['bisect', 'grid', 'burst', 'shred', 'maul', 'exorcise'].includes(d.kind);
    if (fractured) {
      if (headOnly) headParts.visible = d.regeneration > .001;
      else { body.visible = d.regeneration > .001; uniforms.dissolve.value = 1 - d.regeneration; }
      const set = this.sets[headOnly ? 'head' : d.kind === 'bisect' || d.kind==='exorcise' ? 'bisect' : d.kind === 'grid' || d.kind === 'maul' || this.quality === 'low' ? 'grid' : 'dense'];
      set.root.visible = true;
      set.shards.forEach((shard, i) => {
        const delay = d.kind === 'shred' ? Math.floor(Math.max(0, (2.65 - shard.center.y) / 2.65) * 5) * .42 : 0;
        const age = d.age - delay;
        shard.mesh.visible = d.regeneration < .995;
        shard.mesh.position.copy(shard.center); shard.mesh.rotation.set(0, 0, 0); shard.mesh.scale.setScalar(1);
        shard.mesh.material.opacity = 1 - d.regeneration;
        shard.mesh.material.emissive.set(d.kind==='exorcise'?'#bed8a3':'#17081e');
        shard.mesh.material.emissiveIntensity=d.kind==='exorcise'?smooth01(Math.max(0,age)/.25)*this.intensity*(this.reducedFlashes?.8:1.5):.3;
        shard.mesh.castShadow = shard.mesh.material.opacity > .6;
        if (age < 0) return;
        const direction = shard.center.clone().sub(headOnly ? this.headCenter : new THREE.Vector3(0, 1.3, 0));
        if (direction.lengthSq() < .001) direction.set(.2, .5, .1); direction.normalize();
        const burst = d.kind === 'burst' || headOnly, speed = headOnly ? 2.6 + shard.seed * 2.4 : burst ? 4.5 + shard.seed * 4 : d.kind === 'shred' ? 1.3 + shard.seed : .55;
        let vx = direction.x * speed, vz = direction.z * speed, vy = headOnly ? 1.2 + shard.seed * 2.5 : burst ? 2 + shard.seed * 4 : .5 + shard.seed;
        if (d.kind === 'bisect' || d.kind==='exorcise') { const sign = i === 0 ? -1 : 1; vx = sign * .8; vz = sign * .18; vy = i === 0 ? .1 : .8; }
        if (d.kind === 'maul') { vx = Math.sign(shard.center.x || .1)*(1.2+shard.seed); vz = (shard.seed-.5)*1.1; vy = .8+shard.seed; }
        const motion = ballistic(age, shard.center.y, vx, vy, vz, .06 + Math.min(.2, shard.half.y * .35));
        const spin = (burst ? 6 : d.kind === 'bisect' ? 1.2 : 3) * motion.spinTime;
        shard.mesh.rotation.set(spin * (shard.seed - .45), spin * (.2 + shard.seed * .6), spin * (i % 2 ? .7 : -.7));
        const r = new THREE.Matrix4().makeRotationFromEuler(shard.mesh.rotation).elements;
        const support = Math.abs(r[1]) * shard.half.x + Math.abs(r[5]) * shard.half.y + Math.abs(r[9]) * shard.half.z;
        const settle = smooth01((age - 1.1) / .6);
        const y = Math.max(.06 + support, THREE.MathUtils.lerp(motion.y, .06 + support, settle));
        shard.mesh.position.set(shard.center.x + motion.x, y, shard.center.z + motion.z);
        const fade = d.kind==='exorcise'?1-smooth01((age-.25)/.9):state.persistent ? 1 : d.kind === 'shred' ? 1 - smooth01((age - 1.4) / 1.1) : 1 - smooth01((age - 1.15) / 1.4);
        shard.mesh.material.opacity *= fade;
        shard.mesh.visible &&= shard.mesh.material.opacity > .005;
        shard.mesh.castShadow = shard.mesh.material.opacity > .6;
      });
    } else if (d.kind === 'erase') {
      uniforms.dissolve.value = d.erasure; body.visible = d.erasure < .999;
    } else {
      uniforms.burn.value = Math.max(uniforms.burn.value, smooth01(d.age / .3) * (1 - d.regeneration));
      uniforms.dissolve.value = d.ash; body.visible = d.ash < .999;
    }
    this.motes.visible = this.intensity > 0 && (d.kind === 'erase' && d.age < 1.5 || d.kind === 'incinerate' || d.regeneration > .001);
    this.motes.material.uniforms.age.value = d.kind === 'incinerate' ? Math.max(0, d.age - .24) : d.age;
    this.motes.material.uniforms.mode.value = d.kind === 'incinerate' ? 1 : 0;
    this.motes.material.uniforms.regeneration.value = d.regeneration;
    this.motes.material.uniforms.strength.value = this.intensity * .85;
    if (headOnly && this.intensity > 0 && d.regeneration < .001) {
      this.headFlash.visible = !this.reducedFlashes && d.age < .16;
      this.headFlash.scale.setScalar(.15 + smooth01(d.age / .16) * .65);
      this.headFlash.material.opacity = (1 - smooth01(d.age / .16)) * this.intensity * .65;
      this.headWave.visible = d.age < .45;
      this.headWave.scale.setScalar(1 + d.age * (this.reducedFlashes ? 4 : 8));
      this.headWave.material.opacity = (1 - smooth01(d.age / .45)) * this.intensity * (this.reducedFlashes ? .25 : .65);
    }
    if (d.regeneration > .001 && this.intensity > 0) {
      this.rebuild.visible = true; this.rebuild.position.y = d.regeneration * 2.8;
      this.rebuild.material.opacity = Math.sin(d.regeneration * Math.PI) * this.intensity;
    }
  }
}
