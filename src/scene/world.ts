import * as THREE from 'three';
import { createYuji } from './Yuji';
import { createMegumi } from './Megumi';
import { makeGlowTexture, makePalette, outlined } from './materials';
import { createCurse, createGojo, createSukuna } from './characters';

export function createWorld(scene: THREE.Scene) {
  const palette = makePalette(), root = new THREE.Group(); scene.add(root);
  scene.background = new THREE.Color('#152b38'); scene.fog = new THREE.FogExp2('#1a3441', .025);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 20), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: `varying vec3 vPosition; void main(){vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec3 vPosition;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
      void main(){vec3 d=normalize(vPosition);float h=clamp(d.y*.8+.25,0.,1.);
        vec3 color=mix(vec3(.15,.28,.32),vec3(.025,.07,.16),h);
        float n=noise(d.xz*8.)*.6+noise(d.xz*19.)*.3;
        float cloud=step(.52,n)*smoothstep(.05,.4,d.y)*(1.-smoothstep(.6,.9,d.y));
        color=mix(color,vec3(.27,.38,.46),cloud*.45);gl_FragColor=vec4(color,1.);}`,
  }));
  root.add(sky);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(1.35, 24, 16), new THREE.MeshBasicMaterial({ color: '#d3e4d8' }));
  moon.position.set(-12, 18, -34); root.add(moon);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture(), color: '#a5d4cf',
    transparent: true, opacity: .45, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.position.copy(moon.position); glow.scale.set(11, 11, 1); root.add(glow);
  const stars = new Float32Array(120 * 3);
  for (let i = 0; i < 120; i++) {
    const a = i * 2.39996, y = 12 + (i % 17) * 2.7;
    stars.set([Math.cos(a) * 65, y, Math.sin(a) * 65 - 10], i * 3);
  }
  const starGeometry = new THREE.BufferGeometry(); starGeometry.setAttribute('position', new THREE.BufferAttribute(stars, 3));
  root.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: '#9ac4d3', size: .1, transparent: true, opacity: .65 })));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), palette.toon('#273c3e'));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; root.add(ground);
  const platform = outlined(new THREE.CylinderGeometry(6.3, 6.6, .3, 64), palette.toon('#667273'), false);
  platform.position.y = -.12; root.add(platform);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(6.25, 64), palette.toon('#607171'));
  floor.rotation.x = -Math.PI / 2; floor.position.y = .035; floor.receiveShadow = true; root.add(floor);
  const tileMaterial = new THREE.LineBasicMaterial({ color: '#3a5155', transparent: true, opacity: .6 });
  for (let i = -5; i <= 5; i++) {
    const length = Math.sqrt(6.1 ** 2 - i ** 2);
    for (const horizontal of [true, false]) {
      const points = horizontal ? [new THREE.Vector3(-length, .043, i), new THREE.Vector3(length, .043, i)] :
        [new THREE.Vector3(i, .043, -length), new THREE.Vector3(i, .043, length)];
      root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), tileMaterial));
    }
  }
  const runeMaterial = new THREE.MeshBasicMaterial({ color: '#a2c6b3', transparent: true, opacity: .35, side: THREE.DoubleSide });
  for (const radius of [2.8, 5.7, 5.85]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius, radius + .025, 96), runeMaterial);
    ring.rotation.x = -Math.PI / 2; ring.position.y = .05; root.add(ring);
  }
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    const mark = new THREE.Mesh(new THREE.BoxGeometry(.035, .006, .35), runeMaterial);
    mark.position.set(Math.sin(a) * 5.7, .055, Math.cos(a) * 5.7); mark.rotation.y = a; root.add(mark);
  }
  // The gate and garden are procedural scenery, not a scanned real location.
  const stone = palette.toon('#8a9190'), wood = palette.toon('#33454a');
  for (const x of [-3.3, 3.3]) {
    const pillar = outlined(new THREE.BoxGeometry(.48, 4.5, .5), stone); pillar.position.set(x, 2.2, -6.7); root.add(pillar);
    const foot = outlined(new THREE.BoxGeometry(.95, .3, .95), stone); foot.position.set(x, .1, -6.7); root.add(foot);
  }
  for (const [y, width] of [[4.15, 7.7], [3.6, 6.9]]) {
    const beam = outlined(new THREE.BoxGeometry(width, .32, .65), wood); beam.position.set(0, y, -6.7); root.add(beam);
  }
  for (let i = 0; i < 4; i++) {
    const step = outlined(new THREE.BoxGeometry(5.6, .15 + i * .12, 1.1), stone, false);
    step.position.set(0, -.05, -5.5 - i * .75); root.add(step);
  }
  for (const x of [-5.5, 5.5]) for (const z of [-3.5, 3.8]) {
    const lantern = new THREE.Group(); lantern.position.set(x, 0, z);
    const post = outlined(new THREE.CylinderGeometry(.12, .18, 1.3, 6), wood); post.position.y = .65; lantern.add(post);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(.35, .45, .35), new THREE.MeshBasicMaterial({ color: '#dbbe82' }));
    lamp.position.y = 1.35; lantern.add(lamp);
    const cap = outlined(new THREE.ConeGeometry(.42, .23, 4), wood); cap.position.y = 1.68; cap.rotation.y = Math.PI / 4;
    lantern.add(cap); const light = new THREE.PointLight('#f7c388', 1.6, 4, 2); light.position.y = 1.5; lantern.add(light); root.add(lantern);
  }
  const leaves = palette.toon('#344951'), trunk = palette.toon('#28343b');
  for (let i = 0; i < 25; i++) {
    const angle = i * 2.4, radius = 10 + (i % 5) * 2;
    // Keep the forest behind the gate so it cannot obscure the training area.
    const tree = new THREE.Group(); tree.position.set(Math.sin(angle) * radius, 0, -Math.abs(Math.cos(angle) * radius) - 7);
    const height = 3 + (i % 4) * .7;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(.12, .25, height, 5), trunk); stem.position.y = height / 2; tree.add(stem);
    for (let level = 0; level < 3; level++) {
      const crown = new THREE.Mesh(new THREE.ConeGeometry(1.6 - level * .35, 2.2, 7), leaves);
      crown.position.y = height - .5 + level * .7; crown.rotation.y = i; tree.add(crown);
    }
    root.add(tree);
  }
  for (let i = 0; i < 9; i++) {
    const mountain = new THREE.Mesh(new THREE.ConeGeometry(12 + i % 3 * 4, 14 + i % 4 * 3, 5),
      palette.toon(i % 2 ? '#253c4b' : '#304654'));
    mountain.position.set((i - 4) * 15, 3, -40 - (i % 2) * 8); mountain.rotation.y = i * .8; root.add(mountain);
  }
  const gojo = createGojo(palette), sukuna = createSukuna(palette), yuji = createYuji(palette), megumi = createMegumi(palette), curse = createCurse(palette);
  root.add(gojo.root, sukuna.root, yuji.root, megumi.root, curse.root);
  return { root, gojo, sukuna, yuji, megumi, curse, palette };
}
