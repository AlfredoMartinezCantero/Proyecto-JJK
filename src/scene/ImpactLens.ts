import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import type { CombatState } from './combatTimeline';

/** Localized pressure-wave distortion; reduced-flash mode suppresses color separation. */
export class ImpactLens extends ShaderPass {
  constructor() {
    super({ uniforms: { tDiffuse: { value: null }, center: { value: new THREE.Vector2(.5, .5) }, aspect: { value: 1 },
      radius: { value: 0 }, strength: { value: 0 }, dispersion: { value: 0 } },
      vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform sampler2D tDiffuse;uniform vec2 center;uniform float aspect;uniform float radius;
        uniform float strength;uniform float dispersion;varying vec2 vUv;
        void main(){vec2 p=(vUv-center)*vec2(aspect,1.);float d=length(p);
          float wave=exp(-pow((d-radius)*55.,2.))*strength;
          vec2 offset=p/max(.001,d)*wave*.008/vec2(aspect,1.);vec2 uv=clamp(vUv+offset,vec2(.001),vec2(.999));
          vec3 color=texture2D(tDiffuse,uv).rgb;
          color.r=texture2D(tDiffuse,clamp(uv+offset*dispersion,vec2(.001),vec2(.999))).r;
          color.b=texture2D(tDiffuse,clamp(uv-offset*dispersion,vec2(.001),vec2(.999))).b;
          gl_FragColor=vec4(color,1.);}`,
    }); this.enabled = false;
  }
  setSize(width: number, height: number) { this.uniforms.aspect.value = width / Math.max(1, height); }
  update(state: CombatState, camera: THREE.Camera, target: THREE.Vector3, intensity: number, reduced: boolean) {
    const age = state.hitAge / 1000;
    this.enabled = state.key!=='rabbit-escape'&&state.key!=='toad'&&state.active && age >= 0 && age < .8 && intensity > 0;
    if (!this.enabled) return;
    const ndc = target.clone().project(camera);
    this.uniforms.center.value.set(ndc.x * .5 + .5, ndc.y * .5 + .5);
    this.uniforms.radius.value = .015 + age * .55;
    this.uniforms.strength.value = Math.exp(-age * 3) * intensity * (reduced ? .32 : .8);
    this.uniforms.dispersion.value = reduced ? 0 : .25;
  }
}
