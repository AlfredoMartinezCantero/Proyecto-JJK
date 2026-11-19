import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { TechniqueEffects } from './TechniqueEffects';
import { CHARACTERS, TECHNIQUES } from '../core/techniques';
import { HandRig } from './HandRig';
import { createWorld } from './world';
import { fadeEnvironmentMaterial, type MaterialState } from './environmentFade';
import { ImpactLens } from './ImpactLens';
import { createCurseActor } from './CurseActor';
import type { CurseKey } from '../core/curses';
import type { Settings } from '../core/settings';
import type { TechniqueKey, TrackedHand } from '../core/types';
import { ShrineCamera } from './ShrineCamera';
import type { ShrineAssetStatus } from './ShrineDomain';
import { shrineTimeline } from './shrineTimeline';

export class TrainingScene {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(42, 1, .1, 200);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly lens = new ImpactLens();
  private readonly world: ReturnType<typeof createWorld>;
  private readonly effect: TechniqueEffects;
  private readonly shrineCamera: ShrineCamera;
  private readonly environmentMaterials = new Map<THREE.Material, MaterialState>();
  private readonly hands = [new HandRig(), new HandRig()];
  private readonly handSlots = new Map<number, HandRig>();
  private readonly resize: ResizeObserver;
  private settings: Settings;
  private frame = 0;
  private last = 0;
  private fpsTime = 0;
  private frames = 0;
  private charge = 0;
  private chargeStep=0;
  private castingLocked = false;
  private technique: TechniqueKey = 'blue';
  private disposed = false;
  private readonly targets = new Map<CurseKey, ReturnType<typeof createCurseActor>>();

  constructor(private readonly host: HTMLElement, settings: Settings,
    private readonly onTick: (now: number) => void, private readonly onFps: (fps: number) => void,
    private readonly onError: (message: string) => void, onShrineStatus?: (status: ShrineAssetStatus) => void) {
    this.settings = settings;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.NeutralToneMapping; this.renderer.toneMappingExposure = 1.15;
    this.renderer.domElement.setAttribute('aria-label', 'Campo 3D de las técnicas de Gojo y objetivo de práctica');
    this.renderer.domElement.addEventListener('webglcontextlost', this.contextLost);
    host.appendChild(this.renderer.domElement);
    this.camera.position.set(8.7, 5.8, 12.5); this.camera.lookAt(0, 1.0, -.6); this.scene.add(this.camera);
    this.scene.add(new THREE.HemisphereLight('#c5dcf6', '#263e42', 2.1));
    const key = new THREE.DirectionalLight('#d4e8ff', 3.5); key.position.set(-5, 10, 4);
    key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: .1, far: 30 });
    key.shadow.bias = -.001; this.scene.add(key);
    const rim = new THREE.DirectionalLight('#7894e0', 1.8); rim.position.set(4, 4, -5); this.scene.add(rim);
    this.world = createWorld(this.scene);
    this.world.root.remove(this.world.gojo.root, this.world.sukuna.root, this.world.yuji.root, this.world.megumi.root, this.world.curse.root);
    this.scene.add(this.world.gojo.root, this.world.sukuna.root, this.world.yuji.root, this.world.megumi.root, this.world.curse.root);
    this.world.root.traverse(object => {
      const material = (object as THREE.Mesh).material;
      if (material) (Array.isArray(material) ? material : [material]).forEach(value => {
        if (!this.environmentMaterials.has(value)) this.environmentMaterials.set(value,
          { opacity: value.opacity, transparent: value.transparent, depthWrite: value.depthWrite });
      });
    });
    this.effect = new TechniqueEffects(this.scene, this.camera, onShrineStatus);
    this.shrineCamera = new ShrineCamera(this.camera);
    this.hands.forEach(hand => this.camera.add(hand.mesh));
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .35, .6, 1.05);
    this.composer.addPass(this.bloom); this.composer.addPass(this.lens); this.composer.addPass(new OutputPass());
    this.resize = new ResizeObserver(this.resizeViewport); this.resize.observe(host);
    this.setSettings(settings); this.resizeViewport(); this.frame = requestAnimationFrame(this.animate);
  }

  private contextLost = (event: Event): void => {
    event.preventDefault(); this.onError('Se ha perdido el contexto gráfico. Recarga la página para recuperar el escenario.');
  };

  private resizeViewport = (): void => {
    const width = Math.max(1, this.host.clientWidth), height = Math.max(1, this.host.clientHeight);
    this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height); this.composer.setSize(width, height);
  };

  setSettings(settings: Settings): void {
    this.settings = settings;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, settings.quality === 'low' ? 1 : 1.75));
    this.bloom.enabled = settings.quality === 'high';
    this.bloom.strength = settings.intensity * (settings.reducedFlashes ? .48 : .8);
    this.effect.setSettings(settings.intensity, settings.reducedFlashes, settings.quality);
    this.effect.setDetailedPose(settings.gesturePrecision === 'detailed');
    this.world.curse.setSettings(settings.intensity, settings.quality, settings.reducedFlashes);
    this.resizeViewport();
  }

  setHands(hands: TrackedHand[], imageAspect = 4 / 3, primaryId?: number, secondaryId?: number): void {
    for (const [id, rig] of this.handSlots) if (!hands.some(hand => hand.id === id)) {
      rig.mesh.visible = false; this.handSlots.delete(id);
    }
    hands.forEach(hand => {
      let rig = this.handSlots.get(hand.id);
      if (!rig) {
        rig = this.hands.find(candidate => ![...this.handSlots.values()].includes(candidate));
        if (!rig) return;
        this.handSlots.set(hand.id, rig);
      }
      rig.update(hand, this.camera, imageAspect, this.settings.showSkeleton);
    });
    const primary = primaryId === undefined ? [...this.handSlots.values()][0] : this.handSlots.get(primaryId);
    const secondary = secondaryId === undefined ? undefined : this.handSlots.get(secondaryId);
    const anchor = (rig: HandRig | undefined, secondaryHand = false) => {
      if (!rig) return null;
      if (this.technique === 'flame' && secondaryHand && this.settings.gesturePrecision === 'detailed')
        return rig.landmarkWorld(4).add(rig.landmarkWorld(8)).multiplyScalar(.5);
      if (['red', 'dismantle'].includes(this.technique) || this.technique === 'flame' && secondaryHand ||
        ['fusion', 'purple'].includes(this.technique) && secondaryHand) return rig.landmarkWorld(8);
      if (['blue', 'domain', 'fusion', 'purple'].includes(this.technique))
        return rig.landmarkWorld(8).add(rig.landmarkWorld(12)).multiplyScalar(.5);
      return rig.palmWorld();
    };
    if (!this.castingLocked) this.effect.setPalms(anchor(primary), anchor(secondary, true));
  }

  setCharge(progress: number, step = 0): void { this.charge = progress;this.chargeStep=step; this.effect.setCharge(progress, step); }
  setTechnique(key: TechniqueKey): void {
    this.castingLocked = false;
    this.technique = key;
    this.hands.forEach(hand => hand.setCharacter(TECHNIQUES[key].character));
    this.shrineCamera.reset();
    this.world.curse.reset();
    this.effect.setTechnique(key); this.applyDomain(0); this.setCharge(0);
    if (key === 'shrine') void this.effect.preloadShrine();
    this.world.gojo.root.visible = TECHNIQUES[key].character === 'gojo';
    this.world.sukuna.root.visible = TECHNIQUES[key].character === 'sukuna';
    this.world.yuji.root.visible = TECHNIQUES[key].character === 'yuji';
    this.world.megumi.root.visible = TECHNIQUES[key].character === 'megumi';
    this.renderer.domElement.setAttribute('aria-label', `Campo 3D de ${CHARACTERS[TECHNIQUES[key].character].name} y objetivo de práctica`);
  }
  setCurse(key: CurseKey): void {
    this.clear(); this.world.curse.root.visible = false;
    let target = this.targets.get(key);
    if (!target) { target = createCurseActor(this.world.palette, key); this.targets.set(key, target); this.scene.add(target.root); }
    this.world.curse = target; target.reset(); target.root.visible = true;
    target.setSettings(this.settings.intensity, this.settings.quality, this.settings.reducedFlashes);
  }
  freezeCasting(debug = false): void {
    if (debug) this.effect.setPalms(new THREE.Vector3(-1, 2, 1), new THREE.Vector3(1, 2, 1));
    this.castingLocked = true; this.setCharge(1, TECHNIQUES[this.technique].steps.length - 1);
  }
  activate(debug: boolean, previewTarget = false): void { this.castingLocked = false; this.setCharge(0); this.effect.activate(performance.now(), debug, previewTarget); }
  clear(preserveTarget = false): void { this.castingLocked = false; this.shrineCamera.reset(); this.setHands([]); this.setCharge(0); this.effect.clear(preserveTarget); if (!preserveTarget) this.world.curse.reset(); this.applyDomain(0); }
  retryShrineModel(): void { void this.effect.preloadShrine(); }
  respawnCurse(): void { this.clear(); }

  private applyDomain(amount: number): void {
    this.environmentMaterials.forEach((original, material) => {
      fadeEnvironmentMaterial(material, original, amount);
    });
    if (this.scene.fog instanceof THREE.FogExp2) this.scene.fog.density = .025 * (1 - amount);
  }

  private animate = (now: number): void => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.animate);
    if (document.hidden) { this.last = now; return; }
    this.onTick(now);
    const dt = Math.min(.05, (now - this.last) / 1000); this.last = now;
    const combat = this.effect.sampleCombat(now);
    this.shrineCamera.update(combat, this.settings.intensity, this.settings.reducedFlashes);
    this.effect.update(now);
    this.applyDomain(this.effect.domainMix);
    this.world.gojo.animate(now / 1000, this.charge);
    this.world.yuji.animate(now / 1000, this.charge, combat);
    this.world.megumi.animate(now / 1000, this.charge, combat,this.chargeStep);
    this.world.sukuna.animate(now / 1000, this.charge, combat.active && combat.key === 'shrine'
      ? shrineTimeline(combat.elapsed, TECHNIQUES.shrine.effectMs).casterPose : 0);
    this.world.curse.animate(now / 1000, this.effect.targetResponse, this.effect.field);
    this.lens.update(this.effect.combat, this.camera, this.effect.target, this.settings.intensity, this.settings.reducedFlashes);
    if (this.settings.quality === 'low') this.renderer.render(this.scene, this.camera);
    else this.composer.render(dt);
    this.frames++;
    if (now - this.fpsTime > 1000) {
      this.onFps(Math.round(this.frames * 1000 / (now - this.fpsTime)));
      this.fpsTime = now; this.frames = 0;
    }
  };

  dispose(): void {
    this.disposed = true; cancelAnimationFrame(this.frame); this.resize.disconnect();
    this.shrineCamera.reset(); this.effect.dispose();
    this.renderer.domElement.removeEventListener('webglcontextlost', this.contextLost);
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
    const skeletons = new Set<THREE.Skeleton>();
    this.hands.forEach(hand => hand.ownedGeometries().forEach(geometry => geometries.add(geometry)));
    this.scene.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) geometries.add(mesh.geometry);
      if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(material => materials.add(material));
      if (mesh.customDepthMaterial) materials.add(mesh.customDepthMaterial);
      if (mesh.customDistanceMaterial) materials.add(mesh.customDistanceMaterial);
      if (object instanceof THREE.SkinnedMesh) skeletons.add(object.skeleton);
      if (object instanceof THREE.InstancedMesh) object.dispose();
    });
    skeletons.forEach(skeleton => skeleton.dispose());
    materials.forEach(material => {
      Object.values(material).forEach(value => { if (value instanceof THREE.Texture) textures.add(value); });
      material.dispose();
    });
    geometries.forEach(geometry => geometry.dispose()); textures.add(this.world.palette.ramp); textures.forEach(texture => texture.dispose());
    this.composer.dispose(); this.bloom.dispose(); this.lens.dispose(); this.renderer.dispose(); this.renderer.domElement.remove();
  }
}
