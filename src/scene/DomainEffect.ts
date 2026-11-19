import * as THREE from 'three';

export class DomainEffect {
  readonly root = new THREE.Group();
  private readonly dome: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private readonly stars: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private readonly eye: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private readonly rings: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>[] = [];

  constructor(scene: THREE.Scene, private readonly camera: THREE.Camera) {
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(60, 32, 20), new THREE.ShaderMaterial({
      side: THREE.BackSide, transparent: true, depthWrite: false,
      uniforms: { time: { value: 0 }, mixAmount: { value: 0 } },
      vertexShader: `varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform float time;uniform float mixAmount;varying vec3 direction;
        void main(){vec3 d=normalize(direction);float longitude=atan(d.z,d.x);float latitude=asin(d.y);
        float flow=sin(longitude*6.+latitude*4.+time*.13)*.5+.5;
        float ribbon=pow(max(0.,1.-abs(latitude+.08*sin(longitude*4.+time*.12))),16.);
        vec3 c=mix(vec3(.004,.005,.022),vec3(.04,.018,.14),flow);
        float filaments=pow(max(0.,sin(longitude*18.+sin(latitude*12.+time*.08)*2.)),18.);
        float nebula=pow(.5+.5*sin(longitude*3.+latitude*8.+sin(longitude*9.-time*.07)),3.);
        float tunnel=pow(max(0.,1.-abs(sin(latitude*5.+longitude*.3-time*.08))),10.);
        c+=vec3(.035,.015,.12)*nebula+vec3(.08,.11,.23)*filaments*tunnel;
        c+=vec3(.12,.21,.38)*ribbon;gl_FragColor=vec4(c,mixAmount);}`,
    }));
    this.root.add(this.dome);
    const points = new Float32Array(1500 * 3);
    for (let i = 0; i < 1500; i++) {
      const angle = i * 2.399963, y = 1 - (i + .5) / 1500 * 2;
      const r = 23 + (i % 23) * 1.2, horizontal = Math.sqrt(1 - y * y);
      points.set([Math.cos(angle) * horizontal * r, y * r + 3, Math.sin(angle) * horizontal * r], i * 3);
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
    this.stars = new THREE.Points(geometry, new THREE.PointsMaterial({ color: '#d4d4ff', size: .065,
      transparent: true, depthWrite: false, opacity: 0, fog: false, blending: THREE.AdditiveBlending }));
    this.root.add(this.stars);
    this.eye = new THREE.Mesh(new THREE.PlaneGeometry(11, 11), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { time: { value: 0 }, mixAmount: { value: 0 } },
      vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform float time;uniform float mixAmount;varying vec2 vUv;
        void main(){vec2 p=(vUv-.5)*2.;p.y*=1.35;float r=length(p),a=atan(p.y,p.x);
        float ring=exp(-pow((r-.45)*23.,2.));float veins=pow(.5+.5*sin(a*25.-r*38.+time*.45),5.);
        float halo=exp(-r*3.);vec3 c=vec3(.25,.3,.75)*halo+vec3(.75,.86,1.)*ring;
        c+=vec3(.12,.2,.65)*veins*smoothstep(.15,.3,r)*(1.-smoothstep(.5,.9,r));
        c*=smoothstep(.1,.22,r);float alpha=(1.-smoothstep(.65,1.,r))*mixAmount;gl_FragColor=vec4(c,alpha);}`,
    }));
    this.eye.position.set(-1, 5, -13); this.root.add(this.eye);
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(9 + i * 2, .012, 4, 128),
        new THREE.MeshBasicMaterial({ color: '#879aff', transparent: true, opacity: 0, fog: false, depthWrite: false }));
      ring.position.set(0, 2, 0); ring.rotation.x = Math.PI / 2 + i * .3;
      this.rings.push(ring); this.root.add(ring);
    }
    this.root.visible = false; scene.add(this.root);
  }

  update(now: number, amount: number, reduced: boolean): void {
    this.root.visible = amount > .001;
    if (!this.root.visible) return;
    this.dome.material.uniforms.time.value = now / 1000;
    this.dome.material.uniforms.mixAmount.value = amount;
    this.eye.material.uniforms.time.value = now / 1000;
    this.eye.material.uniforms.mixAmount.value = amount * (reduced ? .75 : 1);
    this.eye.quaternion.copy(this.camera.quaternion);
    this.stars.material.opacity = amount * .8; this.stars.rotation.y = now / 100000;
    this.rings.forEach((ring, i) => { ring.rotation.z = now / 60000 + i; ring.material.opacity = amount * .3; });
  }
}
