import * as THREE from 'three';
import type { TechniqueKey } from '../core/types';
import { TECHNIQUES } from '../core/techniques';
import { combatTimeline, smooth01 } from './combatTimeline';
import { DOG_SECOND_HIT_MS, isExpandedShadowTechnique, isMegumiTechnique, MEGUMI_CONTACT, megumiTimeline, type MegumiTechniqueKey } from './megumiTimeline';
import { ExpandedShadowEffects } from './ExpandedShadowEffects';
import { makePalette } from './materials';
import { createDivineDog, createNue } from './shadowShikigami';

/** Staged local summons: articulated shikigami, ground shadows and pooled contact electricity. */
export class MegumiEffects {
  readonly root = new THREE.Group();
  private key:MegumiTechniqueKey = 'divine-dogs';
  private readonly expanded:ExpandedShadowEffects;
  private began = -Infinity;
  private charge = 0;
  private step = 0;
  private intensity = .75;
  private reduced = true;
  private primary: THREE.Vector3 | null = null;
  private secondary: THREE.Vector3 | null = null;
  private readonly target = new THREE.Vector3(2,1.47,-1.35);
  private readonly dogs: ReturnType<typeof createDivineDog>[];
  private readonly bird: ReturnType<typeof createNue>;
  private readonly portals: THREE.Mesh<THREE.CircleGeometry,THREE.ShaderMaterial>[] = [];
  private readonly handShadow: THREE.Mesh<THREE.SphereGeometry,THREE.MeshBasicMaterial>;
  private readonly handHalo: THREE.Mesh<THREE.TorusGeometry,THREE.MeshBasicMaterial>;
  private readonly arcs: THREE.InstancedMesh;
  private readonly arcGlow: THREE.InstancedMesh;
  private readonly smoke: THREE.Points<THREE.BufferGeometry,THREE.ShaderMaterial>;
  private readonly claws: THREE.Group[] = [];
  private readonly light = new THREE.PointLight('#a69bdf',0,10,2);
  private readonly scratchMaterial = new THREE.MeshBasicMaterial({color:'#d3d5ea',transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});
  private readonly dummy = new THREE.Object3D();
  private readonly a = new THREE.Vector3();
  private readonly b = new THREE.Vector3();
  private readonly start = new THREE.Vector3();
  private readonly end = new THREE.Vector3();
  private readonly center = new THREE.Vector3();
  private readonly up = new THREE.Vector3(0,1,0);
  private pulse = 0;
  get attraction() { return 0; }
  get repulsion() { return isExpandedShadowTechnique(this.key)?this.expanded.impact:this.pulse; }
  get impact() { return isExpandedShadowTechnique(this.key)?this.expanded.impact:this.pulse; }
  get stun() { return 0; }
  get domainMix() { return this.expanded.domainMix; }
  constructor(scene: THREE.Scene,private readonly camera: THREE.Camera) {
    this.root.name = 'Megumi shadow summons';
    this.expanded=new ExpandedShadowEffects(scene,camera);
    const palette = makePalette();
    this.dogs = [createDivineDog(palette,true),createDivineDog(palette,false)]; this.bird = createNue(palette);
    this.dogs.forEach(dog => this.root.add(dog.root)); this.root.add(this.bird.root);
    for (let i = 0; i < 3; i++) {
      const portal = new THREE.Mesh(new THREE.CircleGeometry(.85,64),new THREE.ShaderMaterial({
        transparent:true,depthWrite:false,side:THREE.DoubleSide,
        uniforms:{ time:{value:0},strength:{value:0} },
        vertexShader:`varying vec2 p;void main(){p=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader:`varying vec2 p;uniform float time;uniform float strength;void main(){float r=length(p),a=atan(p.y,p.x);
          float flow=sin(a*7.-time*1.2+sin(r*19.-time)*.45)*.018;float edge=1.-smoothstep(.83+flow,.99,r);
          float ring=exp(-pow((r-.84-flow)*45.,2.));vec3 c=vec3(.008,.008,.018)+vec3(.18,.16,.29)*ring;
          gl_FragColor=vec4(c,edge*strength);}`,
      })); portal.rotation.x = -Math.PI/2; portal.renderOrder = 1; portal.name = `Shikigami shadow portal ${i}`; this.portals.push(portal); this.root.add(portal);
    }
    this.handShadow = new THREE.Mesh(new THREE.SphereGeometry(.12,24,16),new THREE.MeshBasicMaterial({color:'#11131f',transparent:true,opacity:.8}));
    this.handShadow.name = 'Observed hands shadow seed';
    this.handHalo = new THREE.Mesh(new THREE.TorusGeometry(.16,.008,6,48),new THREE.MeshBasicMaterial({color:'#a6a9e0',transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
    this.root.add(this.handShadow,this.handHalo);
    const cylinder = new THREE.CylinderGeometry(1,1,1,6,1,true);
    this.arcGlow = new THREE.InstancedMesh(cylinder,new THREE.MeshBasicMaterial({color:'#a455ed',transparent:true,opacity:.6,depthWrite:false,blending:THREE.AdditiveBlending}),5*16);
    this.arcs = new THREE.InstancedMesh(cylinder,new THREE.MeshBasicMaterial({color:'#e7ceff',transparent:true,opacity:.85,depthWrite:false,blending:THREE.AdditiveBlending}),5*16);
    this.arcGlow.name = 'Nue electric corona'; this.arcs.name = 'Nue contact lightning';
    for (const mesh of [this.arcGlow,this.arcs]) { mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.root.add(mesh); }
    const trail = new THREE.CatmullRomCurve3([new THREE.Vector3(-.24,.36,0),new THREE.Vector3(0,.08,.035),new THREE.Vector3(.29,-.31,0)]);
    const clawGeometry = new THREE.TubeGeometry(trail,16,.012,5,false);
    for (let i = 0; i < 2; i++) {
      const claw = new THREE.Group(); claw.name = `Divine Dog contact claws ${i}`;
      for (let j = 0; j < 3; j++) { const line = new THREE.Mesh(clawGeometry,this.scratchMaterial); line.position.x = (j-1)*.11; claw.add(line); }
      this.claws.push(claw); this.root.add(claw);
    }
    const seeds = new Float32Array(600*3);
    for (let i = 0; i < seeds.length; i++) seeds[i] = ((Math.sin(i*127.1+17.3)*43758.5453)%1+1)%1;
    const geometry = new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(seeds,3));
    this.smoke = new THREE.Points(geometry,new THREE.ShaderMaterial({transparent:true,depthWrite:false,
      uniforms:{time:{value:0},strength:{value:0}},
      vertexShader:`uniform float time;varying float alpha;void main(){float age=fract(position.z+time*.25);float a=position.x*6.283185;
        float radius=.25+position.y*.65+age*.15;vec3 p=vec3(cos(a)*radius,age*1.45,sin(a)*radius);
        alpha=sin(age*3.14159);vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp((12.+position.y*20.)*12./max(1.,-mv.z),2.,35.);}`,
      fragmentShader:`uniform float strength;varying float alpha;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;
        gl_FragColor=vec4(vec3(.045,.04,.085),pow(1.-r,2.)*alpha*strength);}`,
    })); this.smoke.frustumCulled = false; this.smoke.name = 'Shikigami emergence mist'; this.root.add(this.smoke,this.light);
    scene.add(this.root); this.clear();
  }
  setTarget(target: THREE.Vector3) { this.target.copy(target);this.expanded.setTarget(target); }
  setTechnique(key: TechniqueKey) { this.clear(); if (isMegumiTechnique(key)) this.key = key;this.expanded.setTechnique(key); }
  setSettings(intensity: number,reduced: boolean,quality: 'high' | 'low' = 'high') {
    this.intensity = intensity; this.reduced = reduced; this.smoke.geometry.setDrawRange(0,quality === 'high'?600:160);
    this.expanded.setSettings(intensity,reduced,quality);
  }
  setPalms(a: THREE.Vector3 | null,b: THREE.Vector3 | null) { this.primary = a; this.secondary = b;this.expanded.setPalms(a,b); }
  setCharge(progress: number,step = 0) { this.charge = progress; this.step = step;this.expanded.setCharge(progress,step); }
  activate(now: number,_debug: boolean) { this.began = now;this.expanded.activate(now,_debug); }
  clear() {
    this.root.visible = false; this.began = -Infinity; this.primary = null; this.secondary = null;
    this.charge = 0; this.step = 0; this.pulse = 0; this.light.intensity = 0;
    this.expanded.clear();
  }
  update(now: number) {
    if(isExpandedShadowTechnique(this.key)){this.root.visible=false;this.expanded.update(now);return;}
    const elapsed = now-this.began, timeline = megumiTimeline(this.key,elapsed,TECHNIQUES[this.key].effectMs);
    const combat = combatTimeline(this.key,elapsed,TECHNIQUES[this.key].effectMs);
    const charging = !!this.primary && !!this.secondary && (this.charge>0||this.step>0);
    this.root.visible = this.intensity>0&&(timeline.active||charging); this.pulse = timeline.pulse; this.light.intensity = 0;
    if (!this.root.visible) return;
    this.handShadow.visible = this.handHalo.visible = charging&&!timeline.active;
    if (charging) {
      this.center.copy(this.primary!).add(this.secondary!).multiplyScalar(.5);
      this.handShadow.position.copy(this.center); this.handShadow.scale.setScalar(.6+this.charge*.8+(this.step>0?.3:0));
      this.handShadow.material.opacity = this.intensity*.8;
      this.handHalo.position.copy(this.center); this.handHalo.quaternion.copy(this.camera.quaternion);
      this.handHalo.rotation.z += now*.0004; this.handHalo.material.opacity = this.intensity*.45;
    }
    const dogs = this.key === 'divine-dogs', fade = this.intensity*(1-combat.recovery), appear = timeline.emerge*(1-timeline.retire);
    this.dogs.forEach((dog,i) => {
      dog.root.visible = timeline.active&&dogs&&appear>.001;
      if (!dog.root.visible) return;
      const side = i?1:-1, contact = MEGUMI_CONTACT['divine-dogs']+i*DOG_SECOND_HIT_MS;
      const advance = smooth01((elapsed-600)/(contact-600));
      this.start.set(-1.65,.04,.1+side*.73); this.end.set(this.target.x-.56,.04,this.target.z+side*.43);
      dog.root.position.copy(this.start).lerp(this.end,advance*(1-timeline.retire));
      dog.root.position.z += Math.sin(advance*Math.PI)*side*.40*(1-timeline.retire);
      const leap = elapsed>contact-230&&elapsed<contact+230?Math.sin((elapsed-contact+230)/460*Math.PI):0;
      dog.root.position.y += leap*.38-(1-timeline.emerge)*.7; dog.root.scale.setScalar(.82*appear);
      dog.root.lookAt(this.target.x,dog.root.position.y,this.target.z);
      const biting = Math.exp(-Math.pow((elapsed-contact)/190,2)); dog.animate(now/1000,advance<.98||timeline.retire>0?1:.12,biting);
    });
    this.bird.root.visible = timeline.active&&!dogs&&appear>.001;
    if (this.bird.root.visible) {
      const rise = smooth01(elapsed/950), dive = smooth01((elapsed-950)/(MEGUMI_CONTACT.nue-950));
      this.start.set(-1.65,.18,.1); this.end.set(this.target.x-.65,4.6,this.target.z-.3);
      this.bird.root.position.copy(this.start).lerp(this.end,rise);
      this.end.set(this.target.x,3.1,this.target.z+.08); this.bird.root.position.lerp(this.end,dive).lerp(this.start,timeline.retire);
      this.bird.root.scale.setScalar(.9*appear); this.bird.root.rotation.y = THREE.MathUtils.lerp(Math.atan2(this.target.x+2.5,this.target.z-.1),.55,dive);
      this.bird.animate(now/1000,dive);
    }
    this.portals.forEach((portal,i) => {
      portal.visible = timeline.active&&(dogs?i<2:i===2);
      portal.position.set(-1.65,.055+i*.002,.1+(i===0?-.73:i===1?.73:0));
      portal.scale.setScalar(.5+.6*timeline.emerge); portal.material.uniforms.time.value = now/1000;
      portal.material.uniforms.strength.value = this.intensity*(1-combat.recovery)*.95;
    });
    this.claws.forEach((claw,i) => {
      const age = elapsed-MEGUMI_CONTACT['divine-dogs']-i*DOG_SECOND_HIT_MS;
      claw.visible = timeline.active&&dogs&&age>=0&&age<330;
      claw.position.copy(this.target); claw.position.z += i?.1:-.1; claw.quaternion.copy(this.camera.quaternion);
      claw.scale.setScalar(.65+smooth01(age/330)*.8);
    });
    this.scratchMaterial.opacity = fade*combat.pulse*(this.reduced?.6:1);
    const electric = timeline.active&&!dogs&&timeline.age>=0&&timeline.age<650;
    this.arcs.visible = this.arcGlow.visible = electric;
    if (electric) {
      this.start.copy(this.bird.root.position); this.start.y -= .45;
      this.electricity(now/1000,this.start,this.target,fade*(1-smooth01(timeline.age/650)));
    }
    this.smoke.visible = timeline.active; this.smoke.position.set(-1.65,.03,.1);
    this.smoke.material.uniforms.time.value = now/1000; this.smoke.material.uniforms.strength.value = fade*.65;
    this.light.position.copy(electric?this.target:this.bird.root.visible?this.bird.root.position:this.target);
    this.light.intensity = fade*(electric?(this.reduced?1.5:3):.45);
  }
  private electricity(time: number,from: THREE.Vector3,to: THREE.Vector3,strength: number) {
    for (let branch = 0; branch < 5; branch++) for (let segment = 0; segment < 16; segment++) {
      for (const [offset,p] of [this.a,this.b].entries()) {
        const u = (segment+offset)/16, envelope = Math.sin(u*Math.PI), phase = (segment+offset)*5.3+branch*2.4+time*2;
        p.copy(from).lerp(to,u); p.x += Math.sin(phase)*envelope*(.08+branch*.035); p.z += Math.cos(phase*1.3)*envelope*(.07+branch*.03);
      }
      this.center.copy(this.b).sub(this.a); this.dummy.position.copy(this.a).add(this.b).multiplyScalar(.5);
      this.dummy.quaternion.setFromUnitVectors(this.up,this.center.clone().normalize());
      this.dummy.scale.set(.045,this.center.length(),.045); this.dummy.updateMatrix(); this.arcGlow.setMatrixAt(branch*16+segment,this.dummy.matrix);
      this.dummy.scale.x = this.dummy.scale.z = .013; this.dummy.updateMatrix(); this.arcs.setMatrixAt(branch*16+segment,this.dummy.matrix);
    }
    (this.arcGlow.material as THREE.MeshBasicMaterial).opacity = strength*(this.reduced?.28:.5);
    (this.arcs.material as THREE.MeshBasicMaterial).opacity = strength*(this.reduced?.6:.95);
    this.arcs.instanceMatrix.needsUpdate = this.arcGlow.instanceMatrix.needsUpdate = true;
  }
}
