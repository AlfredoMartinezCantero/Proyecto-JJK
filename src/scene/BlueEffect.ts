import * as THREE from 'three';
import { makeGlowTexture } from './materials';

export class BlueEffect {
  readonly root = new THREE.Group();
  private orb: THREE.Mesh;
  private halo: THREE.Sprite;
  private rings: THREE.Mesh[] = [];
  private particles: THREE.Points;
  private positions = new Float32Array(180 * 3);
  private light = new THREE.PointLight('#5daaff', 0, 8, 2);
  private began = -Infinity;
  private origin = new THREE.Vector3();
  private target = new THREE.Vector3(.75, 1.7, -.6);
  private palm: THREE.Vector3 | null = null;
  private charge = 0;
  private intensity = .75;
  private reducedFlashes = true;
  private debug = false;
  attraction = 0;

  constructor(scene: THREE.Scene) {
    const shader = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, intensity: { value: 1 } },
      vertexShader: `varying vec3 vNormal;varying vec3 vPosition;void main(){vNormal=normalize(normalMatrix*normal);vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform float time;uniform float intensity;varying vec3 vNormal;varying vec3 vPosition;
        void main(){float a=atan(vPosition.z,vPosition.x);
        float swirl=sin(a*5.+vPosition.y*27.-time*4.+sin(vPosition.y*19.+time)*1.5)*.5+.5;
        float edge=pow(1.-abs(vNormal.z),2.);vec3 c=mix(vec3(.002,.008,.045),vec3(.08,.38,.95),step(.57,swirl));
        c+=vec3(.1,.65,1.3)*edge;gl_FragColor=vec4(c*(.6+intensity*.5),1.);}`,
    });
    this.orb = new THREE.Mesh(new THREE.SphereGeometry(.32, 32, 24), shader); this.root.add(this.orb);
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture(), color: '#4faaff',
      blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    this.halo.scale.set(2.5, 2.5, 1); this.root.add(this.halo);
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.48 + i * .13, .009, 5, 64),
        new THREE.MeshBasicMaterial({ color: '#97e5ff', transparent: true, opacity: .7, blending: THREE.AdditiveBlending, depthWrite: false }));
      this.rings.push(ring); this.root.add(ring);
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.particles = new THREE.Points(geometry, new THREE.PointsMaterial({
      map: makeGlowTexture(), color: '#94e7ff', size: .085, transparent: true, opacity: .8,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.root.add(this.particles, this.light); this.root.visible = false; scene.add(this.root);
  }

  setSettings(intensity: number, reducedFlashes: boolean): void { this.intensity = intensity; this.reducedFlashes = reducedFlashes; }
  setCharge(progress: number): void { this.charge = progress; }
  setPalm(palm: THREE.Vector3 | null): void { this.palm = palm; }
  setTarget(target: THREE.Vector3): void { this.target.copy(target); }
  activate(now: number, debug: boolean): void {
    this.began = now; this.debug = debug;
    this.origin.copy(this.palm ?? new THREE.Vector3(-.5, 1.8, 1));
  }
  clear(): void { this.charge = 0; this.began = -Infinity; this.root.visible = false; this.attraction = 0; }

  update(now: number): void {
    const elapsed = (now - this.began) / 1000, active = elapsed >= 0 && elapsed < 1.8;
    const charging = this.charge > 0 && this.palm !== null;
    this.root.visible = this.intensity > 0 && (active || charging);
    this.attraction = active && !this.debug ? Math.sin(Math.min(1, elapsed / 1.8) * Math.PI) : 0;
    if (!this.root.visible) return;
    const t = now / 1000, fade = active ? Math.min(1, (1.8 - elapsed) / .65) : this.charge;
    this.root.position.copy(active ? this.origin.clone().lerp(this.target, THREE.MathUtils.smoothstep(elapsed, 0, .7)) : this.palm!);
    const size = active ? .85 + Math.sin(elapsed * Math.PI / 1.8) * .65 : .25 + this.charge * .5;
    this.root.scale.setScalar(size * (.7 + this.intensity * .4));
    (this.orb.material as THREE.ShaderMaterial).uniforms.time.value = t;
    (this.orb.material as THREE.ShaderMaterial).uniforms.intensity.value = this.intensity;
    this.orb.rotation.y = t * .7; this.orb.scale.setScalar(Math.max(.01, fade));
    (this.halo.material as THREE.SpriteMaterial).opacity = fade * this.intensity * (this.reducedFlashes ? .6 : 1);
    this.light.intensity = fade * this.intensity * 4;
    this.rings.forEach((ring, i) => {
      ring.rotation.set(t * .5 + i, t * .8 + i * 1.5, t * .3);
      (ring.material as THREE.MeshBasicMaterial).opacity = fade * .7;
    });
    for (let i = 0; i < 180; i++) {
      const phase = (i * .137 + t * .7) % 1;
      const angle = i * 2.39996 - t * (3 + i % 3 * .2) - phase * 3, r = .2 + (1 - phase) * 2;
      this.positions.set([Math.cos(angle) * r, Math.sin(i * 1.7) * r * .5, Math.sin(angle) * r], i * 3);
    }
    this.particles.geometry.getAttribute('position').needsUpdate = true;
    (this.particles.material as THREE.PointsMaterial).opacity = fade * this.intensity * .7;
  }
}
