import * as THREE from 'three';
import { TECHNIQUES } from '../core/techniques';
import type { TechniqueKey } from '../core/types';
import { GojoEffects } from './GojoEffects';
import { SukunaEffects } from './SukunaEffects';
import { YujiEffects } from './YujiEffects';
import { MegumiEffects } from './MegumiEffects';
import { combatTimeline, persistentTargetTimeline, type CombatState } from './combatTimeline';
import { CombatAccents } from './CombatAccents';
import { CURSE_CENTER } from './CurseActor';
import { TechniqueSpectacle } from './TechniqueSpectacle';
import type { ShrineAssetStatus } from './ShrineDomain';

export class TechniqueEffects {
  private readonly gojo: GojoEffects;
  private readonly sukuna: SukunaEffects;
  private readonly yuji: YujiEffects;
  private readonly megumi: MegumiEffects;
  private active: GojoEffects | SukunaEffects | YujiEffects | MegumiEffects;
  private readonly accents: CombatAccents;
  private readonly spectacle: TechniqueSpectacle;
  private key: TechniqueKey = 'blue';
  private began = -Infinity;
  private debug = false;
  private previewTarget = false;
  private targetBegan = -Infinity;
  private targetKey: TechniqueKey = 'blue';
  private frozenTargetElapsed: number | null = null;
  private primary: THREE.Vector3 | null = null;
  private secondary: THREE.Vector3 | null = null;
  readonly origin = new THREE.Vector3();
  readonly target = CURSE_CENTER.clone();
  readonly field = CURSE_CENTER.clone().add(new THREE.Vector3(-1.1, .25, .3));
  combat: CombatState = combatTimeline('blue', -1, 1800);
  targetResponse: CombatState = this.combat;
  constructor(scene: THREE.Scene, camera: THREE.Camera, onShrineStatus?: (status: ShrineAssetStatus) => void) {
    this.gojo = new GojoEffects(scene, camera); this.sukuna = new SukunaEffects(scene, camera, onShrineStatus); this.active = this.gojo;
    this.yuji = new YujiEffects(scene,camera); this.yuji.setTarget(this.target);
    this.megumi = new MegumiEffects(scene,camera); this.megumi.setTarget(this.target);
    this.accents = new CombatAccents(scene);
    this.spectacle = new TechniqueSpectacle(scene, camera); this.gojo.setEnhanced(true); this.sukuna.setEnhanced(true);
    this.gojo.setTarget(this.target, this.field); this.sukuna.setTarget(this.target);
  }
  get attraction() { return this.active.attraction; }
  get repulsion() { return this.active.repulsion; }
  get impact() { return this.active.impact; }
  get stun() { return this.active.stun; }
  get domainMix() { return this.active.domainMix; }
  setTechnique(key: TechniqueKey) {
    this.clear(); this.key = key;
    this.active = {gojo:this.gojo,sukuna:this.sukuna,yuji:this.yuji,megumi:this.megumi}[TECHNIQUES[key].character]; this.active.setTechnique(key);
  }
  setSettings(intensity: number, reduced: boolean, quality: 'high' | 'low' = 'high') {
    this.gojo.setSettings(intensity, reduced); this.sukuna.setSettings(intensity, reduced, quality); this.accents.setSettings(intensity, reduced);
    this.yuji.setSettings(intensity,reduced,quality);
    this.megumi.setSettings(intensity,reduced,quality);
    this.spectacle.setSettings(intensity, reduced, quality);
  }
  setDetailedPose(detailed: boolean) { this.sukuna.setDetailedPose(detailed); }
  preloadShrine() { return this.sukuna.preloadShrine(); }
  dispose() { this.sukuna.dispose(); }
  sampleCombat(now: number) { return combatTimeline(this.key, now - this.began, TECHNIQUES[this.key].effectMs, this.debug); }
  setPalms(a: THREE.Vector3 | null, b: THREE.Vector3 | null) { this.primary = a; this.secondary = b; this.active.setPalms(a, b); }
  setCharge(progress: number, step = 0) { this.active.setCharge(progress, step); }
  activate(now: number, debug: boolean, previewTarget = false) {
    this.began = now; this.debug = debug; this.previewTarget = debug && previewTarget;
    if (!debug || previewTarget) { this.targetBegan = now; this.targetKey = this.key; this.frozenTargetElapsed = null; }
    this.origin.copy((this.key === 'flame' ? this.secondary ?? this.primary : this.primary) ?? new THREE.Vector3(-1, 2, 1));
    if (this.key === 'fusion' && this.secondary) this.origin.add(this.secondary).multiplyScalar(.5);
    this.active.activate(now, debug);
  }
  update(now: number) {
    this.active.update(now);
    this.combat = this.sampleCombat(now);
    this.targetResponse = persistentTargetTimeline(this.targetKey, this.frozenTargetElapsed ?? now - this.targetBegan, TECHNIQUES[this.targetKey].effectMs);
    this.accents.update(this.combat, this.target, this.field, this.origin);
    this.spectacle.update(this.combat, this.origin, this.target, this.field);
  }
  clear(preserveTarget = false) {
    if (preserveTarget && Number.isFinite(this.targetBegan) && this.frozenTargetElapsed === null)
      this.frozenTargetElapsed = this.targetResponse.active ? this.targetResponse.elapsed : 0;
    this.began = -Infinity; this.primary = null; this.secondary = null; this.previewTarget = false;
    this.combat = combatTimeline(this.key, -1, TECHNIQUES[this.key].effectMs);
    if (!preserveTarget) { this.targetBegan = -Infinity; this.frozenTargetElapsed = null; this.targetResponse = this.combat; }
    this.gojo.clear(); this.sukuna.clear(); this.yuji.clear(); this.megumi.clear(); this.accents.clear(); this.spectacle.clear();
  }
}
