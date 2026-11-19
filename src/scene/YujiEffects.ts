import * as THREE from 'three';
import { TECHNIQUES } from '../core/techniques';
import type { TechniqueKey } from '../core/types';
import { combatTimeline, smooth01 } from './combatTimeline';
import { isYujiTechnique } from './yujiTimeline';

/** Pooled fist aura, energy wake, delayed pulses and volumetric black/red lightning. */
export class YujiEffects {
  readonly root = new THREE.Group();
  private key: 'divergent' | 'black-flash' = 'divergent';
  private began = -Infinity;
  private primary: THREE.Vector3 | null = null;
  private charge = 0;
  private step = 0;
  private intensity = .75;
  private reduced = true;
  private readonly target = new THREE.Vector3(2,1.47,-1.35);
  private readonly origin = new THREE.Vector3();
  private readonly aura: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private readonly core: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  private readonly bolts: THREE.InstancedMesh;
  private readonly boltEdges: THREE.InstancedMesh;
  private readonly waves: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>[] = [];
  private readonly wake: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  private readonly positions = new Float32Array(8*24*2*3);
  private readonly particles: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly light = new THREE.PointLight('#4bd3ff',0,10,2);
  private readonly dummy = new THREE.Object3D();
  private readonly a = new THREE.Vector3();
  private readonly b = new THREE.Vector3();
  private readonly direction = new THREE.Vector3();
  private readonly up = new THREE.Vector3(0,1,0);
  private readonly center = new THREE.Vector3();
  private pulse = 0;
  get attraction() { return 0; }
  get repulsion() { return this.pulse; }
  get impact() { return this.pulse; }
  get stun() { return 0; }
  get domainMix() { return 0; }
  constructor(scene: THREE.Scene, private readonly camera: THREE.Camera) {
    this.root.name = 'Yuji cursed fist effects';
    this.aura = new THREE.Mesh(new THREE.SphereGeometry(1,32,20),new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { time: { value: 0 }, strength: { value: 0 }, tint: { value: new THREE.Color('#58dfff') } },
      vertexShader: `varying vec3 p;varying vec3 n;varying vec3 v;uniform float time;
        void main(){p=position;n=normalize(normalMatrix*normal);vec3 q=position*(1.+.09*sin(position.y*13.+time*2.)*sin(position.x*11.-time));
          vec4 mv=modelViewMatrix*vec4(q,1.);v=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `varying vec3 p;varying vec3 n;varying vec3 v;uniform float time;uniform float strength;uniform vec3 tint;
        void main(){float rim=pow(1.-abs(dot(normalize(n),normalize(v))),1.8);
          float veins=pow(.5+.5*sin(p.y*22.+sin(p.x*17.+time*1.8)*2.-time*3.),5.);
          gl_FragColor=vec4(tint*(.6+veins),strength*(rim*.7+veins*.18));}`,
    })); this.aura.name = 'Observed fist cursed aura'; this.root.add(this.aura);
    this.core = new THREE.Mesh(new THREE.SphereGeometry(1,24,16),new THREE.MeshBasicMaterial({
      color: '#09030a', transparent: true, opacity: 0, depthWrite: false })); this.core.name = 'Black Flash contact nucleus'; this.root.add(this.core);
    const cylinder = new THREE.CylinderGeometry(1,1,1,6,1,true);
    this.boltEdges = new THREE.InstancedMesh(cylinder,new THREE.MeshBasicMaterial({color:'#ff1645',transparent:true,opacity:.8,depthWrite:false,blending:THREE.AdditiveBlending}),18*11);
    this.bolts = new THREE.InstancedMesh(cylinder,new THREE.MeshBasicMaterial({color:'#09030b',transparent:true,opacity:1,depthWrite:true}),18*11);
    this.boltEdges.name = 'Black Flash crimson lightning edges'; this.bolts.name = 'Black Flash black lightning cores';
    for (const [index,mesh] of [this.boltEdges,this.bolts].entries()) {
      mesh.frustumCulled = false; mesh.renderOrder = 6+index; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.root.add(mesh);
    }
    const geometry = new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(this.positions,3));
    const indices: number[] = [];
    for (let r = 0; r < 8; r++) for (let j = 0; j < 23; j++) { const i = (r*24+j)*2; indices.push(i,i+1,i+2,i+1,i+3,i+2); }
    geometry.setIndex(indices);
    this.wake = new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:'#61ddff',transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));
    this.wake.name = 'Yuji fist energy wake'; this.wake.frustumCulled = false; this.root.add(this.wake);
    for (let i = 0; i < 3; i++) {
      const wave = new THREE.Mesh(new THREE.RingGeometry(.92,1,96),new THREE.MeshBasicMaterial({color:'#79e7ff',transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));
      wave.name = `Yuji contact ring ${i}`; this.waves.push(wave); this.root.add(wave);
    }
    const seeds = new Float32Array(900*3);
    for (let i = 0; i < seeds.length; i++) seeds[i] = ((Math.sin(i*127.1+311.7)*43758.5453)%1+1)%1;
    const particles = new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(seeds,3));
    this.particles = new THREE.Points(particles,new THREE.ShaderMaterial({ transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
      uniforms:{ age:{value:0},strength:{value:0},tint:{value:new THREE.Color('#6ae4ff')} },
      vertexShader:`uniform float age;varying float alpha;void main(){float t=max(0.,age-position.z*.06);float a=position.x*6.283185;
        float speed=1.+position.y*5.;vec3 p=vec3(cos(a)*t*speed,position.z*t*speed*1.3-t*t*2.,sin(a)*t*speed);
        alpha=step(position.z*.06,age)*(1.-smoothstep(.25,1.15,t));vec4 mv=modelViewMatrix*vec4(p,1.);
        gl_Position=projectionMatrix*mv;gl_PointSize=clamp((2.+position.y*4.)*16./max(1.,-mv.z),1.,9.);}`,
      fragmentShader:`uniform float strength;uniform vec3 tint;varying float alpha;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;gl_FragColor=vec4(tint,(1.-r*r)*alpha*strength);}`,
    })); this.particles.name = 'Yuji contact sparks'; this.particles.frustumCulled = false;
    this.root.add(this.particles,this.light); scene.add(this.root); this.clear();
  }
  setTarget(target: THREE.Vector3) { this.target.copy(target); }
  setTechnique(key: TechniqueKey) { this.clear(); if (isYujiTechnique(key)) this.key = key; }
  setSettings(intensity: number, reduced: boolean, quality: 'high' | 'low' = 'high') {
    this.intensity = intensity; this.reduced = reduced; this.particles.geometry.setDrawRange(0,quality === 'high' ? 900 : 220);
  }
  setPalms(a: THREE.Vector3 | null, _b: THREE.Vector3 | null) { this.primary = a; }
  setCharge(progress: number, step = 0) { this.charge = progress; this.step = step; }
  activate(now: number, _debug: boolean) { this.began = now; this.origin.copy(this.primary ?? new THREE.Vector3(-1,2,1)); }
  clear() { this.root.visible = false; this.began = -Infinity; this.primary = null; this.charge = 0; this.step = 0; this.pulse = 0; this.light.intensity = 0; }
  update(now: number) {
    const state = combatTimeline(this.key,now-this.began,TECHNIQUES[this.key].effectMs);
    const charging = this.primary !== null && (this.charge > 0 || this.step > 0);
    this.root.visible = this.intensity > 0 && (state.active || charging); this.pulse = state.pulse;
    this.light.intensity = 0; if (!this.root.visible) return;
    const black = this.key === 'black-flash', color = black ? '#ff214a' : '#65ddff';
    const age = state.hitAge/1000, contact = state.active && age >= 0, fade = (1-state.recovery)*this.intensity;
    this.center.copy(state.active ? this.origin : this.primary!);
    if (state.active) this.center.lerp(this.target,state.travel);
    this.aura.visible = charging || state.active && state.elapsed < state.contactMs+350;
    this.aura.position.copy(this.center); this.aura.scale.setScalar(.15+(state.active ? state.travel*.15 : this.step > 0 ? .12 : this.charge*.10));
    this.aura.material.uniforms.time.value = now/1000; this.aura.material.uniforms.tint.value.set(color);
    this.aura.material.uniforms.strength.value = this.intensity*(this.reduced?.48:.8);
    this.core.visible = black && contact && age < .32; this.core.position.copy(this.target);
    this.core.scale.setScalar(.18+smooth01(age/.3)*.6); this.core.material.opacity = fade*(1-smooth01(age/.32));
    const boltPower = black && contact ? Math.exp(-age*3)*fade : black && charging ? .22*this.intensity : 0;
    this.bolts.visible = this.boltEdges.visible = boltPower > .015;
    if (this.bolts.visible) this.lightning(contact ? this.target : this.center,contact ? .25+smooth01(age/.3)*2.3 : .30,now/1000,boltPower);
    this.wake.visible = state.active && state.elapsed < state.contactMs+300;
    if (this.wake.visible) this.drawWake(state.travel,now/1000,color,fade*(1-smooth01((state.elapsed-state.contactMs)/300)));
    this.waves.forEach((wave,i) => {
      const t = age-i*.055; wave.visible = contact && t >= 0 && t < .9;
      wave.position.copy(this.target); wave.material.color.set(color); wave.material.opacity = fade*Math.exp(-Math.max(0,t)*5)*(this.reduced?.42:.75);
      wave.scale.setScalar(.2+Math.max(0,t)*(black?7:5));
      if (i === 0) wave.quaternion.copy(this.camera.quaternion);
      else { wave.rotation.set(-Math.PI/2,0,i*.35); wave.position.y = .09+i*.003; }
    });
    this.particles.visible = contact && age < 1.2; this.particles.position.copy(this.target);
    this.particles.material.uniforms.age.value = Math.max(0,age); this.particles.material.uniforms.strength.value = fade*(this.reduced?.6:1);
    this.particles.material.uniforms.tint.value.set(color);
    this.light.position.copy(this.center); this.light.color.set(color);
    this.light.intensity = fade*(charging?.35:state.pulse*(this.reduced?2:4));
  }
  private lightning(center: THREE.Vector3, radius: number, time: number, power: number) {
    for (let branch = 0; branch < 18; branch++) {
      const angle = branch*2.39996, z = Math.sin(branch*3.17)*.85, planar = Math.sqrt(1-z*z);
      for (let segment = 0; segment < 11; segment++) {
        for (const [j,p] of [this.a,this.b].entries()) {
          const u = (segment+j)/11, zig = Math.sin((segment+j)*7.13+branch*2.7+time*2)*.14*u;
          p.set(Math.cos(angle)*planar*u+Math.sin(angle)*zig,z*u+Math.cos(branch*4.3)*zig,Math.sin(angle)*planar*u-Math.cos(angle)*zig).multiplyScalar(radius).add(center);
        }
        this.direction.copy(this.b).sub(this.a); this.dummy.position.copy(this.a).add(this.b).multiplyScalar(.5);
        this.dummy.quaternion.setFromUnitVectors(this.up,this.direction.clone().normalize());
        const width = (.025*(1-segment/14)+.006)*Math.max(.25,power);
        this.dummy.scale.set(width,this.direction.length(),width); this.dummy.updateMatrix(); this.boltEdges.setMatrixAt(branch*11+segment,this.dummy.matrix);
        this.dummy.scale.x *= .48; this.dummy.scale.z *= .48; this.dummy.updateMatrix(); this.bolts.setMatrixAt(branch*11+segment,this.dummy.matrix);
      }
    }
    (this.boltEdges.material as THREE.MeshBasicMaterial).opacity = Math.min(.9,power);
    this.bolts.instanceMatrix.needsUpdate = this.boltEdges.instanceMatrix.needsUpdate = true;
  }
  private drawWake(travel: number, time: number, color: string, fade: number) {
    this.direction.copy(this.target).sub(this.origin); const length = this.direction.length();
    this.direction.normalize(); this.a.crossVectors(this.direction,this.up).normalize(); this.b.crossVectors(this.direction,this.a).normalize();
    for (let ribbon = 0; ribbon < 8; ribbon++) for (let j = 0; j < 24; j++) {
      const u = j/23, phase = ribbon*Math.PI/4+u*5-time*3, spread = Math.sin(u*Math.PI)*(.09+ribbon%3*.025), width = .012*Math.sin(u*Math.PI);
      for (let side = 0; side < 2; side++) {
        const r = spread+(side?1:-1)*width, index = ((ribbon*24+j)*2+side)*3;
        this.positions[index] = this.origin.x+this.direction.x*length*u*travel+this.a.x*Math.cos(phase)*r+this.b.x*Math.sin(phase)*r;
        this.positions[index+1] = this.origin.y+this.direction.y*length*u*travel+this.a.y*Math.cos(phase)*r+this.b.y*Math.sin(phase)*r;
        this.positions[index+2] = this.origin.z+this.direction.z*length*u*travel+this.a.z*Math.cos(phase)*r+this.b.z*Math.sin(phase)*r;
      }
    }
    this.wake.geometry.getAttribute('position').needsUpdate = true; this.wake.material.color.set(color); this.wake.material.opacity = fade*.5;
  }
}
