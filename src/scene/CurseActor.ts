import * as THREE from 'three';
import { makePalette, outlined } from './materials';
import type { CombatState } from './combatTimeline';
import { CurseDestruction } from './CurseDestruction';
import { destructionState } from './destructionMotion';
import type { CurseKey } from '../core/curses';
import { buildCurseModel } from './curseModels';

export const CURSE_CENTER = new THREE.Vector3(2, 1.47, -1.35);
export function createCurseActor(palette: ReturnType<typeof makePalette>, variant: CurseKey | 'training' = 'training') {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body); root.name = 'Training curse';
  const headParts = new THREE.Group(); headParts.name = 'Curse head parts'; body.add(headParts);
  const surfaces: THREE.Mesh[] = [];
  const uniforms = { dissolve: { value: 0 }, cuts: { value: 0 }, burn: { value: 0 }, stun: { value: 0 } };
  const shade = (source: THREE.Material, clone = true) => {
    const material = clone ? source.clone() : source;
    material.onBeforeCompile = shader => {
      Object.entries(uniforms).forEach(([name, value]) => { shader.uniforms[`curse_${name}`] = value; });
      shader.vertexShader = 'varying vec3 cursePosition;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ncursePosition = position;');
      shader.fragmentShader = `varying vec3 cursePosition; uniform float curse_dissolve; uniform float curse_cuts;
        uniform float curse_burn; uniform float curse_stun;\n` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>', `
        float grain = fract(sin(dot(floor(cursePosition * 38.), vec3(12.9898,78.233,45.164))) * 43758.5453);
        if (curse_dissolve > .001 && grain < curse_dissolve) discard;
        float edge = curse_dissolve > .001 ? 1. - smoothstep(curse_dissolve, curse_dissolve + .12, grain) : 0.;
        float seam = pow(max(0., 1. - abs(sin((cursePosition.x + cursePosition.y * 1.4) * 19.))), 10.);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.035,.012,.055), curse_burn * .85);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.,.3,.4), seam * curse_cuts * .85);
        diffuseColor.rgb += vec3(.7,.22,1.) * edge + vec3(.08,.16,.25) * curse_stun;
        #include <alphatest_fragment>`);
    };
    material.customProgramCacheKey = () => 'jjk-curse-surface-v1';
    return material;
  };
  const purple = shade(new THREE.MeshStandardMaterial({ color: '#60516f', roughness: .68, metalness: .15 }), false);
  const dark = shade(new THREE.MeshStandardMaterial({ color: '#282132', roughness: .5, metalness: .26 }), false);
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z = 0, parent = body) => {
    const mesh = outlined(geometry, material); mesh.position.set(x, y, z);
    // Outlines must disappear with the affected surface too.
    mesh.children.forEach(child => { if (child instanceof THREE.Mesh) { const original = child.material;
      child.material = shade(original); original.dispose(); } });
    mesh.customDepthMaterial = shade(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), false);
    mesh.customDistanceMaterial = shade(new THREE.MeshDistanceMaterial(), false);
    parent.add(mesh); surfaces.push(mesh); return mesh;
  };
  let head: THREE.Mesh;
  const arms: THREE.Group[] = [], legs: THREE.Group[] = [];
  if (variant === 'training') {
  const torso = add(new THREE.LatheGeometry([[0, -.55], [.22, -.49], [.29, -.25], [.27, -.05], [.4, .18], [.43, .38], [.28, .51], [0, .54]]
    .map(([x, y]) => new THREE.Vector2(x, y)), 24), purple, 0, 1.2); torso.scale.z = .78;
  head = add(new THREE.SphereGeometry(.37, 20, 14), purple, 0, 1.99, 0, headParts); head.scale.set(1, 1.1, .92);
  const mouth = add(new THREE.SphereGeometry(.18, 14, 8), dark, 0, 1.87, .303, headParts); mouth.scale.set(1.15, .5, .45);
  for (let i = 0; i < 7; i++) {
    const tooth = add(new THREE.ConeGeometry(.026, .072 + i % 2 * .02, 4),
      shade(palette.toon('#c8bdb0')), (i - 3) * .044, 1.885, .382, headParts);
    tooth.rotation.z = Math.PI + (i - 3) * .07;
  }
  for (const y of [1.02, 1.23, 1.44]) {
    const plate = add(new THREE.IcosahedronGeometry(.14, 1), dark, 0, y, .27); plate.scale.set(.7, .65, .4);
  }
  for (const side of [-1, 1]) {
    const hornGeometry = new THREE.ConeGeometry(.11, .57, 10, 4);
    const hp = hornGeometry.getAttribute('position');
    for (let i = 0; i < hp.count; i++) hp.setX(i, hp.getX(i) + side * Math.pow(hp.getY(i) + .285, 2) * .75);
    hornGeometry.computeVertexNormals();
    const horn = add(hornGeometry, dark, side * .25, 2.36, -.04, headParts); horn.rotation.z = -side * .35;
    const eye = add(new THREE.SphereGeometry(.055, 8, 6), shade(new THREE.MeshBasicMaterial({ color: '#c9e99b' }), false), side * .14, 2, .34, headParts);
    eye.scale.set(1.5, .7, .6);
    const brow = add(new THREE.CapsuleGeometry(.045, .18, 3, 8), dark, side * .16, 2.08, .31, headParts); brow.rotation.z = side * 1.1;
    const cheek = add(new THREE.IcosahedronGeometry(.13, 1), dark, side * .25, 1.88, .15, headParts); cheek.scale.set(.5, 1.15, 1);
    const chest = add(new THREE.SphereGeometry(.24, 12, 10), purple, side * .22, 1.53, .13); chest.scale.set(1, .65, .75);
    const shoulder = add(new THREE.IcosahedronGeometry(.22, 1), dark, side * .45, 1.63, -.02); shoulder.scale.y = .75;
    const leg = new THREE.Group(); leg.position.set(side * .22, .72, 0); body.add(leg); legs.push(leg);
    add(new THREE.CapsuleGeometry(.12, .47, 3, 8), dark, 0, -.27, 0, leg);
    add(new THREE.BoxGeometry(.21, .12, .33), dark, 0, -.61, .07, leg);
    const arm = new THREE.Group(); arm.position.set(side * .4, 1.56, 0); body.add(arm); arms.push(arm);
    const upper = add(new THREE.CapsuleGeometry(.13, .22, 4, 10), purple, side * .12, -.17, 0, arm); upper.rotation.z = side * .35;
    const forearm = add(new THREE.CapsuleGeometry(.105, .25, 4, 10), dark, side * .23, -.47, .03, arm); forearm.rotation.z = side * .22;
    const palm = add(new THREE.SphereGeometry(.11, 10, 8), purple, side * .29, -.7, .08, arm); palm.scale.set(.9, 1.25, .6);
    for (let finger = 0; finger < 3; finger++) {
      const x = side * .29 + (finger - 1) * .065;
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(x, -.73, .09),
        new THREE.Vector3(x, -.85, .12), new THREE.Vector3(x + side * .035, -.95, .22)]);
      add(new THREE.TubeGeometry(curve, 8, .025, 5, false), dark, 0, 0, 0, arm);
      const claw = add(new THREE.ConeGeometry(.025, .1, 5), dark, x + side * .035, -.97, .23, arm); claw.rotation.x = -.65;
    }
  }
  } else {
    const materials = new Map<string, THREE.Material>();
    const built = buildCurseModel(variant, body, add, color => {
      if (!materials.has(color)) materials.set(color, shade(new THREE.MeshStandardMaterial({ color, roughness: .72, metalness: .05 }), false));
      return materials.get(color)!;
    }, headParts);
    head = built.head; arms.push(...built.arms); legs.push(...built.legs); root.name = variant;
  }
  const base = new THREE.Vector3(2, .02, -1.35), outward = new THREE.Vector3(4.65, 0, -2.15).normalize();
  const restorePose = () => {
    root.position.copy(base); root.rotation.set(0, -.2, 0); root.scale.setScalar(1); root.visible = true;
    body.position.set(0, 0, 0); body.rotation.set(0, 0, 0); body.scale.setScalar(1); body.visible = true; head.rotation.set(0, 0, 0); headParts.visible = true;
    arms.forEach(arm => arm.rotation.set(0, 0, 0)); legs.forEach(leg => leg.rotation.set(0, 0, 0));
    Object.values(uniforms).forEach(uniform => { uniform.value = 0; });
  };
  restorePose();
  const headSurfaces = surfaces.filter(mesh => mesh.parent === headParts);
  const destruction = new CurseDestruction(root, surfaces, headSurfaces);
  const reset = () => { restorePose(); destruction.reset(); shadowRemnant.visible=false; };
  const shadowRemnant=new THREE.Mesh(new THREE.CircleGeometry(.68,48),new THREE.MeshBasicMaterial({color:'#080a14',transparent:true,opacity:.85,depthWrite:false}));
  shadowRemnant.name='Chimera target shadow remnant';shadowRemnant.rotation.x=-Math.PI/2;shadowRemnant.visible=false;root.add(shadowRemnant);
  return { root, uniforms, reset, targetPoint: () => CURSE_CENTER.clone(),
    setSettings(intensity: number, quality: 'high' | 'low', reducedFlashes = true) { destruction.setSettings(intensity, quality, reducedFlashes); },
    animate(time: number, state: CombatState, field: THREE.Vector3) {
      restorePose();
      const responding = state.active && !state.preview;
      const pull = responding ? state.pull : 0, kick = responding ? state.knockback : 0, stun = responding ? state.stun : 0;
      if (!destructionState(state).engaged) root.position.addScaledVector(outward, kick * 2.35);
      root.position.x += (field.x - base.x) * pull * .8; root.position.z += (field.z - base.z) * pull * .8;
      root.position.y += pull * .65;
      body.scale.set(1 - pull * .23, 1 + pull * .24, 1 - pull * .23);
      body.position.y = Math.sin(time * 2) * .035 * (1 - stun);
      body.rotation.z = -kick * .7 + Math.sin(time * 11) * pull * .09;
      body.rotation.x = kick * .45;
      head.rotation.z = Math.sin(time * 5) * pull * .12;
      arms.forEach((arm, i) => { arm.rotation.z = (i ? 1 : -1) * (.12 + pull * 1.15 + kick * .6);
        arm.rotation.x = -kick * .8 + stun * .12; });
      legs.forEach((leg, i) => { leg.rotation.x = kick * (i ? .55 : -.6) + Math.sin(time * 7 + i) * pull * .18; });
      shadowRemnant.visible=false;
      if (responding && (state.key === 'divergent' || state.key === 'nue' || state.key==='toad' || state.key==='max-elephant')) {
        const fall = state.collapse ?? 0;
        body.rotation.x = fall*Math.PI*.48 + state.pulse*.13;
        body.rotation.z *= 1-fall; body.position.y += fall*.4;
        arms.forEach((arm, i) => { arm.rotation.z += (i ? 1 : -1)*fall*.35; });
        legs.forEach(leg => { leg.rotation.x *= 1-fall; });
      }
      if (responding && state.cuts > 0) {
        // A short recoil at each contact, not continuous random shaking.
        body.position.x = Math.sin(Math.max(0, state.hitAge) / 27) * state.pulse * .11;
      }
      if(responding&&state.key==='toad'){
        root.position.x-=2*(state.drag??0);root.position.z+=.6*(state.drag??0);
        arms.forEach((arm,i)=>{arm.rotation.z=(i?1:-1)*.1*(state.bind??0);arm.rotation.x-=.6*(state.bind??0);});
      }
      if(responding&&state.key==='max-elephant')root.position.addScaledVector(outward,(state.flood??0)*.8);
      if(responding&&state.key==='rabbit-escape'){
        const distraction=state.distract??0;head.rotation.y=Math.sin(time*6)*.45*distraction;
        arms.forEach((arm,i)=>{arm.rotation.x=-.7*distraction;arm.rotation.z+=(i?1:-1)*.3*distraction;});
      }
      if(responding&&state.key==='chimera-garden'){
        const sink=state.engulf??0;root.position.y-=3.4*sink;body.visible=sink<.98;
        body.rotation.z=Math.sin(time*5)*sink*(1-sink)*.15;
        shadowRemnant.visible=sink>.95;shadowRemnant.position.y=.065-root.position.y;
      }
      uniforms.dissolve.value = state.dissolve; uniforms.cuts.value = state.cuts;
      uniforms.burn.value = state.burn; uniforms.stun.value = state.stun;
      if (responding && state.key === 'nue') {
        const shock = state.shock ?? 0; body.position.x += Math.sin(state.elapsed*.075)*shock*.035;
        uniforms.stun.value = shock*.8;
      }
      destruction.update(state, body, uniforms, headParts);
    },
  };
}
