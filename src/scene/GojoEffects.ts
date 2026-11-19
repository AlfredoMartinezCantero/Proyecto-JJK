import * as THREE from 'three';
import { TECHNIQUES } from '../core/techniques';
import type { TechniqueKey } from '../core/types';
import { BlueEffect } from './BlueEffect';
import { DomainEffect } from './DomainEffect';
import { effectTimeline } from './effectTimeline';
import { CONTACT_MS } from './combatTimeline';
import { makeGlowTexture } from './materials';

class EnergyOrb {
  readonly root = new THREE.Group();
  readonly core: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  readonly halo: THREE.Sprite;
  readonly ring: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  constructor(color: string, parent: THREE.Object3D) {
    this.core = new THREE.Mesh(new THREE.SphereGeometry(.28, 24, 18), new THREE.ShaderMaterial({
      uniforms: { tint: { value: new THREE.Color(color) }, time: { value: 0 } },
      vertexShader: `uniform float time;varying vec3 p;varying vec3 n;varying vec3 viewDir;
        void main(){p=position;n=normalize(normalMatrix*normal);
        vec3 q=position*(1.+.055*sin(position.y*32.+time*4.)*sin(position.z*27.-time*3.));
        vec4 mv=modelViewMatrix*vec4(q,1.);viewDir=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `uniform vec3 tint;uniform float time;varying vec3 p;varying vec3 n;varying vec3 viewDir;
        void main(){float a=atan(p.z,p.x);float swirl=sin(a*5.+p.y*32.-time*5.+sin(p.y*28.+time*2.)*1.4);
        float veins=pow(max(0.,1.-abs(swirl)),6.);float rim=pow(1.-abs(dot(normalize(n),normalize(viewDir))),2.);
        vec3 c=tint*(.28+.5*step(.1,swirl))+tint*rim*1.4+vec3(.85,.78,1.)*veins*.7;
        gl_FragColor=vec4(c,1.);}`,
    }));
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture(), color,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.halo.scale.set(2.2, 2.2, 1);
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(.41, .009, 5, 64),
      new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.root.add(this.core, this.halo, this.ring); this.root.visible = false; parent.add(this.root);
  }
  show(position: THREE.Vector3, size: number, opacity: number, now: number): void {
    this.root.visible = opacity > .001 && size > 0;
    this.root.position.copy(position); this.root.scale.setScalar(size);
    this.core.material.uniforms.time.value = now / 1000;
    this.core.scale.setScalar(Math.min(1, opacity * 3));
    this.halo.material.opacity = opacity * .65; this.ring.material.opacity = opacity * .8;
    this.ring.rotation.set(now / 1400, now / 1100, now / 1900);
  }
  hide(): void { this.root.visible = false; }
}

export class GojoEffects {
  private readonly blue: BlueEffect;
  private readonly domain: DomainEffect;
  private readonly root = new THREE.Group();
  private readonly blueOrb: EnergyOrb;
  private readonly redOrb: EnergyOrb;
  private readonly purpleOrb: EnergyOrb;
  private readonly waves: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>[] = [];
  private readonly beam: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
  private readonly particles: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private readonly positions = new Float32Array(220 * 3);
  private readonly light = new THREE.PointLight('#b081ff', 0, 10, 2);
  private key: TechniqueKey = 'blue';
  private primary: THREE.Vector3 | null = null;
  private secondary: THREE.Vector3 | null = null;
  private readonly origin = new THREE.Vector3();
  private readonly secondOrigin = new THREE.Vector3();
  private readonly target = new THREE.Vector3(2, 1.7, -1.35);
  private readonly field = new THREE.Vector3(.9, 1.72, -1.05);
  private began = -Infinity;
  private debug = false;
  private charge = 0;
  private step = 0;
  private intensity = .75;
  private reduced = true;
  private enhanced = false;
  attraction = 0;
  repulsion = 0;
  impact = 0;
  stun = 0;
  domainMix = 0;

  constructor(scene: THREE.Scene, camera: THREE.Camera) {
    this.blue = new BlueEffect(scene); this.domain = new DomainEffect(scene, camera);
    this.blueOrb = new EnergyOrb('#5daaff', this.root);
    this.redOrb = new EnergyOrb('#ff365e', this.root);
    this.purpleOrb = new EnergyOrb('#ab6cff', this.root);
    this.blueOrb.root.name = 'Gojo preparation Blue'; this.redOrb.root.name = 'Gojo preparation Red'; this.purpleOrb.root.name = 'Gojo preparation Purple';
    for (let i = 0; i < 3; i++) {
      const wave = new THREE.Mesh(new THREE.TorusGeometry(1, .018, 5, 96),
        new THREE.MeshBasicMaterial({ color: '#ff476b', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      wave.visible = false; this.waves.push(wave); this.root.add(wave);
    }
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(.12, .24, 1, 12), new THREE.MeshBasicMaterial({
      color: '#b57dff', transparent: true, opacity: .2, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.beam.visible = false; this.root.add(this.beam);
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.particles = new THREE.Points(geometry, new THREE.PointsMaterial({ map: makeGlowTexture(),
      color: '#bb8eff', size: .075, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.particles.frustumCulled = false; this.particles.visible = false;
    this.root.add(this.particles, this.light); scene.add(this.root);
  }

  setTechnique(key: TechniqueKey): void { this.clear(); this.key = key; }
  setEnhanced(enhanced: boolean): void { this.enhanced = enhanced; }
  setTarget(target: THREE.Vector3, field: THREE.Vector3): void { this.target.copy(target); this.field.copy(field); this.blue.setTarget(field); }
  setSettings(intensity: number, reduced: boolean): void {
    this.intensity = intensity; this.reduced = reduced; this.blue.setSettings(intensity, reduced);
  }
  setPalms(primary: THREE.Vector3 | null, secondary: THREE.Vector3 | null): void {
    this.primary = primary; this.secondary = secondary; this.blue.setPalm(primary);
  }
  setCharge(progress: number, step = 0): void {
    this.charge = progress; this.step = step; this.blue.setCharge(this.key === 'blue' ? progress : 0);
  }
  activate(now: number, debug: boolean): void {
    this.began = now; this.debug = debug; this.charge = 0;
    this.origin.copy(this.primary ?? new THREE.Vector3(-1, 2, 1));
    this.secondOrigin.copy(this.secondary ?? new THREE.Vector3(1, 2, 1));
    if (this.key === 'purple' && !debug) this.secondOrigin.copy(this.origin);
    if (this.key === 'blue') this.blue.activate(now, debug);
  }
  clear(): void {
    this.began = -Infinity; this.charge = 0; this.step = 0; this.blue.clear();
    this.primary = null; this.secondary = null;
    this.attraction = 0; this.repulsion = 0; this.impact = 0; this.stun = 0; this.domainMix = 0;
    this.blueOrb.hide(); this.redOrb.hide(); this.purpleOrb.hide(); this.beam.visible = false;
    this.waves.forEach(wave => { wave.visible = false; }); this.particles.visible = false; this.light.intensity = 0;
    this.domain.update(0, 0, this.reduced);
  }

  update(now: number): void {
    this.blueOrb.hide(); this.redOrb.hide(); this.purpleOrb.hide(); this.beam.visible = false;
    this.waves.forEach(wave => { wave.visible = false; }); this.particles.visible = false; this.light.intensity = 0;
    this.blue.update(now);
    const elapsed = now - this.began;
    const timeline = effectTimeline(this.key, elapsed, TECHNIQUES[this.key].effectMs, this.debug);
    this.attraction = timeline.attraction;
    this.repulsion = timeline.repulsion; this.impact = timeline.impact; this.stun = timeline.stun;
    this.domainMix = timeline.domain * Math.min(1, this.intensity * 1.4);
    this.domain.update(now, this.domainMix, this.reduced);
    if (this.enhanced && timeline.active && this.key !== 'domain') { this.blue.root.visible = false; return; }
    if (this.key === 'blue' || this.intensity <= 0) return;
    const opacity = (timeline.active ? timeline.fade : Math.max(this.charge, this.step > 0 ? .25 : 0)) * this.intensity;
    if (opacity <= 0) return;
    const center = timeline.active ? this.origin.clone() : this.primary?.clone();
    if (!center) return;
    if (this.key === 'domain') {
      if (!timeline.active && this.primary) this.purpleOrb.show(center, .4 + this.charge * .6, opacity * .5, now);
      return;
    }
    if (this.key === 'red') {
      if (timeline.active) center.lerp(this.target, THREE.MathUtils.smoothstep(elapsed, 0, 350));
      const collapse = 1 - THREE.MathUtils.smoothstep(elapsed, 350, 760);
      this.redOrb.show(center, timeline.active ? (.65 + timeline.travel * .3) * collapse : .22 + this.charge * .5, opacity, now);
      if (timeline.active && elapsed >= 350) this.drawWaves(center, (elapsed - 350) / 1000, opacity, '#ff476b', this.target.clone().sub(this.origin));
    } else {
      const second = timeline.active ? this.secondOrigin.clone() : this.secondary?.clone();
      const midpoint = center.clone().add(second ?? center).multiplyScalar(.5);
      if (!timeline.active) {
        const pose = TECHNIQUES[this.key].steps[this.step]?.pose;
        if (pose === 'prepare-blue') this.blueOrb.show(center, .3 + this.charge * .5, opacity, now);
        else if (pose === 'prepare-red') {
          this.blueOrb.show(center, .75, Math.max(opacity, this.intensity * .5), now);
          if (second) this.redOrb.show(second, .3 + this.charge * .5, opacity, now);
        } else if (pose === 'merge' && second) {
          const merge = THREE.MathUtils.smoothstep(this.charge, 0, 1);
          this.blueOrb.show(center.clone().lerp(midpoint, merge), .75 * (1 - merge * .7), opacity, now);
          this.redOrb.show(second.clone().lerp(midpoint, merge), .75 * (1 - merge * .7), opacity, now);
          if (merge > .5) this.purpleOrb.show(midpoint, (merge - .5) * 1.4, opacity, now);
        } else if (pose === 'purple') this.purpleOrb.show(center, .7 + this.charge * .5, opacity, now);
      } else {
        const merged = this.key === 'purple' && !this.debug ? 1 : timeline.merge;
        if (merged < 1) {
          const orbit = Math.sin(merged * Math.PI) * .65, spin = merged * Math.PI * 2;
          const offset = new THREE.Vector3(Math.cos(spin) * orbit, Math.sin(spin) * orbit, 0);
          this.blueOrb.show(center.clone().lerp(midpoint, merged).add(offset), .8 * (1 - merged * .5), opacity, now);
          this.redOrb.show((second ?? center).clone().lerp(midpoint, merged).sub(offset), .8 * (1 - merged * .5), opacity, now);
        }
        if (this.key === 'purple') {
          center.copy(midpoint).lerp(this.target, timeline.travel);
          // Continue through the receiver instead of parking a growing ball on it.
          const contact = CONTACT_MS.purple;
          if (elapsed > contact) center.addScaledVector(this.target.clone().sub(midpoint).normalize(),
            THREE.MathUtils.smoothstep(elapsed, contact, contact + 1100) * 3.2);
          this.purpleOrb.show(center, .65 + merged * 1.6, opacity, now);
          if (timeline.travel > .01) this.drawBeam(midpoint, center, opacity);
          if (elapsed >= contact) this.drawWaves(this.target, (elapsed - contact) / 1000, opacity * .6, '#ad7aff', this.target.clone().sub(midpoint));
        } else {
          center.copy(midpoint); this.purpleOrb.show(midpoint, merged * 1.3, opacity, now);
        }
      }
    }
    this.light.color.set(this.key === 'red' ? '#ff476b' : '#ad7aff'); this.light.position.copy(center);
    this.light.intensity = opacity * (this.reduced ? 2 : 4);
    this.particles.visible = true; this.particles.position.copy(center);
    this.particles.material.color.set(this.key === 'red' ? '#ff879b' : '#bc9cff');
    this.particles.material.opacity = opacity * .65;
    for (let i = 0; i < 220; i++) {
      const phase = (i * .137 + now / 1800) % 1;
      const r = this.key === 'red' ? .25 + phase * 3.5 : .3 + (1 - phase) * 2.1;
      const angle = i * 2.39996 + now / 1500;
      this.positions.set([Math.cos(angle) * r, Math.sin(i * 1.7) * r * .6, Math.sin(angle) * r], i * 3);
    }
    this.particles.geometry.getAttribute('position').needsUpdate = true;
  }

  private drawWaves(center: THREE.Vector3, age: number, opacity: number, color: string, direction?: THREE.Vector3): void {
    this.waves.forEach((wave, i) => {
      const localAge = age - i * .09, scale = .4 + Math.max(0, localAge) * (3 + i * .6);
      wave.visible = localAge >= 0; wave.position.copy(center); wave.scale.setScalar(scale);
      if (direction && direction.lengthSq() > .0001) wave.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction.clone().normalize());
      else wave.rotation.set(i * Math.PI / 3, i * .8, age * .2);
      wave.material.color.set(color); wave.material.opacity = opacity * .45 / (1 + scale * .2);
    });
  }
  private drawBeam(from: THREE.Vector3, to: THREE.Vector3, opacity: number): void {
    const delta = to.clone().sub(from), length = delta.length();
    this.beam.visible = length > .01; this.beam.position.copy(from).add(to).multiplyScalar(.5);
    this.beam.scale.set(1, length, 1);
    this.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    this.beam.material.opacity = opacity * .055;
  }
}
