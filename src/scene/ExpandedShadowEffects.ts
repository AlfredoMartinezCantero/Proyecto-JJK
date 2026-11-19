import * as THREE from 'three';
import { TECHNIQUES } from '../core/techniques';
import type { TechniqueKey } from '../core/types';
import { combatTimeline, smooth01 } from './combatTimeline';
import { isExpandedShadowTechnique, megumiContactTimes, megumiTimeline, type ExpandedShadowKey } from './megumiTimeline';
import { makePalette, outlined } from './materials';
import { bakeShadowModel, createMahoraga, createMaxElephant, createRabbitGeometry, createToad, createTotality } from './expandedShikigami';
import { createMegumi } from './Megumi';
import { createDivineDog, createNue } from './shadowShikigami';

/** Six staged techniques. Pools are built once; cast/update never create models or materials. */
export class ExpandedShadowEffects {
  readonly root=new THREE.Group();
  private key:ExpandedShadowKey='totality';
  private began=-Infinity;
  private charge=0;private step=0;private intensity=.75;private reduced=true;private quality:'high'|'low'='high';
  private primary:THREE.Vector3|null=null;private secondary:THREE.Vector3|null=null;
  private readonly target=new THREE.Vector3(2,1.47,-1.35);
  private readonly wolf;private readonly toad;private readonly elephant;private readonly general;private readonly bird;
  private readonly clones:THREE.Mesh[]=[];private readonly hounds:THREE.Mesh[]=[];
  private readonly rabbits:THREE.InstancedMesh;
  private readonly tendrils:THREE.InstancedMesh;
  private readonly seed:THREE.Mesh<THREE.SphereGeometry,THREE.MeshBasicMaterial>;
  private readonly halo:THREE.Mesh<THREE.TorusGeometry,THREE.MeshBasicMaterial>;
  private readonly portal:THREE.Mesh<THREE.CircleGeometry,THREE.ShaderMaterial>;
  private readonly garden:THREE.Mesh<THREE.CircleGeometry,THREE.ShaderMaterial>;
  private readonly tongue:THREE.Mesh<THREE.BufferGeometry,THREE.MeshToonMaterial>;
  private readonly tonguePositions=new Float32Array(65*8*3);
  private readonly jet:THREE.Mesh<THREE.CylinderGeometry,THREE.ShaderMaterial>;
  private readonly wake:THREE.Mesh<THREE.RingGeometry,THREE.MeshBasicMaterial>;
  private readonly slash:THREE.Mesh<THREE.TorusGeometry,THREE.MeshBasicMaterial>;
  private readonly claws:THREE.Group;
  private readonly particles:THREE.Points<THREE.BufferGeometry,THREE.ShaderMaterial>;
  private readonly light=new THREE.PointLight('#aca3d7',0,13,2);
  private readonly dummy=new THREE.Object3D();private readonly up=new THREE.Vector3(0,1,0);
  private readonly from=new THREE.Vector3();private readonly to=new THREE.Vector3();private readonly center=new THREE.Vector3();private readonly offset=new THREE.Vector3();
  private readonly tongueNext=new THREE.Vector3();private readonly tangent=new THREE.Vector3();private readonly side=new THREE.Vector3();private readonly normal=new THREE.Vector3();
  private readonly outward=new THREE.Vector3(4.65,0,-2.15).normalize();
  private domain=0;private pulse=0;
  get domainMix(){return this.domain;}get impact(){return this.pulse;}get stun(){return 0;}

  constructor(scene:THREE.Scene,private readonly camera:THREE.Camera){
    this.root.name='Expanded Ten Shadows techniques';const palette=makePalette();
    this.wolf=createTotality(palette);this.toad=createToad(palette);this.elephant=createMaxElephant(palette);this.general=createMahoraga(palette);this.bird=createNue(palette);
    this.root.add(this.wolf.root,this.toad.root,this.elephant.root,this.general.root,this.bird.root);
    const clone=createMegumi(makePalette());clone.animate(1,1,combatTimeline('chimera-garden',500,8500));
    const cloneGeometry=bakeShadowModel(clone.root),dogGeometry=bakeShadowModel(createDivineDog(makePalette(),false).root);
    const shadow=palette.toon('#111021');shadow.emissive.set('#31213f');shadow.emissiveIntensity=.4;
    for(let i=0;i<2;i++){
      const double=outlined(cloneGeometry,shadow);double.name=`Chimera shadow double ${i}`;this.clones.push(double);this.root.add(double);
      const dog=outlined(dogGeometry,shadow);dog.name=`Chimera shadow hound ${i}`;this.hounds.push(dog);this.root.add(dog);
    }
    this.rabbits=new THREE.InstancedMesh(createRabbitGeometry(),new THREE.MeshToonMaterial({color:'#ffffff',vertexColors:true,gradientMap:palette.ramp}),96);
    this.rabbits.name='Rabbit Escape swarm';this.rabbits.frustumCulled=false;this.rabbits.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.root.add(this.rabbits);
    this.tendrils=new THREE.InstancedMesh(new THREE.CylinderGeometry(.65,1,1,7,1),shadow,100);
    this.tendrils.name='Chimera liquid shadow tendrils';this.tendrils.frustumCulled=false;this.tendrils.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.root.add(this.tendrils);
    const liquid=()=>new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
      uniforms:{time:{value:0},strength:{value:0}},
      vertexShader:`varying vec2 p;void main(){p=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`varying vec2 p;uniform float time;uniform float strength;void main(){float r=length(p),a=atan(p.y,p.x);
        float flow=sin(r*28.-time*1.2+sin(a*6.+time*.3))*sin(p.x*14.+p.y*11.-time*.5);
        float edge=1.-smoothstep(.84+.035*flow,1.,r);float vein=pow(.5+.5*flow,5.);
        gl_FragColor=vec4(vec3(.008,.009,.021)+vec3(.10,.065,.17)*vein,edge*strength);}`});
    this.portal=new THREE.Mesh(new THREE.CircleGeometry(1,72),liquid());this.portal.name='Expanded summon shadow portal';
    this.garden=new THREE.Mesh(new THREE.CircleGeometry(1,128),liquid());this.garden.name='Chimera fluid shadow garden';
    for(const mesh of [this.portal,this.garden]){mesh.rotation.x=-Math.PI/2;mesh.renderOrder=1;this.root.add(mesh);}
    this.seed=new THREE.Mesh(new THREE.SphereGeometry(.13,24,16),new THREE.MeshBasicMaterial({color:'#101020',transparent:true,opacity:.7}));
    this.seed.name='Expanded observed shadow seed';
    this.halo=new THREE.Mesh(new THREE.TorusGeometry(.17,.009,6,48),new THREE.MeshBasicMaterial({color:'#aba2d3',transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));this.root.add(this.seed,this.halo);
    const tongueGeometry=new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(this.tonguePositions,3));
    const tongueIndices:number[]=[];for(let i=0;i<64;i++)for(let j=0;j<7;j++){const a=i*8+j;tongueIndices.push(a,a+8,a+1,a+1,a+8,a+9);}tongueGeometry.setIndex(tongueIndices);
    this.tongue=new THREE.Mesh(tongueGeometry,new THREE.MeshToonMaterial({color:'#bb7380',gradientMap:palette.ramp,side:THREE.DoubleSide}));this.tongue.name='Sapo articulated capture tongue';this.tongue.frustumCulled=false;this.root.add(this.tongue);
    this.jet=new THREE.Mesh(new THREE.CylinderGeometry(.6,1,1,24,12,true),new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
      uniforms:{time:{value:0},strength:{value:0}},
      vertexShader:`varying vec2 v;varying vec3 p;uniform float time;void main(){v=uv;p=position;vec3 q=position;
        q.xz*=1.+.10*sin(uv.y*35.-time*14.+uv.x*10.);gl_Position=projectionMatrix*modelViewMatrix*vec4(q,1.);}`,
      fragmentShader:`varying vec2 v;varying vec3 p;uniform float time;uniform float strength;void main(){float foam=pow(.5+.5*sin(v.y*70.-time*21.+sin(v.x*27.)*2.),5.);
        gl_FragColor=vec4(mix(vec3(.10,.43,.63),vec3(.75,.94,1.),foam),strength*(.38+foam*.5));}`,
    }));this.jet.name='Max Elephant turbulent water jet';this.jet.frustumCulled=false;this.root.add(this.jet);
    this.wake=new THREE.Mesh(new THREE.RingGeometry(.86,1,96),new THREE.MeshBasicMaterial({color:'#a5cfe0',transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));this.wake.rotation.x=-Math.PI/2;this.wake.name='Expanded contact wake';this.root.add(this.wake);
    this.slash=new THREE.Mesh(new THREE.TorusGeometry(.86,.022,7,96,Math.PI*1.35),new THREE.MeshBasicMaterial({color:'#e0efbf',transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));this.slash.name='Mahoraga positive blade wake';this.root.add(this.slash);
    this.claws=new THREE.Group();this.claws.name='Totality claw impact';
    const clawCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(-.5,.6,0),new THREE.Vector3(0,.1,.06),new THREE.Vector3(.5,-.6,0)]);
    const clawGeometry=new THREE.TubeGeometry(clawCurve,18,.02,6,false),clawMaterial=new THREE.MeshBasicMaterial({color:'#c7d5e8',transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
    for(let i=0;i<4;i++){const mesh=new THREE.Mesh(clawGeometry,clawMaterial);mesh.position.x=(i-1.5)*.16;this.claws.add(mesh);}this.root.add(this.claws);
    const seeds=new Float32Array(1200*3);for(let i=0;i<seeds.length;i++)seeds[i]=((Math.sin(i*127.1+31.7)*43758.5453)%1+1)%1;
    this.particles=new THREE.Points(new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(seeds,3)),new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
      uniforms:{time:{value:0},age:{value:0},mode:{value:0},strength:{value:0},tint:{value:new THREE.Color('#aca0d0')},from:{value:new THREE.Vector3()},to:{value:new THREE.Vector3()}},
      vertexShader:`uniform float time;uniform float age;uniform float mode;uniform vec3 from;uniform vec3 to;varying float alpha;
        void main(){float phase=fract(position.z+time*.65);float a=position.x*6.283185;vec3 q;
          if(mode<.5){q=mix(from,to,phase)+vec3(cos(a),sin(a),cos(a*1.3))*(.08+phase*.5)*position.y;alpha=sin(phase*3.14159);}
          else if(mode<1.5){float t=max(0.,age-position.z*.12);q=to+vec3(cos(a)*t*(1.+position.y*3.),t*2.-t*t*2.,sin(a)*t*(1.+position.y*3.));alpha=(1.-smoothstep(.2,1.2,t))*step(position.z*.12,age);}
          else {q=to+vec3(cos(a)*(1.+position.y)*phase,phase*1.8,sin(a)*(1.+position.y)*phase);alpha=sin(phase*3.14159)*.4;}
          vec4 mv=viewMatrix*vec4(q,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp((2.+position.y*4.)*18./max(1.,-mv.z),1.,9.);}`,
      fragmentShader:`uniform vec3 tint;uniform float strength;varying float alpha;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;gl_FragColor=vec4(tint,(1.-r*r)*alpha*strength);}`,
    }));this.particles.name='Expanded shadow water and light particles';this.particles.frustumCulled=false;this.root.add(this.particles,this.light);
    scene.add(this.root);this.clear();
  }
  setTechnique(key:TechniqueKey){this.clear();if(isExpandedShadowTechnique(key))this.key=key;}
  setTarget(target:THREE.Vector3){this.target.copy(target);}
  setPalms(a:THREE.Vector3|null,b:THREE.Vector3|null){this.primary=a;this.secondary=b;}
  setCharge(progress:number,step=0){this.charge=progress;this.step=step;}
  setSettings(intensity:number,reduced:boolean,quality:'high'|'low'='high'){this.intensity=intensity;this.reduced=reduced;this.quality=quality;this.particles.geometry.setDrawRange(0,quality==='high'?1200:300);}
  activate(now:number,_debug:boolean){this.began=now;}
  clear(){this.root.visible=false;this.began=-Infinity;this.primary=this.secondary=null;this.charge=0;this.step=0;this.domain=0;this.pulse=0;this.light.intensity=0;}
  update(now:number){
    const elapsed=now-this.began,duration=TECHNIQUES[this.key].effectMs,t=megumiTimeline(this.key,elapsed,duration),state=combatTimeline(this.key,elapsed,duration);
    const charging=!!this.primary&&!!this.secondary&&(this.charge>0||this.step>0);
    this.root.visible=this.intensity>0&&(t.active||charging);this.domain=0;this.pulse=t.pulse;this.light.intensity=0;if(!this.root.visible)return;
    const fade=this.intensity*(1-state.recovery),appear=t.emerge*(1-t.retire),time=elapsed/1000;
    this.wolf.root.visible=this.toad.root.visible=this.elephant.root.visible=this.general.root.visible=this.bird.root.visible=false;
    this.rabbits.visible=this.tendrils.visible=this.garden.visible=this.tongue.visible=this.jet.visible=this.wake.visible=this.slash.visible=this.claws.visible=false;
    this.clones.forEach(m=>m.visible=false);this.hounds.forEach(m=>m.visible=false);
    this.seed.visible=this.halo.visible=charging&&!t.active;
    if(charging){this.center.copy(this.primary!).add(this.secondary!).multiplyScalar(.5);this.seed.position.copy(this.center);this.seed.scale.setScalar(.6+this.charge+(this.step>0?.2:0));this.seed.material.opacity=this.intensity*.8;
      this.halo.position.copy(this.center);this.halo.quaternion.copy(this.camera.quaternion);this.halo.rotateZ(now*.0005);this.halo.material.opacity=this.intensity*.55;}
    this.portal.visible=t.active&&this.key!=='chimera-garden';this.portal.position.set(-1.15,.065,-.15);this.portal.scale.setScalar((this.key==='max-elephant'||this.key==='mahoraga'?1.6:1.0)*(.4+t.emerge*.8));
    this.portal.material.uniforms.time.value=now/1000;this.portal.material.uniforms.strength.value=fade;
    this.particles.visible=t.active;const u=this.particles.material.uniforms;u.time.value=now/1000;u.age.value=Math.max(0,t.hitAge)/1000;u.mode.value=2;u.strength.value=fade*.45;u.tint.value.set('#807599');u.to.value.copy(this.portal.position);
    this.light.position.copy(this.target);this.light.intensity=fade*(this.reduced?.5:1);
    if(!t.active)return;
    if(this.key==='totality'){
      const advance=smooth01((elapsed-650)/1200),attack=Math.max(...megumiContactTimes('totality').map(hit=>Math.exp(-Math.pow((elapsed-hit)/190,2))));
      this.wolf.root.visible=appear>.001;this.wolf.root.position.set(-1.15,.02,-.15).lerp(this.to.set(this.target.x-.75,.02,this.target.z+.2),advance*(1-t.retire));
      this.wolf.root.scale.setScalar(appear);this.wolf.root.lookAt(this.target.x,.02,this.target.z);this.wolf.animate(time,attack);
      this.claws.visible=t.hitAge>=0&&t.hitAge<350;this.claws.position.copy(this.target);this.claws.quaternion.copy(this.camera.quaternion);this.claws.rotateZ(t.second?-.35:.2);this.claws.scale.setScalar(.7+smooth01(Math.max(0,t.hitAge)/350));
      (this.claws.children[0] as THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>).material.opacity=fade*t.pulse;
    }else if(this.key==='toad'){
      this.toad.root.visible=appear>.001;this.toad.root.position.set(-1.15,.02,-.15);this.toad.root.scale.setScalar(appear*1.15);this.toad.root.lookAt(this.target.x,.02,this.target.z);this.toad.animate(time,t.bind);
      const reach=smooth01((elapsed-650)/600)*(1-smooth01((t.age-1500)/350));this.tongue.visible=reach>.005;
      if(this.tongue.visible){this.toad.mouthWorld(this.from);this.to.copy(this.target).add(this.offset.set(-2*t.drag,0,.6*t.drag));this.drawTongue(this.from,this.to,reach);}
    }else if(this.key==='max-elephant'){
      this.elephant.root.visible=appear>.001;this.elephant.root.position.set(-1.8,.02,-.45);this.elephant.root.scale.setScalar(appear*.96);this.elephant.root.lookAt(this.target.x,.02,this.target.z);this.elephant.animate(time,smooth01((elapsed-800)/1000));
      const water=t.age>=0&&t.age<2400;this.jet.visible=water;
      if(water){this.elephant.trunkWorld(this.from);this.to.copy(this.target).addScaledVector(this.outward,3.2);this.center.copy(this.to).sub(this.from);
        this.jet.position.copy(this.from).add(this.to).multiplyScalar(.5);this.jet.quaternion.setFromUnitVectors(this.up,this.center.clone().normalize());this.jet.scale.set(.45,this.center.length(),.45);
        this.jet.material.uniforms.time.value=now/1000;this.jet.material.uniforms.strength.value=fade*t.flood;
        u.mode.value=0;u.from.value.copy(this.from);u.to.value.copy(this.to);u.tint.value.set('#a8e3f5');u.strength.value=fade*t.flood*.7;
        this.wake.visible=true;this.wake.position.copy(this.target).addScaledVector(this.outward,state.knockback*2.35+t.flood*.8);this.wake.position.y=.08;this.wake.scale.setScalar(.4+Math.min(1.8,t.age/700));this.wake.material.color.set('#99d7ed');this.wake.material.opacity=fade*t.flood*.35;
      }
    }else if(this.key==='rabbit-escape')this.drawRabbits(elapsed,appear,false);
    else if(this.key==='mahoraga'){
      const move=smooth01((elapsed-1700)/1300),strike=smooth01((elapsed-2850)/450)*(1-smooth01((elapsed-3450)/500));
      this.general.root.visible=appear>.001;this.general.root.position.set(-.85,.02,-2.35).lerp(this.to.set(this.target.x-.9,.02,this.target.z-.45),move*(1-t.retire));this.general.root.scale.setScalar(appear);
      this.general.root.lookAt(this.target.x,.02,this.target.z);this.general.animate(time,strike,smooth01((elapsed-1400)/850));
      this.slash.visible=t.age>=0&&t.age<550;this.slash.position.copy(this.target);this.slash.quaternion.copy(this.camera.quaternion);this.slash.rotateZ(-.6+t.age*.0012);this.slash.scale.setScalar(.8+smooth01(t.age/550)*1.8);this.slash.material.opacity=fade*(1-smooth01(t.age/550))*(this.reduced?.55:.9);
      if(t.age>=0&&t.age<1200){u.mode.value=1;u.to.value.copy(this.target);u.tint.value.set('#dfedbc');u.strength.value=fade*.75;}
    }else this.drawGarden(elapsed,appear,fade);
  }
  private drawTongue(from:THREE.Vector3,to:THREE.Vector3,reach:number){
    for(let i=0;i<=64;i++){
      const u=i/64*reach,ahead=u<.999?u+.001:u-.001;
      this.tonguePoint(u,from,to,this.center);this.tonguePoint(ahead,from,to,this.tongueNext);
      this.tangent.copy(this.tongueNext).sub(this.center).multiplyScalar(ahead>u?1:-1).normalize();
      this.side.crossVectors(this.tangent,this.up);if(this.side.lengthSq()<1e-8)this.side.set(1,0,0);else this.side.normalize();this.normal.crossVectors(this.tangent,this.side).normalize();
      const radius=.045*(1-i/100);
      for(let j=0;j<8;j++){const angle=j/7*Math.PI*2,c=Math.cos(angle)*radius,s=Math.sin(angle)*radius;this.tonguePositions.set([this.center.x+this.side.x*c+this.normal.x*s,this.center.y+this.side.y*c+this.normal.y*s,this.center.z+this.side.z*c+this.normal.z*s],(i*8+j)*3);}
    }
    this.tongue.geometry.getAttribute('position').needsUpdate=true;this.tongue.geometry.computeVertexNormals();
  }
  private tonguePoint(u:number,from:THREE.Vector3,to:THREE.Vector3,out:THREE.Vector3){
    if(u<.72){const t=u/.72;out.copy(from).lerp(to,t);out.x+=.48*t;out.y-=.20*t;}
    else{const v=(u-.72)/.28,a=v*Math.PI*4.4;out.copy(to);out.x+=Math.cos(a)*.48;out.y+=-.20+v*.45;out.z+=Math.sin(a)*.48;}
  }
  private drawRabbits(elapsed:number,appear:number,garden:boolean){
    this.rabbits.visible=appear>.001;this.rabbits.count=this.quality==='high'?(garden?48:96):(garden?16:32);
    for(let i=0;i<this.rabbits.count;i++){
      const seed=((Math.sin(i*127.1+17.3)*43758.5453)%1+1)%1,a=i*2.39996;
      if(garden){const angle=a+elapsed*.00065,r=1+seed*2.1;this.dummy.position.set(this.target.x+Math.cos(angle)*r,.05+Math.abs(Math.sin(elapsed*.01+i))*.24,this.target.z+Math.sin(angle)*r);this.dummy.rotation.set(0,-angle,0);}
      else{const p=smooth01((elapsed-250-seed*550)/2200),endX=this.target.x+Math.cos(a)*2.6,endZ=this.target.z+Math.sin(a)*2.6;
        this.dummy.position.set(-1.15+(endX+1.15)*p,.04+Math.abs(Math.sin(elapsed*.012+i*1.7))*.24*p,.1+(endZ-.1)*p);this.dummy.rotation.set(0,Math.atan2(endX+1.15,endZ-.1),0);}
      this.dummy.scale.setScalar(appear*(.75+seed*.45));this.dummy.updateMatrix();this.rabbits.setMatrixAt(i,this.dummy.matrix);
    }
    this.rabbits.instanceMatrix.needsUpdate=true;
  }
  private drawGarden(elapsed:number,appear:number,fade:number){
    const spread=smooth01(elapsed/1500),close=1-smooth01((elapsed-7300)/1100),life=spread*close;
    this.domain=life*.68*this.intensity;this.portal.visible=false;this.garden.visible=true;this.garden.position.set(.4,.07,-.7);this.garden.scale.setScalar(.2+life*5.8);this.garden.material.uniforms.time.value=elapsed/1000;this.garden.material.uniforms.strength.value=fade*.98;
    this.tendrils.visible=life>.02;this.tendrils.count=this.quality==='high'?100:40;
    for(let i=0;i<this.tendrils.count;i++){
      const arm=Math.floor(i/5),joint=i%5,a=arm*2.39996,r=3.5+Math.sin(arm)*.6,h=(.8+Math.sin(arm*3.7)*.25)*life;
      this.dummy.position.set(.4+Math.cos(a)*r+Math.sin(joint*.7+elapsed*.0007+arm)*joint*.055,h*(joint+.5)/5,-.7+Math.sin(a)*r);
      this.dummy.rotation.set(Math.sin(a)*.12,0,-Math.cos(a)*.12);this.dummy.scale.set((.17-joint*.025)*life,h/5,(.17-joint*.025)*life);this.dummy.updateMatrix();this.tendrils.setMatrixAt(i,this.dummy.matrix);
    }this.tendrils.instanceMatrix.needsUpdate=true;
    const arrived=smooth01((elapsed-1500)/650)*close;
    this.clones.forEach((clone,i)=>{
      clone.visible=arrived>.01&&(this.quality==='high'||i===0);const pulse=Math.max(...megumiContactTimes('chimera-garden').filter((_,j)=>j%2===i).map(event=>Math.exp(-Math.pow((elapsed-event)/250,2))));const a=i*Math.PI+elapsed*.00025;
      clone.position.set(this.target.x+Math.cos(a)*(1.35-pulse*.5),-(1-arrived)*2.4,this.target.z+Math.sin(a)*1.3);clone.scale.setScalar(arrived*.83);clone.lookAt(this.target.x,0,this.target.z);clone.rotateX(-pulse*.2);
    });
    this.hounds.forEach((dog,i)=>{dog.visible=arrived>.01;const a=i*Math.PI+elapsed*.0012;dog.position.set(this.target.x+Math.cos(a)*1.3,.04+Math.abs(Math.sin(elapsed*.012+i))*.14,this.target.z+Math.sin(a)*1.3);dog.scale.setScalar(arrived*.72);dog.lookAt(this.target.x,.04,this.target.z);});
    this.bird.root.visible=arrived>.01&&this.quality==='high';this.bird.root.position.set(this.target.x+Math.sin(elapsed*.001)*1.3,3.3,this.target.z-.3);this.bird.root.rotation.y=.55;this.bird.root.scale.setScalar(arrived*.65);this.bird.animate(elapsed/1000,.7);
    this.drawRabbits(elapsed,arrived,true);
    this.particles.material.uniforms.to.value.copy(this.target);this.particles.material.uniforms.tint.value.set('#8f7ba8');this.particles.material.uniforms.strength.value=fade*.4;
  }
}
