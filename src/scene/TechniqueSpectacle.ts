import * as THREE from 'three';
import { CONTACT_MS, smooth01, type CombatState } from './combatTimeline';
import { SukunaCuts, type CuttingTechnique } from './SukunaCuts';
import { isMegumiTechnique } from './megumiTimeline';

const COLORS = { blue: '#138cff', red: '#ff143f', fusion: '#a446ff', purple: '#a45aff',
  domain: '#9bb8ff', dismantle: '#ffe8cf', cleave: '#ff5776', flame: '#ff7414', shrine: '#ff294e' };
const noiseGLSL = `float jjkHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
  float jjkNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(mix(jjkHash(i),jjkHash(i+vec3(1,0,0)),f.x),mix(jjkHash(i+vec3(0,1,0)),jjkHash(i+vec3(1,1,0)),f.x),f.y),
      mix(mix(jjkHash(i+vec3(0,0,1)),jjkHash(i+vec3(1,0,1)),f.x),mix(jjkHash(i+vec3(0,1,1)),jjkHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
  float fbm(vec3 p){return jjkNoise(p)*.55+jjkNoise(p*2.03+3.7)*.27+jjkNoise(p*4.17-2.1)*.13;}`;

/** GPU particles, turbulent energy volumes and pooled curved ribbons, all in world coordinates. */
export class TechniqueSpectacle {
  readonly root = new THREE.Group();
  private readonly volumes: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>[] = [];
  private readonly shock: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private readonly beam: THREE.Mesh<THREE.CylinderGeometry, THREE.ShaderMaterial>;
  private readonly ribbons: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly ribbonPositions = new Float32Array(12 * 40 * 2 * 3);
  private readonly particles: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly rings: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>[] = [];
  private readonly light = new THREE.PointLight('#9380ff', 0, 13, 2);
  private readonly core: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private readonly cuts: SukunaCuts;
  private intensity = .75;
  private reduced = true;
  private quality: 'high' | 'low' = 'high';
  private readonly at = new THREE.Vector3();

  constructor(scene: THREE.Scene, private readonly camera: THREE.Camera) {
    this.root.name = 'Cinematic technique volumes';
    this.cuts = new SukunaCuts(this.root, camera);
    this.core = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, blue: { value: 1 } },
      vertexShader: `varying vec3 p;varying vec3 n;varying vec3 v;void main(){p=position;n=normalize(normalMatrix*normal);
        vec4 mv=modelViewMatrix*vec4(position,1.);v=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `${noiseGLSL}uniform float time;uniform float blue;varying vec3 p;varying vec3 n;varying vec3 v;
        void main(){float rim=pow(1.-abs(dot(normalize(n),normalize(v))),3.);
          float turbulent=fbm(p*4.+vec3(0.,-time*.7,time*.2));
          vec3 purple=mix(vec3(.035,.004,.11),vec3(.65,.19,1.2),smoothstep(.25,.7,turbulent));
          vec3 singularity=vec3(.001,.003,.012)+rim*vec3(.02,.2,.8);
          gl_FragColor=vec4(mix(purple,singularity,blue),1.);}`,
    })); this.core.name = 'Cursed energy nucleus'; this.root.add(this.core);
    for (let i = 0; i < 3; i++) {
      const material = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { time: { value: 0 }, tint: { value: new THREE.Color('#8751ff') }, strength: { value: 0 }, kind: { value: 0 } },
        vertexShader: `uniform float time;uniform float kind;varying vec3 p;varying vec3 n;varying vec3 viewDir;
          void main(){p=position;n=normalize(normalMatrix*normal);vec3 q=position;
          float wave=sin(q.y*13.-time*3.+sin(q.x*9.+time))*sin(q.z*11.+time*2.);
          q*=1.+wave*(kind>2.5?.15:.045);vec4 mv=modelViewMatrix*vec4(q,1.);viewDir=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,
        fragmentShader: `${noiseGLSL}uniform float time;uniform float kind;uniform vec3 tint;uniform float strength;
          varying vec3 p;varying vec3 n;varying vec3 viewDir;
          void main(){float a=atan(p.z,p.x);vec3 q=p*3.;q.x+=sin(a*4.+time)*.35;q.y-=time*(kind>2.5?1.7:.45);
            float turbulence=fbm(q),rim=pow(1.-abs(dot(normalize(n),normalize(viewDir))),2.2);
            float veins=pow(1.-abs(sin(turbulence*18.+a*3.-time*2.)),7.);
            float bands=smoothstep(.35,.75,turbulence);vec3 c=tint*(.2+bands*1.1+rim*1.8);
            c+=mix(tint,vec3(1.,.87,.75),.7)*veins*1.5;
            if(kind>2.5)c=mix(vec3(.7,.025,.002),vec3(1.4,.7,.1),bands)+veins*vec3(1.,.5,.15);
            float alpha=(.17+rim*.48+bands*.22)*strength;gl_FragColor=vec4(c,alpha);}`,
      });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), material); mesh.visible = false;
      this.volumes.push(mesh); this.root.add(mesh);
    }
    this.shock = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { tint: { value: new THREE.Color() }, strength: { value: 0 } },
      vertexShader: `varying vec3 n;varying vec3 v;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `uniform vec3 tint;uniform float strength;varying vec3 n;varying vec3 v;
        void main(){float rim=pow(1.-abs(dot(normalize(n),normalize(v))),5.);gl_FragColor=vec4(tint*1.5,rim*strength);}`,
    }));
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 24, 1, true), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { time: { value: 0 }, strength: { value: 0 }, tint: { value: new THREE.Color() } },
      vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform float time;uniform float strength;uniform vec3 tint;varying vec2 vUv;
        void main(){float filaments=pow(.5+.5*sin(vUv.x*81.+sin(vUv.y*29.-time*9.)*2.),8.);
          gl_FragColor=vec4(tint+vec3(.3,.12,.5)*filaments,filaments*strength*sin(vUv.y*3.14159));}`,
    }));
    const uvs: number[] = [], indices: number[] = [];
    for (let r = 0; r < 12; r++) for (let i = 0; i < 40; i++) {
      uvs.push(i / 39, 0, i / 39, 1);
      if (i < 39) { const a = (r * 40 + i) * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const rg = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(this.ribbonPositions, 3))
      .setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); rg.setIndex(indices);
    this.ribbons = new THREE.Mesh(rg, new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { tint: { value: new THREE.Color() }, strength: { value: 0 } },
      vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform vec3 tint;uniform float strength;varying vec2 vUv;
        void main(){float edge=1.-smoothstep(.15,.5,abs(vUv.y-.5));float core=pow(1.-abs(vUv.y-.5)*2.,12.);
          gl_FragColor=vec4(tint*1.3+core*.65,edge*sin(vUv.x*3.14159)*strength);}`,
    })); this.ribbons.frustumCulled = false;
    const seeds = new Float32Array(9000 * 4);
    for (let i = 0; i < 9000; i++) seeds.set([(i * .6180339) % 1, (i * .381966) % 1, (i * .7548776) % 1, (i * .5698403) % 1], i * 4);
    const pg = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(9000 * 3), 3))
      .setAttribute('seed', new THREE.BufferAttribute(seeds, 4));
    this.particles = new THREE.Points(pg, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { origin: { value: new THREE.Vector3() }, target: { value: new THREE.Vector3() }, center: { value: new THREE.Vector3() },
        time: { value: 0 }, age: { value: 0 }, travel: { value: 0 }, kind: { value: 0 }, strength: { value: 0 }, tint: { value: new THREE.Color() } },
      vertexShader: `uniform vec3 origin;uniform vec3 target;uniform vec3 center;uniform float time;uniform float age;
        uniform float travel;uniform float kind;attribute vec4 seed;varying float opacity;varying float hot;
        void main(){float a=seed.x*6.28318;float y=seed.y*2.-1.;float h=sqrt(max(0.,1.-y*y));vec3 dir=vec3(cos(a)*h,y,sin(a)*h);vec3 p=center;opacity=1.;hot=seed.z;
          if(kind<.5){float phase=fract(seed.z+time*.65);float r=.16+pow(1.-phase,1.4)*3.3;a+=phase*9.-time*3.;p+=vec3(cos(a)*r,y*r*.65,sin(a)*r);opacity=sin(phase*3.14159);}
          else if(kind<1.5){float t=max(0.,age-seed.w*.08);p+=dir*t*(3.+seed.z*7.);p.y=max(.08,p.y+1.8*t-2.8*t*t);
            opacity=step(seed.w*.08,age)*smoothstep(.012,.08,t)*(1.-smoothstep(.25,1.5,t));}
          else if(kind<2.5){float u=seed.z*travel;vec3 axis=normalize(target-origin+vec3(.0001));vec3 side=normalize(cross(axis,vec3(0.,1.,.01)));vec3 up=normalize(cross(side,axis));
            float angle=a+time*5.-u*20.;float r=.1+seed.w*.42;p=mix(origin,center,seed.z)+(side*cos(angle)+up*sin(angle))*r;opacity=sin(seed.z*3.14159);}
          else {float t=max(0.,age);float phase=fract(seed.z+time*.45);float r=age>=0.?phase*(.4+t*1.9):phase*.5;
            p+=vec3(cos(a)*r,phase*(age>=0.?3.4:.4),sin(a)*r);opacity=(1.-phase)*(.4+seed.w*.6);}
          vec4 mv=viewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
          gl_PointSize=clamp((1.2+seed.w*3.)*18./max(1.,-mv.z),1.,9.);}`,
      fragmentShader: `uniform vec3 tint;uniform float strength;varying float opacity;varying float hot;
        void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;float core=exp(-r*r*9.);
          gl_FragColor=vec4(tint*(.6+hot)+vec3(.6)*core,(1.-r)*opacity*strength);}`,
    })); this.particles.frustumCulled = false;
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(.965, 1, 128), new THREE.MeshBasicMaterial({ color: '#9b6aff',
        transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
      ring.rotation.x = -Math.PI / 2; this.rings.push(ring); this.root.add(ring);
    }
    this.root.add(this.ribbons, this.particles, this.shock, this.beam, this.light); scene.add(this.root); this.clear();
  }
  setSettings(intensity: number, reduced: boolean, quality: 'high' | 'low' = this.quality) {
    this.intensity = intensity; this.reduced = reduced; this.quality = quality;
    this.particles.geometry.setDrawRange(0, quality === 'high' ? 9000 : 1800);
  }
  clear() { this.root.visible = false; this.light.intensity = 0; this.cuts.clear(); }
  update(state: CombatState, origin: THREE.Vector3, target: THREE.Vector3, field: THREE.Vector3) {
    if (state.key === 'divergent' || state.key === 'black-flash' || isMegumiTechnique(state.key)) { this.clear(); return; }
    this.root.visible = state.active && this.intensity > 0;
    if (!this.root.visible) return;
    this.volumes.forEach(v => { v.visible = false; }); this.shock.visible = false; this.beam.visible = false;
    this.core.visible = false;
    this.cuts.clear();
    this.rings.forEach(v => { v.visible = false; }); this.ribbons.visible = true;
    const t = state.elapsed / 1000, age = (state.elapsed - CONTACT_MS[state.key]) / 1000;
    const fade = (1 - state.recovery) * this.intensity, color = COLORS[state.key];
    const vortex = state.key === 'blue' || state.key === 'fusion', cut = ['dismantle', 'cleave', 'shrine'].includes(state.key);
    let mode = vortex ? 0 : state.key === 'red' || cut ? 1 : state.key === 'flame' ? 3 : 2;
    this.at.copy(state.key === 'blue' ? field : state.key === 'fusion' ? origin : origin.clone().lerp(target, state.travel));
    if (state.key === 'purple' && age > 0) this.at.addScaledVector(target.clone().sub(origin).normalize(), smooth01(age / 1.1) * 3.2);
    if (state.key === 'domain' || state.key === 'shrine') this.at.copy(target);
    if (state.key === 'blue' || state.key === 'purple') {
      this.core.visible = true; this.core.position.copy(this.at);
      this.core.scale.setScalar(state.key === 'blue' ? .18 + smooth01(t / .7) * .12 : .35 + smooth01(t / .75) * .32);
      this.core.material.uniforms.time.value = t; this.core.material.uniforms.blue.value = state.key === 'blue' ? 1 : 0;
    }
    if (vortex) this.volume(0, this.at, .4 + smooth01(t / .7) * .8, '#168dff', 0, fade, t);
    if (state.key === 'fusion') {
      const m = smooth01(t / .95), r = (1 - m) * 1.1, a = t * 5;
      this.volume(0, this.at.clone().add(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0)), .6 * (1 - m), '#168dff', 0, fade, t);
      this.volume(1, this.at.clone().sub(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0)), .6 * (1 - m), '#ff143f', 1, fade, t);
      this.volume(2, this.at, m * .85, '#ae4cff', 2, fade, t);
    } else if (state.key === 'red') {
      if (age < 0) this.volume(0, this.at, .2 + state.travel * .3, color, 1, fade, t);
      else this.volume(0, target, .2 + smooth01(age / .55) * 2.3, color, 1, fade * Math.exp(-age * 2), t);
    } else if (state.key === 'purple') this.volume(0, this.at, .45 + smooth01(t / .75) * .6, color, 2, fade, t);
    else if (state.key === 'flame') {
      if (age < 0) {
        this.volume(0, this.at, .32 + state.travel * .35, color, 3, fade, t);
        const volume = this.volumes[0]; volume.scale.z *= 2.6;
        volume.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), target.clone().sub(origin).normalize());
      } else {
        this.at.copy(target).setY(1.65);
        this.volume(0, this.at, .25 + smooth01(age / .5) * 2.25, '#ff6614', 3, fade * .8, t);
        this.volumes[0].scale.y *= 1.65;
      }
    }
    if ((state.key === 'purple' || state.key === 'flame') && state.travel > .001 && age < .1) {
      const delta = this.at.clone().sub(origin);
      this.beam.visible = delta.lengthSq() > .001; this.beam.position.copy(origin).add(this.at).multiplyScalar(.5);
      this.beam.scale.set(state.key === 'purple' ? .46 : .16, delta.length(), state.key === 'purple' ? .46 : .16);
      this.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
      this.beam.material.uniforms.tint.value.set(color); this.beam.material.uniforms.time.value = t;
      this.beam.material.uniforms.strength.value = fade * .35;
    }
    const pulseAge = state.key === 'shrine' ? Math.max(0, age) % .42 : age;
    if (age >= 0 && !vortex && state.key !== 'domain') {
      const shockAge = state.key === 'shrine' ? pulseAge : age;
      this.shock.visible = shockAge < 1;
      this.shock.position.copy(target); this.shock.scale.setScalar(.3 + shockAge * (state.key === 'flame' ? 8 : 7));
      this.shock.material.uniforms.tint.value.set(color);
      this.shock.material.uniforms.strength.value = fade * Math.exp(-shockAge * 4) * (this.reduced ? .3 : .65);
      this.rings.forEach((ring, i) => { const localAge = shockAge - i * .07; ring.visible = localAge >= 0 && localAge < 1.3;
        ring.position.set(target.x, .092 + i * .002, target.z); ring.scale.setScalar(.2 + Math.max(0, localAge) * (7 + i));
        ring.material.color.set(color); ring.material.opacity = fade * Math.exp(-Math.max(0, localAge) * 3) * .7; });
    }
    const center = state.key === 'shrine' || state.key === 'domain' ? target : this.at;
    if (cut) {
      this.ribbons.visible = false;
      this.cuts.update(state.key as CuttingTechnique, state.elapsed, center, state.travel, fade, this.reduced);
    } else this.drawRibbons(center, t, state.key === 'domain', color, fade);
    const uniforms = this.particles.material.uniforms;
    uniforms.origin.value.copy(origin); uniforms.target.value.copy(target); uniforms.center.value.copy(this.at);
    uniforms.time.value = t; uniforms.age.value = age; uniforms.kind.value = mode;
    uniforms.travel.value = state.travel; uniforms.tint.value.set(color); uniforms.strength.value = fade * (this.reduced ? .22 : .45);
    this.particles.visible = !cut && state.key !== 'domain' && (mode !== 1 || age >= 0);
    this.light.color.set(color); this.light.position.copy(this.at); this.light.intensity = fade * (this.reduced ? 2.2 : 4);
  }
  private volume(index: number, center: THREE.Vector3, size: number, color: string, kind: number, opacity: number, time: number) {
    const v = this.volumes[index]; v.visible = size > .002 && opacity > .002; v.position.copy(center); v.scale.setScalar(size);
    v.quaternion.identity(); v.material.uniforms.time.value = time; v.material.uniforms.kind.value = kind;
    v.material.uniforms.tint.value.set(color); v.material.uniforms.strength.value = opacity * (this.reduced ? .65 : 1);
  }
  private drawRibbons(center: THREE.Vector3, time: number, domain: boolean, color: string, opacity: number) {
    this.ribbons.geometry.setDrawRange(0, 12 * 39 * 6);
    this.ribbons.material.uniforms.tint.value.set(color); this.ribbons.material.uniforms.strength.value = opacity * (this.reduced ? .55 : .9);
    for (let r = 0; r < 12; r++) for (let i = 0; i < 40; i++) {
      const u = i / 39, angle = u * Math.PI * 1.65 + r * 2.39996 + time * (domain ? .2 : 1.3);
      let x: number, y: number, z: number, width: number;
      const radius = (domain ? 2.2 : .75) + Math.sin(u * Math.PI) * .35 + r % 3 * .1;
      x = Math.cos(angle) * radius; y = Math.sin(angle) * radius * Math.sin(r * 1.7) + (u - .5) * .8; z = Math.sin(angle) * radius;
      width = (domain ? .018 : .035) * Math.sin(u * Math.PI);
      for (let side = 0; side < 2; side++) this.ribbonPositions.set([center.x + x, center.y + y + (side ? 1 : -1) * width, center.z + z], ((r * 40 + i) * 2 + side) * 3);
    }
    this.ribbons.geometry.getAttribute('position').needsUpdate = true;
  }
}
