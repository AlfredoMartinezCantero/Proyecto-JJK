import * as THREE from 'three';
import { TECHNIQUES } from '../core/techniques';
import type { TechniqueKey } from '../core/types';
import { makeGlowTexture } from './materials';
import { CONTACT_MS, combatTimeline } from './combatTimeline';
import { ShrineDomain, type ShrineAssetStatus } from './ShrineDomain';
import { shrineTimeline } from './shrineTimeline';

const smooth = (v: number) => THREE.MathUtils.smoothstep(v, 0, 1);
export function sukunaTimeline(key: TechniqueKey, elapsed: number, duration: number, debug: boolean) {
  const active = elapsed >= 0 && elapsed < duration;
  const fade = active ? smooth(elapsed / 400) * (1 - smooth((elapsed - duration + 900) / 900)) : 0;
  const contact = combatTimeline(key, elapsed, duration, debug);
  return { active, fade, travel: smooth(elapsed / (key === 'flame' ? 1400 : 650)),
    impact: contact.cuts + contact.burn,
    shrine: key === 'shrine' ? shrineTimeline(elapsed, duration).atmosphere : 0 };
}

export class SukunaEffects {
  readonly root = new THREE.Group();
  private key: TechniqueKey = 'dismantle';
  private primary: THREE.Vector3 | null = null;
  private secondary: THREE.Vector3 | null = null;
  private readonly origin = new THREE.Vector3();
  private readonly target = new THREE.Vector3(2, 1.7, -1.35);
  private began = -Infinity;
  private debug = false;
  private charge = 0;
  private step = 0;
  private intensity = .75;
  private reduced = true;
  private detailedPose = false;
  private enhanced = false;
  private quality: 'high' | 'low' = 'high';
  private readonly bow: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  private readonly bowString: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  private readonly bowPositions = new Float32Array(33 * 3);
  private readonly stringPositions = new Float32Array(3 * 3);
  private readonly cuts: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[] = [];
  private readonly fire = new THREE.Group();
  private readonly inferno: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private readonly smoke: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private readonly smokePositions = new Float32Array(72 * 3);
  private readonly flame: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private readonly glow: THREE.Sprite;
  private readonly particles: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private readonly positions = new Float32Array(240 * 3);
  private readonly shrine: ShrineDomain;
  private readonly light = new THREE.PointLight('#ff532d', 0, 12, 2);
  attraction = 0; repulsion = 0; impact = 0; stun = 0; domainMix = 0;

  constructor(scene: THREE.Scene, private readonly camera: THREE.Camera, onShrineStatus?: (status: ShrineAssetStatus) => void) {
    this.shrine = new ShrineDomain(onShrineStatus);
    for (let i = 0; i < 20; i++) {
      const cut = new THREE.Mesh(new THREE.PlaneGeometry(1, .028),
        new THREE.MeshBasicMaterial({ color: i % 2 ? '#fff1dc' : '#ff6275', transparent: true,
          depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
      cut.visible = false; this.cuts.push(cut); this.root.add(cut);
    }
    this.flame = new THREE.Mesh(new THREE.SphereGeometry(.3, 24, 16), new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, strength: { value: .75 } },
      vertexShader: `varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform float time;uniform float strength;varying vec3 p;void main(){float w=.5+.5*sin(p.z*26.-time*6.+sin(p.x*28.+time));
        vec3 c=mix(vec3(.8,.07,.012),vec3(1.,.58,.08),smoothstep(.2,.8,w));
        c=mix(c,vec3(1.,.9,.5),pow(max(0.,1.-length(p.xy)*3.),3.)*.65);gl_FragColor=vec4(c*strength,1.);}`,
    }));
    this.flame.scale.set(1, 1, 3); this.fire.add(this.flame);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(.23, .6, 8), new THREE.MeshBasicMaterial({ color: '#ffe7a0' }));
    tip.rotation.x = Math.PI / 2; tip.position.z = .9; this.fire.add(tip);
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture(), color: '#ff813b',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.glow.scale.set(2.5, 2.5, 1); this.fire.add(this.glow); this.root.add(this.fire);
    const bowMaterial = new THREE.LineBasicMaterial({ color: '#ffbe63', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.bow = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(this.bowPositions, 3)), bowMaterial);
    this.bowString = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(this.stringPositions, 3)), bowMaterial);
    this.bow.name = 'Fuga bow'; this.bowString.name = 'Fuga drawn string';
    this.bow.frustumCulled = false; this.bowString.frustumCulled = false; this.root.add(this.bow, this.bowString);
    this.inferno = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { time: { value: 0 }, opacity: { value: 0 } },
      vertexShader: `uniform float time;varying vec3 p;varying vec3 n;
        void main(){p=position;n=normalize(normalMatrix*normal);vec3 q=position;
        q.xz*=1.+.1*sin(position.y*12.-time*6.+position.x*7.);gl_Position=projectionMatrix*modelViewMatrix*vec4(q,1.);}`,
      fragmentShader: `uniform float time;uniform float opacity;varying vec3 p;varying vec3 n;
        void main(){float flow=sin(p.y*18.-time*7.+sin(atan(p.z,p.x)*7.+time*2.)*2.);
        float tongues=smoothstep(-.7,.8,flow);vec3 c=mix(vec3(1.,.08,.005),vec3(1.,.72,.12),tongues);
        float edge=pow(1.-abs(n.z),1.5);gl_FragColor=vec4(c,(.18+edge*.35)*opacity*(1.-smoothstep(.55,1.,p.y)));}`,
    }));
    const smokeGeometry = new THREE.BufferGeometry(); smokeGeometry.setAttribute('position', new THREE.BufferAttribute(this.smokePositions, 3));
    this.smoke = new THREE.Points(smokeGeometry, new THREE.PointsMaterial({ map: makeGlowTexture(), color: '#655a60',
      size: .8, transparent: true, depthWrite: false, blending: THREE.NormalBlending }));
    this.smoke.frustumCulled = false; this.root.add(this.inferno, this.smoke);
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.particles = new THREE.Points(geometry, new THREE.PointsMaterial({ map: makeGlowTexture(), color: '#ffac53', size: .1,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.particles.frustumCulled = false; this.root.add(this.particles);
    this.root.add(this.shrine.root, this.light); scene.add(this.root); this.clear();
  }
  setTechnique(key: TechniqueKey): void { this.clear(); this.key = key; }
  setTarget(target: THREE.Vector3): void { this.target.copy(target); }
  setSettings(intensity: number, reduced: boolean, quality: 'high' | 'low' = 'high'): void { this.intensity = intensity; this.reduced = reduced; this.quality = quality; }
  preloadShrine() { return this.shrine.preload(); }
  dispose() { this.shrine.dispose(); }
  setDetailedPose(detailed: boolean): void { this.detailedPose = detailed; }
  setEnhanced(enhanced: boolean): void { this.enhanced = enhanced; }
  setPalms(primary: THREE.Vector3 | null, secondary: THREE.Vector3 | null): void { this.primary = primary; this.secondary = secondary; }
  setCharge(progress: number, step = 0): void { this.charge = progress; this.step = step; }
  activate(now: number, debug: boolean): void {
    this.began = now; this.debug = debug; this.charge = 0;
    if (this.key === 'shrine') this.shrine.begin();
    this.origin.copy((this.key === 'flame' ? this.secondary ?? this.primary : this.primary) ?? new THREE.Vector3(-1, 2, 1));
  }
  clear(): void {
    this.began = -Infinity; this.charge = 0; this.step = 0; this.primary = null; this.secondary = null;
    this.impact = 0; this.stun = 0; this.domainMix = 0;
    this.cuts.forEach(cut => { cut.visible = false; }); this.fire.visible = false; this.shrine.clear();
    this.particles.visible = false; this.light.intensity = 0;
    this.inferno.visible = false; this.smoke.visible = false;
    this.bow.visible = false; this.bowString.visible = false;
  }
  update(now: number): void {
    this.cuts.forEach(cut => { cut.visible = false; }); this.fire.visible = false; this.particles.visible = false;
    this.shrine.root.visible = false; this.light.intensity = 0;
    this.inferno.visible = false; this.smoke.visible = false;
    this.bow.visible = false; this.bowString.visible = false;
    const elapsed = now - this.began, state = sukunaTimeline(this.key, elapsed, TECHNIQUES[this.key].effectMs, this.debug);
    if (!state.active) this.shrine.clear();
    this.impact = state.impact; this.stun = 0; this.domainMix = state.shrine * Math.min(1, this.intensity * 1.4);
    if (!state.active && TECHNIQUES[this.key].handCount === 2 && (!this.primary || !this.secondary)) return;
    const opacity = (state.active ? state.fade : Math.max(this.charge, this.step > 0 ? .2 : 0)) * this.intensity;
    if (opacity <= 0) return;
    if (this.key === 'shrine' && state.active) {
      this.shrine.update(elapsed, TECHNIQUES.shrine.effectMs, this.intensity, this.reduced, this.quality);
      if (!this.enhanced) this.drawCuts(this.target, elapsed, opacity, 20, 5); return;
    }
    if (this.enhanced && state.active) return;
    const center = state.active ? this.origin.clone().lerp(this.target, state.travel) : this.primary?.clone();
    if (!center) return;
    if (this.key === 'flame') {
      if (!state.active && this.secondary) {
        if (this.detailedPose) center.copy(this.secondary);
        else center.add(this.secondary).multiplyScalar(.5);
      }
      if (!state.active && this.detailedPose && this.charge > 0 && this.step === 1 && this.primary && this.secondary) {
        const axis = this.secondary.clone().sub(this.primary).normalize();
        const side = new THREE.Vector3(0, 1, 0).addScaledVector(axis, -axis.y);
        if (side.lengthSq() < .001) side.set(1, 0, 0); side.normalize();
        const radius = .35 + this.charge * .4;
        for (let i = 0; i < 33; i++) {
          const angle = -Math.PI / 2 + i / 32 * Math.PI;
          this.secondary.clone().addScaledVector(side, Math.sin(angle) * radius)
            .addScaledVector(axis, Math.cos(angle) * radius * .38).toArray(this.bowPositions, i * 3);
        }
        this.secondary.clone().addScaledVector(side, -radius).toArray(this.stringPositions, 0);
        this.primary.toArray(this.stringPositions, 3);
        this.secondary.clone().addScaledVector(side, radius).toArray(this.stringPositions, 6);
        this.bow.geometry.getAttribute('position').needsUpdate = true;
        this.bowString.geometry.getAttribute('position').needsUpdate = true;
        this.bow.material.opacity = opacity * (this.reduced ? .55 : .9);
        this.bow.visible = true; this.bowString.visible = true;
      }
      this.fire.visible = !state.active || elapsed < CONTACT_MS.flame + 220;
      this.fire.position.copy(center); this.fire.scale.setScalar(state.active ? .8 + state.travel * .6 : .3 + this.charge * .5);
      const arrowDirection = !state.active && this.detailedPose && this.primary && this.secondary
        ? this.secondary.clone().sub(this.primary) : this.target.clone().sub(state.active ? this.origin : center);
      this.fire.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), arrowDirection.normalize());
      this.flame.material.uniforms.time.value = now / 1000; this.flame.material.uniforms.strength.value = this.intensity;
      (this.glow.material as THREE.SpriteMaterial).opacity = opacity * .6;
      this.particles.visible = true; this.particles.position.copy(center); this.particles.material.opacity = opacity * .75;
      const explosion = state.active && elapsed >= CONTACT_MS.flame;
      const tailDirection = this.origin.clone().sub(this.target).normalize();
      if (explosion) {
        const age = (elapsed - CONTACT_MS.flame) / 1000, rise = smooth(Math.min(1, age / .5));
        this.inferno.visible = true; this.inferno.position.copy(this.target); this.inferno.position.y = 1.8;
        this.inferno.scale.set(1.9 * rise, 1.8 * rise, 1.9 * rise);
        this.inferno.material.uniforms.time.value = age;
        this.inferno.material.uniforms.opacity.value = opacity * (this.reduced ? .6 : 1);
        this.smoke.visible = true; this.smoke.position.copy(this.target); this.smoke.material.opacity = opacity * .35 * smooth(age / .7);
        for (let i = 0; i < 72; i++) {
          const p = (i * .173 + age * .3) % 1, a = i * 2.39996;
          this.smokePositions.set([Math.cos(a) * (.3 + p * 1.5), p * 3.8 + .3, Math.sin(a) * (.3 + p * 1.5)], i * 3);
        }
        this.smoke.geometry.getAttribute('position').needsUpdate = true;
      }
      for (let i = 0; i < 240; i++) {
        const phase = (i * .123 + now / 1300) % 1, a = i * 2.4;
        const r = explosion ? phase * 2.7 : phase * .5;
        this.positions.set([Math.cos(a) * r + (explosion ? 0 : tailDirection.x * phase * 2.8),
          Math.sin(a) * r + phase * (explosion ? 2 : .2) + (explosion ? 0 : tailDirection.y * phase * 2.8),
          Math.sin(i * 1.9) * r + (explosion ? 0 : tailDirection.z * phase * 2.8)], i * 3);
      }
      this.particles.geometry.getAttribute('position').needsUpdate = true;
    } else this.drawCuts(center, state.active ? elapsed : 0, opacity, this.key === 'cleave' && state.active && elapsed >= CONTACT_MS.cleave ? 12 : 1, state.active ? 2.1 : .7);
    this.light.position.copy(center); this.light.intensity = opacity * (this.reduced ? 2 : 4);
  }
  private drawCuts(center: THREE.Vector3, now: number, opacity: number, count: number, radius: number): void {
    this.cuts.forEach((cut, i) => {
      if (i >= count) return;
      const contact = now >= CONTACT_MS[this.key];
      const age = Math.max(0, now - CONTACT_MS[this.key]);
      const pulseAge = this.key === 'shrine' ? (age + i * 37) % 420 : age - i * 24;
      const envelope = contact ? Math.max(0, 1 - Math.max(0, pulseAge) / 530) : 1;
      cut.visible = envelope > 0 && pulseAge >= 0;
      cut.position.copy(center).add(new THREE.Vector3(count === 1 ? 0 : Math.sin(i * 2.4) * radius,
        count === 1 ? 0 : Math.cos(i * 1.7) * radius * .5, count === 1 ? 0 : Math.sin(i) * radius * .3));
      cut.quaternion.copy(this.camera.quaternion); cut.rotateZ(i % 2 ? -.65 : .65);
      // Cleave forms a grid on the body; Dismantle is a single travelling edge.
      if (this.key === 'cleave' && count > 1) {
        cut.position.copy(center); cut.position.y += ((i % 6) - 2.5) * .18;
        cut.rotateZ(i < 6 ? -.65 : Math.PI / 2 - .65);
      }
      cut.scale.set(count === 1 ? radius * 1.5 : this.key === 'cleave' ? 1.6 : radius, .5 + envelope * 1.5, 1);
      cut.material.opacity = opacity * envelope * (this.reduced ? .65 : 1);
    });
  }
}
