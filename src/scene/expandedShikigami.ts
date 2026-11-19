import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makePalette, outlined } from './materials';

type Palette=ReturnType<typeof makePalette>;
function builder(palette:Palette){
  return (parent:THREE.Object3D,g:THREE.BufferGeometry,color:string,x:number,y:number,z:number,name='')=>{
    const mesh=outlined(g,palette.toon(color));mesh.position.set(x,y,z);mesh.name=name;parent.add(mesh);return mesh;
  };
}

export function createTotality(palette:Palette){
  const root=new THREE.Group(),body=new THREE.Group();root.add(body);root.name='Jade Wolf Totality';
  const add=builder(palette),fur='#202839',mane='#3b4457',ink='#101620',bone='#e0e1d7';
  add(body,new THREE.SphereGeometry(.46,20,16),fur,0,1.65,0).scale.set(1.1,1.4,.73);
  add(body,new THREE.SphereGeometry(.32,18,14),fur,0,1.04,-.04).scale.set(1.25,.8,.9);
  for(const side of [-1,1]){
    const leg=new THREE.Group();leg.position.set(side*.25,1.03,0);body.add(leg);
    add(leg,new THREE.CapsuleGeometry(.15,.28,5,12),fur,0,-.24,0).rotation.x=-.22;
    add(leg,new THREE.CapsuleGeometry(.10,.35,5,12),fur,0,-.64,.03).rotation.x=.13;
    add(leg,new THREE.SphereGeometry(.15,14,10),mane,0,-.94,.13).scale.set(1,.55,1.65);
    for(const x of [-.085,0,.085])add(leg,new THREE.ConeGeometry(.024,.14,6).rotateX(Math.PI/2),bone,x,-.96,.35);
  }
  const head=new THREE.Group();head.position.set(0,2.32,.12);body.add(head);
  add(head,new THREE.SphereGeometry(.29,22,16),fur,0,0,0).scale.set(1,1.12,1);
  add(head,new THREE.CapsuleGeometry(.14,.19,5,12).rotateX(Math.PI/2),fur,0,-.10,.30);
  add(head,new THREE.SphereGeometry(.10,12,10),ink,0,-.04,.48).scale.set(1,.6,.5);
  const jaw=new THREE.Group();jaw.position.set(0,-.15,.12);head.add(jaw);
  add(jaw,new THREE.CapsuleGeometry(.09,.19,4,12).rotateX(Math.PI/2),mane,0,-.02,.18);
  for(const side of [-1,1]){
    const ear=add(head,new THREE.ConeGeometry(.12,.34,4),fur,side*.20,.31,-.02);ear.rotation.z=-side*.18;
    const eye=new THREE.Mesh(new THREE.SphereGeometry(.04,12,8),new THREE.MeshBasicMaterial({color:'#e8d48a'}));eye.position.set(side*.21,.045,.19);eye.scale.set(1,.42,.4);head.add(eye);
    add(head,new THREE.ConeGeometry(.035,.15,6).rotateZ(Math.PI),bone,side*.10,-.17,.30);
  }
  for(let i=0;i<15;i++){
    const a=i*2.39996,t=add(body,new THREE.ConeGeometry(.13,.37,5),mane,Math.cos(a)*.44,2.04+Math.sin(a)*.20,.08+Math.sin(a*2)*.14);
    t.rotation.set(.25,a,-Math.cos(a)*.9);
  }
  const seal=add(head,new THREE.TorusGeometry(.065,.013,5,16),bone,0,.20,.25);seal.scale.y=.8;
  const arms:THREE.Group[]=[];
  for(const side of [-1,1]){
    const arm=new THREE.Group();arm.position.set(side*.51,1.99,0);body.add(arm);arms.push(arm);
    add(arm,new THREE.SphereGeometry(.24,16,12),fur,0,-.07,0);
    add(arm,new THREE.CapsuleGeometry(.15,.37,5,12),fur,0,-.35,0);
    add(arm,new THREE.CapsuleGeometry(.13,.36,5,12),fur,0,-.83,.11).rotation.x=-.2;
    add(arm,new THREE.SphereGeometry(.17,16,12),mane,0,-1.13,.16).scale.set(1.15,1.15,.6);
    for(let finger=0;finger<4;finger++){
      add(arm,new THREE.CapsuleGeometry(.032,.17,4,8),fur,(finger-1.5)*.078,-1.29,.19);
      const claw=add(arm,new THREE.ConeGeometry(.028,.28,6),bone,(finger-1.5)*.078,-1.47,.24);claw.rotation.x=-.35;claw.rotation.z=Math.PI;
    }
  }
  const tailCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,1.05,-.22),new THREE.Vector3(.12,.9,-.65),new THREE.Vector3(.20,1.18,-1.0)]);
  add(body,new THREE.TubeGeometry(tailCurve,14,.1,8,false),fur,0,0,0);
  return {root,animate(time:number,attack:number){
    body.position.y=Math.sin(time*5)*.03;body.rotation.x=attack*.2;jaw.rotation.x=attack*.65;
    arms.forEach((arm,i)=>{arm.rotation.x=-.25-attack*(i?1.25:.9);arm.rotation.z=(i?1:-1)*(.18+attack*.28);});
  }};
}

export function createToad(palette:Palette){
  const root=new THREE.Group(),body=new THREE.Group();root.add(body);root.name='Gama Toad';const add=builder(palette),skin='#607e4b',dark='#22362d',belly='#c4bd83';
  add(body,new THREE.SphereGeometry(.68,24,18),skin,0,.53,0).scale.set(1.18,.8,1.05);
  add(body,new THREE.SphereGeometry(.50,24,18),belly,0,.43,.39).scale.set(1.12,.78,.35);
  const head=add(body,new THREE.SphereGeometry(.59,24,18),skin,0,.84,.26);head.scale.set(1.2,.56,.84);
  const mouth=new THREE.Group();mouth.position.set(0,.67,.63);body.add(mouth);mouth.name='Sapo mouth';
  add(mouth,new THREE.SphereGeometry(.36,18,12),dark,0,0,0).scale.set(1.5,.45,.19);
  add(mouth,new THREE.SphereGeometry(.33,18,12),'#aa6870',0,-.015,.025).scale.set(1.45,.27,.16);
  for(const side of [-1,1]){
    add(body,new THREE.SphereGeometry(.20,18,12),dark,side*.42,1.12,.38);
    add(body,new THREE.SphereGeometry(.14,18,12),'#d4c76c',side*.42,1.13,.60).scale.z=.45;
    add(body,new THREE.SphereGeometry(.075,12,10),'#111a18',side*.42,1.13,.665).scale.set(1.15,.33,.28);
    const thigh=add(body,new THREE.SphereGeometry(.30,18,12),skin,side*.63,.31,-.20);thigh.scale.set(1.1,.8,1.35);
    const shin=add(body,new THREE.CapsuleGeometry(.12,.45,4,12),skin,side*.77,.16,.20);shin.rotation.z=side*1.1;
    add(body,new THREE.SphereGeometry(.17,14,10),skin,side*.85,.075,.47).scale.set(1.4,.4,1.4);
    for(let toe=0;toe<3;toe++)add(body,new THREE.CapsuleGeometry(.028,.20,4,8).rotateX(Math.PI/2),belly,side*.85+(toe-1)*.095,.055,.65);
    const arm=add(body,new THREE.CapsuleGeometry(.085,.46,4,10),skin,side*.50,.26,.44);arm.rotation.z=-side*.30;
  }
  const emblem=add(body,new THREE.TorusGeometry(.14,.014,6,32),dark,0,.41,.56);emblem.scale.y=.85;
  add(body,new THREE.BoxGeometry(.016,.14,.018),dark,0,.41,.57);add(body,new THREE.BoxGeometry(.13,.016,.018),dark,0,.41,.57);
  for(let i=0;i<16;i++){const a=i*2.39996;add(body,new THREE.SphereGeometry(.045,8,6),'#788f58',Math.cos(a)*.61,.65+Math.sin(a)*.2,-.15-Math.abs(Math.sin(a))*.32);}
  return {root,animate(time:number,open:number){body.scale.y=1+Math.sin(time*3)*.025;mouth.scale.y=.45+open*.9;},mouthWorld(out:THREE.Vector3){root.updateMatrixWorld(true);return mouth.localToWorld(out.set(0,0,.06));}};
}

export function createMaxElephant(palette:Palette){
  const root=new THREE.Group(),body=new THREE.Group();root.add(body);root.name='Max Elephant';const add=builder(palette),skin='#a58b94',shade='#786d7e',ivory='#e1d7bd';
  add(body,new THREE.SphereGeometry(1,28,20),skin,0,1.44,-.15).scale.set(.88,.84,1.18);
  add(body,new THREE.SphereGeometry(.70,24,18),skin,0,1.85,1.02).scale.set(1,.95,.8);
  for(const side of [-1,1]){
    const ear=add(body,new THREE.SphereGeometry(.53,20,14),shade,side*.68,1.79,.89);ear.scale.set(.82,1.15,.19);ear.rotation.y=-side*.40;
    const inner=add(body,new THREE.SphereGeometry(.41,18,12),'#bc929b',side*.71,1.79,.98);inner.scale.set(.82,1.1,.15);inner.rotation.y=-side*.40;
    const eye=add(body,new THREE.SphereGeometry(.065,12,10),'#241f2a',side*.46,1.98,1.47);eye.scale.set(1,.6,.45);
    const tusk=new THREE.CatmullRomCurve3([new THREE.Vector3(side*.40,1.48,1.42),new THREE.Vector3(side*.48,1.35,1.82),new THREE.Vector3(side*.53,1.53,2.12)]);
    const tuskGeometry=new THREE.TubeGeometry(tusk,14,.06,8,false),tp=tuskGeometry.getAttribute('position'),uv=tuskGeometry.getAttribute('uv'),tc=new THREE.Vector3();
    for(let i=0;i<tp.count;i++){const u=uv.getX(i);tusk.getPointAt(u,tc);const r=1-u*.97;tp.setXYZ(i,tc.x+(tp.getX(i)-tc.x)*r,tc.y+(tp.getY(i)-tc.y)*r,tc.z+(tp.getZ(i)-tc.z)*r);}tuskGeometry.computeVertexNormals();
    add(body,tuskGeometry,ivory,0,0,0);
    for(const z of [-.80,.58]){
      add(body,new THREE.CylinderGeometry(.24,.27,.95,18),skin,side*.56,.63,z);
      add(body,new THREE.SphereGeometry(.28,18,12),shade,side*.56,.17,z+.07).scale.set(1,.6,1.1);
      for(const x of [-.11,0,.11])add(body,new THREE.SphereGeometry(.06,10,8),ivory,side*.56+x,.13,z+.32).scale.z=.35;
    }
  }
  const trunk:THREE.Group[]=[];let parent:THREE.Object3D=body;
  for(let i=0;i<7;i++){
    const joint=new THREE.Group();joint.position.set(0,i===0?1.72:-.19,i===0?1.50:.02);parent.add(joint);parent=joint;trunk.push(joint);
    add(joint,new THREE.CapsuleGeometry(.15-i*.012,.12,4,12),skin,0,-.10,0);
  }
  const tip=new THREE.Object3D();tip.position.y=-.21;parent.add(tip);tip.name='Elephant trunk water origin';
  const seal=add(body,new THREE.TorusGeometry(.13,.022,6,32),ivory,0,2.22,1.49);seal.scale.y=.78;
  add(body,new THREE.BoxGeometry(.025,.12,.02),ivory,0,2.22,1.51);
  const tail=new THREE.CatmullRomCurve3([new THREE.Vector3(0,1.6,-1.2),new THREE.Vector3(.1,1.1,-1.45),new THREE.Vector3(.12,.73,-1.4)]);
  add(body,new THREE.TubeGeometry(tail,12,.035,6,false),shade,0,0,0);
  return {root,animate(time:number,aim:number){body.position.y=Math.sin(time*1.8)*.018;trunk.forEach((joint,i)=>{joint.rotation.x=(i===0?-.25:-.04)-aim*(i===0?.6:.1);});},trunkWorld(out:THREE.Vector3){root.updateMatrixWorld(true);return tip.getWorldPosition(out);}};
}

export function createMahoraga(palette:Palette){
  const root=new THREE.Group(),body=new THREE.Group();root.add(body);root.name='Mahoraga Divine General';const add=builder(palette),skin='#d3d2c4',shadow='#969e98',ink='#252b32',gold='#bfb78d';
  add(body,new THREE.SphereGeometry(.55,24,18),skin,0,2.40,0).scale.set(1.35,1.23,.65);
  add(body,new THREE.CapsuleGeometry(.32,.39,5,18),skin,0,1.96,0).scale.z=.75;
  for(const side of [-1,1]){
    add(body,new THREE.SphereGeometry(.30,18,14),skin,side*.31,2.52,.22).scale.set(1.14,.70,.5);
    for(let i=0;i<3;i++)add(body,new THREE.SphereGeometry(.13,14,10),shadow,side*.14,2.21-i*.16,.26).scale.set(1,.62,.3);
    add(body,new THREE.CapsuleGeometry(.19,.58,5,14),skin,side*.30,.62,0);
    add(body,new THREE.SphereGeometry(.23,16,12),skin,side*.31,.15,.12).scale.set(1,.55,1.65);
  }
  add(body,new THREE.LatheGeometry([[.35,-.54],[.55,-.49],[.51,.30],[.38,.54]].map(([x,y])=>new THREE.Vector2(x,y)),24),ink,0,1.34,0);
  add(body,new THREE.CylinderGeometry(.43,.44,.16,24),'#e2ddcb',0,1.82,0);
  for(let i=0;i<12;i++){const a=i*Math.PI/6;const pleat=add(body,new THREE.CapsuleGeometry(.022,.75,3,6),shadow,Math.cos(a)*.51,1.22,Math.sin(a)*.51);pleat.rotation.z=-Math.cos(a)*.12;}
  add(body,new THREE.CylinderGeometry(.19,.23,.33,16),skin,0,2.96,0);
  const head=new THREE.Group();head.position.set(0,3.24,0);body.add(head);
  add(head,new THREE.SphereGeometry(.32,24,18),skin,0,0,0).scale.set(.92,1.10,.91);
  add(head,new THREE.SphereGeometry(.19,18,12),ink,0,-.12,.24).scale.set(1,.25,.25);
  for(let i=0;i<7;i++)add(head,new THREE.ConeGeometry(.017,.055,5).rotateZ(Math.PI),skin,(i-3)*.046,-.095,.285);
  for(const side of [-1,1])for(let i=0;i<2;i++){
    const fin=add(head,new THREE.ConeGeometry(.07,.55-i*.09,4,2),skin,side*(.34+i*.06),.10-i*.10,.015);
    fin.rotation.z=-side*(Math.PI/2-.15+i*.22);fin.scale.z=.5;
  }
  const headTail=new THREE.CatmullRomCurve3([new THREE.Vector3(0,3.34,-.22),new THREE.Vector3(0,3.15,-.60),new THREE.Vector3(.1,2.62,-.65),new THREE.Vector3(.18,2.39,-.48)]);
  add(body,new THREE.TubeGeometry(headTail,20,.055,8,false),skin,0,0,0);
  const wheel=new THREE.Group();wheel.name='Mahoraga eight-handled wheel';wheel.position.set(0,3.94,0);root.add(wheel);
  add(wheel,new THREE.TorusGeometry(.49,.04,8,64).rotateX(Math.PI/2),gold,0,0,0);
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4,spoke=add(wheel,new THREE.CylinderGeometry(.025,.025,.60,8),gold,Math.cos(a)*.31,0,Math.sin(a)*.31,`Mahoraga wheel spoke ${i}`);
    spoke.rotation.z=Math.PI/2;spoke.rotation.y=-a;
    add(wheel,new THREE.SphereGeometry(.07,12,8),gold,Math.cos(a)*.64,0,Math.sin(a)*.64);
  }
  add(wheel,new THREE.SphereGeometry(.09,12,8),gold,0,0,0);
  const arms:THREE.Group[]=[];
  for(const side of [-1,1]){
    const arm=new THREE.Group();arm.position.set(side*.66,2.72,0);body.add(arm);arms.push(arm);
    add(arm,new THREE.SphereGeometry(.27,18,14),skin,0,0,0);
    add(arm,new THREE.CapsuleGeometry(.20,.51,5,14),skin,0,-.40,0);
    add(arm,new THREE.CapsuleGeometry(.17,.46,5,14),skin,0,-1.0,.12).rotation.x=-.17;
    add(arm,new THREE.SphereGeometry(.20,16,12),skin,0,-1.35,.18).scale.set(1,1.2,.6);
    for(let finger=0;finger<4;finger++)add(arm,new THREE.CapsuleGeometry(.037,.18,4,8),skin,(finger-1.5)*.085,-1.51,.23);
    if(side===-1){
      const bladeShape=new THREE.Shape();bladeShape.moveTo(-.10,0);bladeShape.lineTo(-.16,-.9);bladeShape.quadraticCurveTo(-.09,-1.25,0,-1.40);bladeShape.quadraticCurveTo(.12,-1.08,.14,-.82);bladeShape.lineTo(.09,0);bladeShape.closePath();
      add(arm,new THREE.ExtrudeGeometry(bladeShape,{depth:.055,bevelEnabled:true,bevelSize:.016,bevelThickness:.012,bevelSegments:2,steps:1}), '#e8eed1',0,-.92,.34,'Mahoraga Sword of Extermination');
    }
  }
  for(let i=0;i<12;i++){const a=i/11*Math.PI;const ring=add(body,new THREE.TorusGeometry(.045,.013,5,10),gold,Math.cos(a)*.40,2.40-Math.sin(a)*.44,.34);ring.rotation.y=i%2?Math.PI/2:0;}
  return {root,wheel,animate(time:number,attack:number,turn:number){body.position.y=Math.sin(time*1.4)*.012;wheel.rotation.y=turn*Math.PI/4;arms[0].rotation.x=-.35-attack*1.6;arms[1].rotation.z=.25+attack*.20;body.rotation.y=-attack*.17;}};
}

/** One vertex-colored rabbit geometry, shared by every instance in the swarm. */
export function createRabbitGeometry(){
  const parts:THREE.BufferGeometry[]=[];
  const add=(g:THREE.BufferGeometry,color:string,x:number,y:number,z:number,sx=1,sy=1,sz=1,rz=0)=>{
    g.scale(sx,sy,sz).rotateZ(rz).translate(x,y,z);const c=new THREE.Color(color),colors=new Float32Array(g.getAttribute('position').count*3);
    for(let i=0;i<colors.length;i+=3){colors[i]=c.r;colors[i+1]=c.g;colors[i+2]=c.b;}g.setAttribute('color',new THREE.BufferAttribute(colors,3));parts.push(g);
  };
  const white='#e9ede8';
  add(new THREE.SphereGeometry(.18,14,10),white,0,.19,-.03,.8,.85,1.25);
  add(new THREE.SphereGeometry(.12,14,10),white,0,.32,.16,.9,1,1);
  for(const side of [-1,1]){
    add(new THREE.CapsuleGeometry(.033,.24,4,8),white,side*.053,.52,.13,.85,1,.65,-side*.13);
    add(new THREE.CapsuleGeometry(.017,.18,4,8),'#d5a3aa',side*.053,.53,.152,.8,1,.4,-side*.13);
    add(new THREE.SphereGeometry(.019,8,6),'#20212b',side*.077,.35,.241,1,1,.45);
    add(new THREE.SphereGeometry(.09,10,8),white,side*.12,.09,-.13,1,.7,1.2);
    add(new THREE.SphereGeometry(.055,10,8),white,side*.064,.055,.16,.75,.45,1.3);
  }
  add(new THREE.SphereGeometry(.021,8,6),'#ca9da5',0,.30,.28,1,.75,.6);
  add(new THREE.SphereGeometry(.06,10,8),white,0,.23,-.25);
  const result=mergeGeometries(parts);parts.forEach(p=>p.dispose());if(!result)throw new Error('No se pudo crear la estampida.');result.computeBoundingSphere();return result;
}

/** Bake a posed CPU-only model into one rigid silhouette for domain doubles. */
export function bakeShadowModel(root:THREE.Object3D){
  root.position.set(0,0,0);root.rotation.set(0,0,0);root.visible=true;root.updateMatrixWorld(true);const pieces:THREE.BufferGeometry[]=[];
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
  root.traverse(o=>{
    if(!(o instanceof THREE.Mesh))return;
    geometries.add(o.geometry);const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>materials.add(m));
    if(o.parent instanceof THREE.Mesh||!o.visible)return;
    for(let parent=o.parent;parent&&parent!==root;parent=parent.parent)if(!parent.visible)return;
    const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrixWorld);g.deleteAttribute('color');pieces.push(g);
  });
  const result=mergeGeometries(pieces);pieces.forEach(g=>g.dispose());geometries.forEach(g=>g.dispose());
  materials.forEach(m=>{Object.values(m).forEach(v=>{if(v instanceof THREE.Texture)textures.add(v);});m.dispose();});textures.forEach(t=>t.dispose());
  if(!result)throw new Error('No se pudo crear el doble de sombra.');return result;
}
