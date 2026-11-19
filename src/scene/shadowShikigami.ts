import * as THREE from 'three';
import { makePalette, outlined } from './materials';
type Palette = ReturnType<typeof makePalette>;

export function createDivineDog(palette: Palette,white: boolean) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body); root.name = white?'White Divine Dog':'Black Divine Dog';
  const fur = palette.toon(white?'#d4ded9':'#192133'), shade = palette.toon(white?'#9caeb7':'#303950');
  const ink = palette.toon('#0a101c'), fang = palette.toon('#e7e2d4');
  const add = (g: THREE.BufferGeometry,m: THREE.Material,x: number,y: number,z: number,parent = body) => {
    const mesh = outlined(g,m); mesh.position.set(x,y,z); parent.add(mesh); return mesh;
  };
  add(new THREE.CapsuleGeometry(.23,.71,5,16).rotateX(Math.PI/2),fur,0,.91,-.05).scale.x = .91;
  add(new THREE.SphereGeometry(.27,18,14),fur,0,1.01,.33).scale.set(.9,1.1,.9);
  add(new THREE.CapsuleGeometry(.18,.23,5,14).rotateX(-.5),fur,0,1.17,.49);
  const head = new THREE.Group(); head.position.set(0,1.38,.66); body.add(head); head.name = 'Divine Dog head';
  add(new THREE.SphereGeometry(.22,20,16),fur,0,0,0,head).scale.set(.91,1,1.1);
  add(new THREE.SphereGeometry(.145,16,12),fur,0,-.045,.24,head).scale.set(.82,.6,1.3);
  add(new THREE.SphereGeometry(.07,12,10),ink,0,-.025,.395,head).scale.set(1,.7,.5);
  const jaw = new THREE.Group(); jaw.position.set(0,-.08,.08); head.add(jaw); jaw.name = 'Divine Dog jaw';
  add(new THREE.CapsuleGeometry(.075,.17,4,12).rotateX(Math.PI/2),fur,0,-.045,.16,jaw).scale.x = .9;
  for (const side of [-1,1]) {
    const ear = add(new THREE.ConeGeometry(.102,.29,4,3),fur,side*.145,.245,-.02,head); ear.rotation.z = -side*.16;
    add(new THREE.ConeGeometry(.052,.17,3),shade,side*.145,.23,.038,head);
    const eye = add(new THREE.SphereGeometry(.032,12,8),new THREE.MeshBasicMaterial({color:white?'#87bfee':'#b8eac7'}),side*.16,.035,.145,head); eye.scale.set(1.1,.55,.45);
    const brow = add(new THREE.BoxGeometry(.085,.025,.024),shade,side*.15,.08,.15,head); brow.rotation.z = -side*.2;
    const tooth = add(new THREE.ConeGeometry(.025,.09,6),fang,side*.075,-.065,.25,head); tooth.rotation.z = Math.PI;
  }
  const seal = palette.toon(white?'#9d3b53':'#b4c6df');
  for (const [x,y] of [[-.037,.14],[.037,.14],[0,.09]]) add(new THREE.SphereGeometry(.018,8,6),seal,x,y,.20,head).scale.z = .35;
  const legs: THREE.Group[] = [];
  for (const z of [.35,-.43]) for (const side of [-1,1]) {
    const leg = new THREE.Group(); leg.position.set(side*.19,.79,z); body.add(leg); legs.push(leg);
    add(new THREE.SphereGeometry(z<0?.145:.11,14,10),fur,0,-.08,0,leg).scale.set(.85,1.4,1);
    add(new THREE.CapsuleGeometry(.075,.27,4,10),fur,0,-.16,0,leg);
    const lower = add(new THREE.CapsuleGeometry(.055,.27,4,10),fur,0,-.49,z<0?-.035:.015,leg); lower.rotation.x = z<0?-.15:.06;
    add(new THREE.SphereGeometry(.10,12,8),shade,0,-.71,.065,leg).scale.set(.85,.65,1.4);
    for (const x of [-.04,0,.04]) { const claw = add(new THREE.ConeGeometry(.012,.055,5),fang,x,-.72,.19,leg); claw.rotation.x = Math.PI/2; }
  }
  const tail = new THREE.Group(); tail.position.set(0,.96,-.62); body.add(tail);
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(),new THREE.Vector3(.03,.15,-.24),new THREE.Vector3(.16,.34,-.43),new THREE.Vector3(.19,.42,-.48)]);
  const tailGeometry = new THREE.TubeGeometry(curve,15,.09,8,false), tailPositions = tailGeometry.getAttribute('position'), tailUV = tailGeometry.getAttribute('uv');
  const center = new THREE.Vector3();
  for (let i=0;i<tailPositions.count;i++) {
    const u=tailUV.getX(i); curve.getPointAt(u,center); const width=1.3*(1-u*.8);
    tailPositions.setXYZ(i,center.x+(tailPositions.getX(i)-center.x)*width,center.y+(tailPositions.getY(i)-center.y)*width,center.z+(tailPositions.getZ(i)-center.z)*width);
  }
  tailGeometry.computeVertexNormals(); add(tailGeometry,fur,0,0,0,tail);
  for (let i = 0; i < 8; i++) {
    const a = i*Math.PI/4; const tuft = add(new THREE.ConeGeometry(.075,.22,5),fur,Math.cos(a)*.20,1.12+Math.sin(a)*.15,.31);
    tuft.rotation.set(.6,a,-Math.cos(a)*.9);
  }
  return {root,animate(time: number,running: number,bite: number) {
    legs.forEach((leg,i) => { leg.rotation.x = Math.sin(time*17+(i===0||i===3?0:Math.PI))*running*.65; });
    body.position.y = Math.abs(Math.sin(time*17))*running*.05; head.rotation.x = bite*.22; jaw.rotation.x = bite*.7;
    tail.rotation.y = Math.sin(time*4)*.16;
  }};
}

export function createNue(palette: Palette) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body); root.name = 'Nue shikigami';
  const feather = palette.toon('#70504b'), dark = palette.toon('#3c344b'), amber = palette.toon('#a46d49');
  const mask = palette.toon('#c8bda8'), ink = palette.toon('#151323');
  const add = (g: THREE.BufferGeometry,m: THREE.Material,x: number,y: number,z: number,parent = body) => {
    const mesh = outlined(g,m); mesh.position.set(x,y,z); parent.add(mesh); return mesh;
  };
  add(new THREE.SphereGeometry(.39,24,18),feather,0,0,0).scale.set(.9,1.35,.8);
  add(new THREE.SphereGeometry(.30,20,16),dark,0,.43,.10).scale.set(1,1.1,.8);
  const maskGeometry = new THREE.SphereGeometry(.25,10,10), maskPositions=maskGeometry.getAttribute('position');
  for(let i=0;i<maskPositions.count;i++)maskPositions.setX(i,maskPositions.getX(i)*(.8+(maskPositions.getY(i)/.25+1)*.16));
  maskGeometry.computeVertexNormals(); add(maskGeometry,mask,0,.46,.27).scale.set(1,1.13,.38);
  for (const side of [-1,1]) {
    const eye=add(new THREE.SphereGeometry(.067,16,10),ink,side*.105,.49,.355); eye.scale.set(1.05,.66,.28);eye.rotation.z=-side*.18;
    add(new THREE.SphereGeometry(.027,12,8),new THREE.MeshBasicMaterial({color:'#d4a0ef'}),side*.105,.49,.375).scale.z = .25;
    const brow=add(new THREE.BoxGeometry(.13,.025,.025),dark,side*.11,.55,.35);brow.rotation.z=side*.22;
    const horn = add(new THREE.ConeGeometry(.06,.25,5),dark,side*.17,.77,.07); horn.rotation.z = -side*.45;
    const leg = add(new THREE.CapsuleGeometry(.045,.19,4,10),amber,side*.15,-.48,.08); leg.rotation.x = -.35;
    for (const x of [-.055,0,.055]) {
      const claw = add(new THREE.ConeGeometry(.024,.19,6),mask,side*.15+x,-.66,.18); claw.rotation.x = -.7;
    }
  }
  const beak = add(new THREE.ConeGeometry(.065,.18,5),amber,0,.38,.38); beak.rotation.x = Math.PI/2;
  const wings: THREE.Group[] = [];
  const featherShape=new THREE.Shape();featherShape.moveTo(-.055,.28);featherShape.quadraticCurveTo(-.11,-.02,-.05,-.36);
  featherShape.lineTo(0,-.49);featherShape.quadraticCurveTo(.12,-.15,.055,.28);featherShape.closePath();
  const featherGeometry=new THREE.ExtrudeGeometry(featherShape,{depth:.025,bevelEnabled:true,bevelSize:.008,bevelThickness:.008,bevelSegments:2,curveSegments:7,steps:1});
  for (const side of [-1,1]) {
    const wing = new THREE.Group(); wing.position.set(side*.25,.22,0); wing.name = side<0?'Nue left wing':'Nue right wing'; body.add(wing); wings.push(wing);
    add(new THREE.CapsuleGeometry(.12,.78,5,14).rotateZ(Math.PI/2),feather,side*.49,0,0,wing);
    for (let i = 0; i < 9; i++) {
      const f = add(featherGeometry,i%2?dark:amber,side*(.28+i*.16),-.15-i*.025,-i*.028,wing);
      f.rotation.z = side*(.45+i*.06); f.scale.y=1+(i<5?i:9-i)*.09;
    }
    for (let i = 0; i < 5; i++) {
      const cover = add(new THREE.SphereGeometry(.14,12,10),feather,side*(.24+i*.19),-.04,.08,wing); cover.scale.set(1.1,1.6,.35); cover.rotation.z = side*.5;
    }
  }
  for (const x of [-.12,0,.12]) {
    const tail = add(new THREE.CapsuleGeometry(.08,.63,4,10),dark,x,-.46,-.25); tail.rotation.x = -.75; tail.scale.z = .4;
  }
  return {root,animate(time: number,dive: number) {
    wings.forEach((wing,i) => { wing.rotation.z = (i?1:-1)*(.12+Math.sin(time*6)*(.4-dive*.22)); wing.rotation.y = (i?1:-1)*dive*.25; });
    body.rotation.x = -.12-dive*.35; body.position.y = Math.sin(time*3)*.025;
  }};
}
