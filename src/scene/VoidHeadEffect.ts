import * as THREE from 'three';
import { smooth01, type CombatState } from './combatTimeline';

/** Domain pressure and surface sparks; the head's physical shards are separate. */
export class VoidHeadEffect {
  readonly root = new THREE.Group();
  private readonly pressure = new THREE.Group();
  private readonly rings: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>[] = [];
  private readonly particles: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly radius: THREE.Vector3;

  constructor(parent: THREE.Object3D, surface: THREE.BufferGeometry) {
    this.root.name = 'Void head energy'; this.pressure.name = 'Void head pressure';
    surface.computeBoundingBox();
    const center = surface.boundingBox!.getCenter(new THREE.Vector3());
    this.radius = surface.boundingBox!.getSize(new THREE.Vector3()).multiplyScalar(.56);
    this.pressure.position.copy(center);
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1, .012, 5, 56), new THREE.MeshBasicMaterial({
        color: i === 1 ? '#ece8ff' : '#948cff', transparent: true, opacity: 0,
        depthWrite: false, blending: THREE.AdditiveBlending }));
      ring.name = `Void head pressure ring ${i}`;
      this.pressure.add(ring); this.rings.push(ring);
    }
    const source = surface.getAttribute('position'), positions = new Float32Array(480 * 3), seeds = new Float32Array(480);
    for (let i = 0; i < 480; i++) {
      const seed = (i * .61803398875) % 1, index = Math.floor(seed * source.count);
      positions.set([source.getX(index), source.getY(index), source.getZ(index)], i * 3); seeds[i] = seed;
    }
    const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(positions, 3))
      .setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
    this.particles = new THREE.Points(geometry, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { age: { value: 0 }, strength: { value: 0 }, center: { value: center } },
      vertexShader: `uniform float age;uniform vec3 center;attribute float seed;varying float life;
        void main(){vec3 axis=normalize(position-center+vec3(.001));
          vec3 p=position+axis*age*(1.2+seed*2.8);p.y-=age*age*2.;
          vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
          gl_PointSize=clamp((2.+seed*3.)*14./max(1.,-mv.z),1.,7.);
          life=(1.-smoothstep(.2,.95,age))*(.4+seed*.6);}`,
      fragmentShader: `uniform float strength;varying float life;
        void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;
          vec3 color=mix(vec3(.28,.2,.65),vec3(.85,.88,1.),1.-r);
          gl_FragColor=vec4(color,(1.-r*r)*life*strength);}`,
    }));
    this.particles.name = 'Void head burst particles'; this.particles.frustumCulled = false;
    this.root.add(this.pressure, this.particles); parent.add(this.root);
    this.root.visible = false;
  }

  update(state: CombatState, intensity: number, reduced: boolean, quality: 'high' | 'low'): boolean {
    const valid = state.active && !state.preview && state.key === 'domain' && intensity > 0;
    const age = (state.elapsed - state.contactMs) / 1000;
    const charge = valid && age < 0 ? smooth01((state.elapsed - state.contactMs + 650) / 650) : 0;
    this.pressure.visible = charge > .001;
    this.particles.visible = valid && age >= 0 && age < .95;
    this.root.visible = this.pressure.visible || this.particles.visible;
    if (!this.root.visible) return false;
    this.rings.forEach((ring, i) => {
      const converge = 1.25 - charge * .25;
      ring.scale.copy(this.radius).multiplyScalar(converge);
      ring.rotation.set(Math.PI * i / 3, state.elapsed / (reduced ? 2200 : 1200) + i * .5, i * .7);
      ring.material.opacity = charge * intensity * (reduced ? .22 : .45);
    });
    this.particles.geometry.setDrawRange(0, quality === 'high' ? 480 : 128);
    this.particles.material.uniforms.age.value = Math.max(0, age);
    this.particles.material.uniforms.strength.value = intensity * (reduced ? .4 : .75);
    return true;
  }
}
