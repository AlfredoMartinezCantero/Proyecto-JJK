import * as THREE from 'three';
import { makeGlowTexture } from './materials';
import { shrineTimeline } from './shrineTimeline';
import { CONTACT_MS } from './combatTimeline';

export type ShrineAssetStatus = 'idle' | 'loading' | 'ready' | 'error';
export const SHRINE_MODEL_URL = `${import.meta.env.BASE_URL}assets/shrine/malevolent-shrine.glb`;
type ModelLoader = () => Promise<THREE.Object3D>;
const defaultLoader: ModelLoader = async () => {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  return (await new GLTFLoader().loadAsync(SHRINE_MODEL_URL)).scene;
};

export function disposeShrineModel(root: THREE.Object3D) {
  const materials = new Set<THREE.Material>(), geometries = new Set<THREE.BufferGeometry>(), textures = new Set<THREE.Texture>();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => materials.add(m));
  });
  materials.forEach(material => {
    Object.values(material).forEach(value => { if (value instanceof THREE.Texture) textures.add(value); }); material.dispose();
  });
  geometries.forEach(g => g.dispose()); textures.forEach(t => t.dispose());
}

/** Static imported mesh, animated rise/reveal, red atmosphere and floor. No invented skeleton. */
export class ShrineDomain {
  readonly root = new THREE.Group();
  private readonly building = new THREE.Group();
  private readonly fallback = new THREE.Group();
  private model: THREE.Object3D | null = null;
  private useModel = false;
  private playing = false;
  private disposed = false;
  private pending: Promise<void> | null = null;
  private status: ShrineAssetStatus = 'idle';
  private readonly materials = new Set<THREE.MeshStandardMaterial>();
  private readonly reveal = { value: 0 };
  private readonly opacity = { value: 0 };
  private readonly sky: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private readonly floor: THREE.Mesh<THREE.CircleGeometry, THREE.ShaderMaterial>;
  private readonly seal: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private readonly mist: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly dust: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly light = new THREE.PointLight('#ff5039', 0, 25, 1.6);
  private readonly rim = new THREE.DirectionalLight('#d33142', 0);

  constructor(private readonly onStatus: (status: ShrineAssetStatus) => void = () => {}, private readonly loadModel: ModelLoader = defaultLoader) {
    this.root.name = 'Malevolent Shrine domain'; this.building.name = 'Shrine rising model';
    this.building.position.set(0, .065, -8.7); this.root.add(this.building);
    this.fallback.name = 'Shrine fallback'; this.createFallback(); this.materials.forEach(m => this.prepareMaterial(m)); this.building.add(this.fallback);
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(65, 32, 20), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, transparent: true,
      uniforms: { amount: { value: 0 }, time: { value: 0 } },
      vertexShader: `varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform float amount;uniform float time;varying vec3 p;
        void main(){vec3 d=normalize(p);float h=smoothstep(-.15,.75,d.y);
        float clouds=sin(d.x*14.+sin(d.z*11.+time*.12))*sin(d.z*9.-time*.07);
        vec3 c=mix(vec3(.28,.024,.035),vec3(.009,.003,.012),h);
        c+=vec3(.035,.002,.004)*clouds*(1.-h);gl_FragColor=vec4(c,amount);}`,
    }));
    this.sky.renderOrder = -10; this.root.add(this.sky);
    this.floor = new THREE.Mesh(new THREE.CircleGeometry(35, 96), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { amount: { value: 0 }, time: { value: 0 }, expansion: { value: 0 } },
      vertexShader: `varying vec2 p;void main(){p=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform float amount;uniform float time;uniform float expansion;varying vec2 p;
        void main(){float r=length(p);float a=atan(p.y,p.x);float ripple=sin(r*6.-time*2.2)*.5+.5;
        float streak=pow(max(0.,sin(a*17.+sin(r*1.4))),22.);
        float wave=exp(-pow((r-expansion*24.)*.8,2.));
        vec3 c=vec3(.025,.009,.014)+vec3(.045,.004,.008)*ripple/(1.+r*.15);
        c+=vec3(.28,.014,.025)*(streak*.24+wave*.5);
        gl_FragColor=vec4(c,amount*(1.-smoothstep(23.,35.,r)));}`,
    }));
    this.floor.rotation.x = -Math.PI / 2; this.floor.position.y = .058; this.floor.renderOrder = -2; this.root.add(this.floor);
    this.seal = new THREE.Mesh(new THREE.RingGeometry(1, 1.012, 160), new THREE.MeshBasicMaterial({
      color: '#d95350', side: THREE.DoubleSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.seal.rotation.x = -Math.PI / 2; this.seal.position.y = .075; this.root.add(this.seal);
    const cloud = (count: number, dust: boolean) => {
      const seeds = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) seeds.set([(i * .61803398875) % 1, (i * .41421356237) % 1, (i * .73205080757) % 1], i * 3);
      const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(seeds, 3));
      const points = new THREE.Points(geometry, new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, uniforms: { time: { value: 0 }, strength: { value: 0 },
          sprite: { value: makeGlowTexture() }, dust: { value: dust ? 1 : 0 } },
        vertexShader: `uniform float time;uniform float dust;varying float fade;
          void main(){float angle=position.x*6.2831853+time*.035;
          float phase=fract(position.y+time*(dust>.5?.16:.025));
          float radius=dust>.5?3.+phase*5.:4.+position.y*13.;
          vec3 p=vec3(cos(angle)*radius, dust>.5?.12+sin(phase*3.14)*1.4:.15+position.z*.7, sin(angle)*radius-7.);
          vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
          gl_PointSize=min(170.,(dust>.5?90.:1200.)/max(1.,-mv.z));
          fade=dust>.5?sin(phase*3.14159):.4+position.z*.5;}`,
        fragmentShader: `uniform sampler2D sprite;uniform float strength;uniform float dust;varying float fade;
          void main(){float a=texture2D(sprite,gl_PointCoord).a;
          vec3 c=mix(vec3(.22,.024,.034),vec3(.42,.24,.2),dust);gl_FragColor=vec4(c,a*fade*strength);}`,
      }));
      points.frustumCulled = false; return points;
    };
    this.mist = cloud(240, false); this.dust = cloud(500, true);
    this.mist.name = 'Shrine ground mist'; this.dust.name = 'Shrine emergence dust'; this.root.add(this.mist, this.dust);
    this.light.position.set(0, 3.5, -2.5); this.rim.position.set(1, 8, -15); this.rim.target.position.set(0, 3, -8.7);
    this.root.add(this.light, this.rim, this.rim.target); this.clear();
  }
  private createFallback() {
    const material = new THREE.MeshStandardMaterial({ color: '#6b3234', roughness: .85 }); this.materials.add(material);
    const bone = new THREE.MeshStandardMaterial({ color: '#c3b39a', roughness: .9 }); this.materials.add(bone);
    const add = (geometry: THREE.BufferGeometry, x: number, y: number, z: number, mat = material) => {
      const mesh = new THREE.Mesh(geometry, mat); mesh.position.set(x, y, z); this.fallback.add(mesh); return mesh;
    };
    add(new THREE.BoxGeometry(8, .4, 5.8), 0, .2, 0);
    add(new THREE.BoxGeometry(4.8, 3.8, 3.8), 0, 2.1, -.4);
    for (const x of [-2.6, 2.6]) add(new THREE.CylinderGeometry(.2, .3, 4.5, 8), x, 2.5, 1.9, bone);
    for (const [y, r] of [[4.7, 5.1], [6, 4.1]]) {
      const roof = add(new THREE.ConeGeometry(r, 1.5, 4), 0, y, 0); roof.rotation.y = Math.PI / 4; roof.scale.z = .85;
    }
    const jaw = add(new THREE.TorusGeometry(1.6, .25, 8, 30, Math.PI), 0, 1.2, 2.1, bone); jaw.scale.y = .8;
    for (let i = 0; i < 9; i++) {
      const tooth = add(new THREE.ConeGeometry(.14, .55, 5), (i - 4) * .36, 1.5 + Math.sin(i / 8 * Math.PI) * 1.2, 2.1, bone);
      tooth.rotation.z = Math.PI;
    }
  }
  preload(): Promise<void> {
    if (this.disposed || this.status === 'ready') return Promise.resolve();
    if (this.pending) return this.pending;
    this.status = 'loading'; this.onStatus('loading');
    this.pending = this.loadModel().then(model => {
      if (this.disposed) { disposeShrineModel(model); return; }
      model.name = 'Imported Malevolent Shrine';
      model.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        object.castShadow = false; object.receiveShadow = false;
        (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => {
          if (!(material instanceof THREE.MeshStandardMaterial)) return;
          material.normalScale.set(.65, -.65); material.roughness = .84;
          material.emissive.set('#553a32'); material.emissiveIntensity = .16; material.emissiveMap = material.map;
          this.materials.add(material); this.prepareMaterial(material);
        });
      });
      this.model = model; this.building.add(model); model.visible = !this.playing;
      this.status = 'ready'; this.onStatus('ready');
    }).catch(() => { if (!this.disposed) { this.status = 'error'; this.onStatus('error'); } })
      .finally(() => { this.pending = null; });
    return this.pending;
  }
  private prepareMaterial(material: THREE.MeshStandardMaterial) {
    material.onBeforeCompile = shader => {
      shader.uniforms.shrineReveal = this.reveal; shader.uniforms.shrineOpacity = this.opacity;
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 shrinePosition;')
        .replace('#include <project_vertex>', 'shrinePosition=(modelMatrix*vec4(transformed,1.)).xyz;\n#include <project_vertex>');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 shrinePosition;uniform float shrineReveal;uniform float shrineOpacity;')
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
          float grain=fract(sin(dot(floor(shrinePosition.xz*22.),vec2(12.9898,78.233)))*43758.5453);
          if(shrinePosition.y<.06 || grain>shrineOpacity) discard;
          float edge=shrineReveal*10.-shrinePosition.y+sin(shrinePosition.x*5.)*.12;
          if(edge<0.) discard;`)
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vec3(.65,.045,.015)*(1.-smoothstep(0.,.28,edge));');
    };
    material.customProgramCacheKey = () => 'shrine-emergence-v1'; material.needsUpdate = true;
  }
  begin() { this.playing = true; this.useModel = this.model !== null; }
  clear() {
    this.playing = false; this.root.visible = false; this.light.intensity = 0; this.rim.intensity = 0;
  }
  update(elapsed: number, duration: number, intensity: number, reduced: boolean, quality: 'high' | 'low') {
    const s = shrineTimeline(elapsed, duration);
    this.root.visible = s.active && intensity > 0;
    if (!this.root.visible) { this.clear(); return; }
    this.fallback.visible = !this.useModel; if (this.model) this.model.visible = this.useModel;
    this.building.position.y = .065 - (1 - s.rise) * 8.5;
    this.reveal.value = s.reveal; this.opacity.value = s.exit;
    const amount = s.atmosphere * Math.min(1, intensity * 1.4);
    this.sky.material.uniforms.amount.value = amount; this.sky.material.uniforms.time.value = elapsed / 1000;
    this.floor.material.uniforms.amount.value = amount; this.floor.material.uniforms.time.value = elapsed / 1000;
    this.floor.material.uniforms.expansion.value = Math.min(1, elapsed / CONTACT_MS.shrine);
    this.seal.scale.setScalar(.3 + Math.min(1, elapsed / CONTACT_MS.shrine) * 24);
    this.seal.material.opacity = amount * (reduced ? .25 : .5) * (1 - Math.min(1, elapsed / 3500));
    this.mist.geometry.setDrawRange(0, quality === 'high' ? 240 : 80);
    this.dust.geometry.setDrawRange(0, quality === 'high' ? 500 : 160);
    this.mist.material.uniforms.time.value = elapsed / 1000; this.mist.material.uniforms.strength.value = amount * .35;
    this.dust.material.uniforms.time.value = elapsed / 1000; this.dust.material.uniforms.strength.value = s.dust * intensity * .38;
    this.light.intensity = amount * (reduced ? 12 : 18); this.rim.intensity = amount * .7;
  }
  dispose() {
    this.disposed = true; this.clear();
    this.mist.material.uniforms.sprite.value.dispose(); this.dust.material.uniforms.sprite.value.dispose();
    // TrainingScene owns attached GPU resources; late arrivals are disposed in preload().
  }
}
