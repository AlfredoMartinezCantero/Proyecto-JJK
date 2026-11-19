import * as THREE from 'three';
import { TECHNIQUES } from '../core/techniques';
import type { CombatState } from './combatTimeline';
import { shrineTimeline } from './shrineTimeline';

/** Short directed opening, wide view of the shrine/target, exact restoration on every exit. */
export class ShrineCamera {
  private readonly home: THREE.Vector3;
  private readonly rotation: THREE.Quaternion;
  private readonly closePosition = new THREE.Vector3(-.5, 2.8, 6.2);
  private readonly closeTarget = new THREE.Vector3(-2.65, 1.8, .8);
  private readonly wideTarget = new THREE.Vector3(0, 3.1, -4.5);
  private readonly focus = new THREE.PerspectiveCamera();
  private engaged = false;
  constructor(private readonly camera: THREE.PerspectiveCamera) {
    this.home = camera.position.clone(); this.rotation = camera.quaternion.clone();
  }
  reset() {
    if (!this.engaged) return;
    this.camera.position.copy(this.home); this.camera.quaternion.copy(this.rotation);
    this.camera.updateMatrixWorld(); this.engaged = false;
  }
  update(state: CombatState, intensity: number, reduced: boolean) {
    if (!state.active || state.key !== 'shrine' || intensity <= 0) { this.reset(); return; }
    this.engaged = true;
    const s = shrineTimeline(state.elapsed, TECHNIQUES.shrine.effectMs);
    // A narrower viewport needs extra distance so the roof/horns stay inside the frame.
    const distance = Math.max(1, (16 / 9) / Math.max(.5, this.camera.aspect));
    const widePosition = new THREE.Vector3(8.4, 6.8, 17.5).sub(this.wideTarget).multiplyScalar(distance).add(this.wideTarget);
    this.camera.position.copy(this.home).lerp(this.closePosition, s.close * (reduced ? .3 : 1));
    this.focus.position.copy(this.closePosition); this.focus.lookAt(this.closeTarget);
    this.camera.quaternion.copy(this.rotation).slerp(this.focus.quaternion, s.close * (reduced ? .3 : 1));
    this.camera.position.lerp(widePosition, s.wide);
    this.focus.position.copy(widePosition); this.focus.lookAt(this.wideTarget);
    this.camera.quaternion.slerp(this.focus.quaternion, s.wide);
    if (!reduced) {
      const rumble = s.landing * intensity * .035;
      this.camera.position.x += Math.sin(state.elapsed * .081) * rumble;
      this.camera.position.y += Math.cos(state.elapsed * .067) * rumble;
    }
    this.camera.updateMatrixWorld();
  }
}
