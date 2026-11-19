import { TechniqueRecognizer, type TechniqueResult } from '../core/TechniqueRecognizer';
import { CHARACTERS, TECHNIQUES, HAND_CONNECTIONS } from '../core/techniques';
import type { CharacterKey, HandFrame, TechniqueKey } from '../core/types';
import { HandTracker } from '../tracking/HandTracker';
import { TrainingScene } from '../scene/TrainingScene';
import { SoundEngine } from '../audio/SoundEngine';
import { completeTechnique, labStore } from './state';
import { isCurseKey, type CurseKey } from '../core/curses';
import { mirroredHandPan } from '../audio/GojoSequenceAudio';

export class LabController {
  private recognizer = new TechniqueRecognizer(TECHNIQUES[labStore.get().technique], labStore.get().settings.gesturePrecision);
  private readonly tracker: HandTracker;
  private readonly sound = new SoundEngine();
  private scene: TrainingScene | null = null;
  private readonly unsubscribe: () => void;
  private countdownEnd = 0;
  private startedAt = 0;
  private elapsedBefore = 0;
  private lastFrame = 0;
  private lastUi = 0;
  private completeAt = 0;
  private debugUntil = 0;
  private playWhenReady = false;
  private respawnAt = 0;
  private pendingCast: { key: TechniqueKey; debug: boolean; previewTarget: boolean } | null = null;
  private cancelIncantation(): void {
    const preview = this.pendingCast?.debug;
    this.pendingCast = null;
    if (labStore.get().incanting) labStore.set({ incanting: false, ...(preview ? { debugEffect: false } : {}) });
  }

  constructor(host: HTMLElement, video: HTMLVideoElement, private readonly skeleton: HTMLCanvasElement) {
    labStore.set({ stage: labStore.get().stage === 'menu' ? 'menu' : 'guide', ready: false, loading: false, startingPractice: false,
      error: null, rendererError: null, shrineAssetStatus: 'idle', incanting: false, awaitingRespawn: false, respawnReady: false, phase: 'ready', progress: 0, stepIndex: 0, hands: 0,
      cameraStatus: 'Cámara apagada', backend: '' });
    this.tracker = new HandTracker(video, this.onFrame, status => {
      if (status.error) this.pause();
      labStore.set({ ready: status.ready, loading: !status.ready && !status.error,
        cameraStatus: status.message, backend: status.backend, error: status.error ?? null,
        ...(status.error ? { startingPractice: false } : {}) });
      if (!status.ready) return;
      if (document.hidden) { this.pause(); return; }
      const stage = labStore.get().stage;
      if (this.playWhenReady && stage === 'guide' && !document.hidden) this.begin();
      else if (document.hidden || stage === 'menu' || stage === 'paused' || stage === 'complete') this.tracker.pause();
    }, () => { this.disconnect(); labStore.set({ error: 'La cámara se ha desconectado. Vuelve a activarla.' }); });
    try {
      this.scene = new TrainingScene(host, labStore.get().settings, this.tick,
        fps => labStore.set({ renderFps: fps }), message => {
          this.pause(); labStore.set({ rendererError: message });
        }, status => labStore.set({ shrineAssetStatus: status }));
      this.scene.setTechnique(labStore.get().technique);
      this.scene.setCurse(labStore.get().curse);
    } catch {
      labStore.set({ rendererError: 'No se pudo crear el escenario WebGL 2. Prueba un navegador actualizado con aceleración gráfica.' });
    }
    this.sound.setVolume(labStore.get().settings.volume); this.sound.prepare(labStore.get().technique);
    let settings = labStore.get().settings;
    let technique = labStore.get().technique;
    let curse = labStore.get().curse;
    this.unsubscribe = labStore.subscribe(() => {
      if (settings !== labStore.get().settings) {
        settings = labStore.get().settings; this.scene?.setSettings(settings);
        this.sound.setVolume(settings.volume);
        this.recognizer.setPrecision(settings.gesturePrecision);
      }
      if (technique !== labStore.get().technique) {
        technique = labStore.get().technique; this.scene?.setTechnique(technique); this.sound.prepare(technique);
      }
      if (curse !== labStore.get().curse) { curse = labStore.get().curse; this.scene?.setCurse(curse); }
    });
    document.addEventListener('visibilitychange', this.visibilityChanged);
    window.addEventListener('pagehide', this.pageHidden);
    window.addEventListener('keydown', this.keyDown);
  }

  enter(mode: 'tutorial' | 'free' = 'tutorial'): void {
    if (mode === 'free' && !labStore.get().completedTechniques.includes(labStore.get().technique)) return;
    this.cancelIncantation();
    this.playWhenReady = false;
    this.sound.stop(); this.sound.unlock(); this.recognizer.reset(); this.scene?.clear(); this.completeAt = 0;
    this.elapsedBefore = 0; this.startedAt = 0;
    labStore.set({ stage: 'guide', mode, hits: 0, progress: 0, releaseProgress: 0, phase: 'ready', stepIndex: 0,
      startingPractice: false, awaitingRespawn: false, respawnReady: false, debugEffect: false, elapsed: 0, hint: 'Revisa el gesto y pulsa Jugar. La cámara se prepara automáticamente.' });
    this.connect();
  }

  selectTechnique(key: TechniqueKey): void {
    if (!TECHNIQUES[key]) return;
    const stage = labStore.get().stage;
    this.pause(); this.sound.stop(); this.scene?.clear();
    this.recognizer = new TechniqueRecognizer(TECHNIQUES[key], labStore.get().settings.gesturePrecision);
    this.completeAt = 0; this.elapsedBefore = 0; this.startedAt = 0;
    labStore.set({ technique: key, tutorialComplete: labStore.get().completedTechniques.includes(key),
      stage: stage === 'menu' ? 'menu' : 'guide', mode: 'tutorial', stepIndex: 0, pairSpan: null,
      hits: 0, awaitingRespawn: false, respawnReady: false, progress: 0, releaseProgress: 0, phase: 'ready', elapsed: 0, debugEffect: false,
      hint: TECHNIQUES[key].description });
    if (stage !== 'menu' && labStore.get().ready) this.tracker.resume();
  }

  selectCharacter(key: CharacterKey): void {
    this.selectTechnique(CHARACTERS[key].techniques[0].key);
  }
  selectCurse(key: CurseKey): void {
    if (!isCurseKey(key) || key === labStore.get().curse) return;
    const inMenu = labStore.get().stage === 'menu';
    this.pause(); this.completeAt = 0; this.debugUntil = 0;
    labStore.set({ curse: key, awaitingRespawn: false, respawnReady: false, stage: inMenu ? 'menu' : 'guide', stepIndex: 0, progress: 0, debugEffect: false, hands: 0 });
    try { localStorage.setItem('jjk-target-v1', key); } catch { /* Optional. */ }
    if (!inMenu && labStore.get().ready) this.tracker.resume();
  }

  connect(): void {
    if (labStore.get().rendererError || labStore.get().loading) return;
    if (labStore.get().ready) { this.tracker.resume(); return; }
    this.sound.unlock(); void this.tracker.start();
  }

  disconnect(): void {
    this.pause(); this.tracker.stop(); this.scene?.clear(true); this.sound.stop();
    labStore.set({ ready: false, loading: false, hands: 0, inferenceFps: 0, backend: '',
      startingPractice: false, cameraStatus: 'Cámara apagada', hint: 'Pulsa Jugar para activar la cámara y seguir entrenando.' });
  }

  begin(): void {
    const state = labStore.get();
    if (state.rendererError || document.hidden || !['guide', 'paused'].includes(state.stage)) return;
    this.cancelIncantation();
    this.sound.stop();
    if (!state.ready) {
      this.playWhenReady = true; this.sound.unlock();
      labStore.set({ stage: 'guide', startingPractice: true,
        hint: 'Preparando la cámara. La cuenta atrás comenzará cuando esté lista.' });
      this.connect(); return;
    }
    this.playWhenReady = false;
    this.sound.unlock(); this.tracker.resume(); this.recognizer.interrupt(); this.scene?.clear(true);
    this.countdownEnd = performance.now() + 3000;
    labStore.set({ stage: 'countdown', startingPractice: false, countdown: 3, progress: 0, stepIndex: 0, debugEffect: false,
      hint: `Coloca ${TECHNIQUES[labStore.get().technique].handCount === 2 ? 'ambas manos' : 'la mano'} frente a la cámara.` });
  }

  pause(): void {
    this.cancelIncantation();
    this.playWhenReady = false;
    if (labStore.get().startingPractice) labStore.set({ startingPractice: false });
    const stage = labStore.get().stage;
    if (stage === 'practice') this.elapsedBefore += performance.now() - this.startedAt;
    this.tracker.pause(); this.recognizer.interrupt(); this.scene?.clear(true); this.sound.stop();
    this.skeleton.getContext('2d')?.clearRect(0, 0, this.skeleton.width, this.skeleton.height);
    if (stage === 'practice' || stage === 'countdown') {
      labStore.set({ stage: 'paused', progress: 0, hands: 0, stepIndex: 0, hint: 'Práctica pausada. Reanuda cuando estés listo.' });
    }
  }

  guide(): void {
    this.pause(); this.sound.stop(); this.scene?.clear(true);
    labStore.set({ stage: 'guide', progress: 0, hint: 'La guía no cuenta como una detección.' });
    if (labStore.get().ready) this.tracker.resume();
  }

  menu(): void {
    this.pause(); this.recognizer.reset(); this.completeAt = 0;
    labStore.set({ stage: 'menu', hits: 0, phase: 'ready', progress: 0, error: null,
      hands: 0, inferenceFps: 0, match: 0, metrics: [], debugEffect: false,
      hint: 'Entra al campo para aprender tu primera técnica.' });
  }

  testEffect(previewTarget = false): void {
    if (!labStore.get().debug || labStore.get().stage === 'practice' || labStore.get().stage === 'countdown') return;
    if (labStore.get().awaitingRespawn || this.pendingCast) return;
    if (labStore.get().stage === 'paused') this.guide();
    this.debugUntil = 0; this.sound.stop(); this.sound.unlock(); this.requestAttack(true, previewTarget);
  }
  private requestAttack(debug: boolean, previewTarget = false): void {
    const state = labStore.get(), request = { key: state.technique, debug, previewTarget };
    this.sound.prepareRelease(state.settings.volume, state.technique);
    if (this.sound.releaseWaitMs(state.technique, performance.now()) === 0) { this.deliverAttack(request, performance.now()); return; }
    this.pendingCast = request; this.scene?.freezeCasting(debug);
    labStore.set({ incanting: true, phase: 'holding', progress: 1, stepIndex: TECHNIQUES[state.technique].steps.length - 1,
      debugEffect: debug, hint: 'Técnica preparada. Completando la invocación; puedes bajar las manos.' });
  }
  private deliverAttack(request: { key: TechniqueKey; debug: boolean; previewTarget: boolean }, now: number): void {
    this.pendingCast = null;
    const state = labStore.get(), technique = TECHNIQUES[request.key];
    if (!request.debug) this.recognizer.commitActivation(now);
    this.scene?.activate(request.debug, request.previewTarget); this.sound.play(state.settings.volume, request.key);
    labStore.set({ incanting: false, debugEffect: request.debug, phase: 'cooldown', progress: 0 });
    if (request.debug) this.debugUntil = now + technique.effectMs;
    if (!request.debug || request.previewTarget) {
      this.respawnAt = now + technique.effectMs; labStore.set({ awaitingRespawn: true, respawnReady: false });
    }
    if (!request.debug) {
      const hits = state.hits + 1; labStore.set({ hits });
      if (state.mode === 'tutorial' && hits >= technique.tutorialGoal) this.completeAt = this.respawnAt;
    }
  }
  retryShrineModel(): void { this.scene?.retryShrineModel(); }
  respawnCurse(): void {
    const state = labStore.get();
    if (!state.awaitingRespawn || !state.respawnReady) return;
    this.sound.stop(); this.scene?.respawnCurse(); this.recognizer.interrupt(); this.respawnAt = 0;
    labStore.set({ awaitingRespawn: false, respawnReady: false, progress: 0, stepIndex: 0, hint: 'Maldición lista. Abre las manos para rearmar y prepara el siguiente gesto.' });
    if (state.mode === 'tutorial' && state.hits >= TECHNIQUES[state.technique].tutorialGoal && state.tutorialComplete) {
      this.pause(); labStore.set({ stage: 'complete' });
    }
  }

  setAudio(file: File): void { this.sound.setFile(file, labStore.get().technique); }

  private onFrame = (frame: HandFrame): void => {
    const state = labStore.get(), technique = TECHNIQUES[state.technique];
    const phase = this.recognizer.snapshot(frame.receivedAt).phase;
    const evaluation = state.stage === 'practice' && !this.pendingCast && (!state.awaitingRespawn || phase === 'cooldown' || phase === 'release')
      ? this.recognizer.update(frame) : this.recognizer.inspect(frame);
    this.scene?.setHands(frame.hands, frame.width / frame.height, evaluation.primaryId, evaluation.secondaryId);
    const delta = frame.capturedAt - this.lastFrame;
    this.lastFrame = frame.capturedAt;
    this.drawSkeleton(frame);
    const patch = { hands: frame.hands.length, match: evaluation.match, metrics: evaluation.metrics, pairSpan: evaluation.span ?? null,
      inferenceFps: delta > 0 && delta < 1000 ? Math.round(1000 / delta) : 0 };
    if (state.stage !== 'practice') { labStore.set(patch); return; }
    if (this.pendingCast) { labStore.set(patch); return; }
    if (state.awaitingRespawn) {
      const gate = this.recognizer.snapshot(frame.receivedAt);
      this.scene?.setCharge(0); labStore.set({ ...patch, progress: 0, phase: gate.phase, cooldown: gate.cooldownRemaining, releaseProgress: gate.releaseProgress,
        hint: state.respawnReady ? 'Observa el resultado. Pulsa Respawnear maldición para continuar.' : 'Técnica en curso. Espera al final para respawnear.' }); return;
    }
    const result = evaluation as TechniqueResult;
    if (!result.fire) {
      const handPan = (id?: number) => {
        const hand = frame.hands.find(h => h.id === id);
        return hand ? mirroredHandPan(hand.landmarks[9].x) : null;
      };
      const castingStep = technique.steps[result.stepIndex];
      this.sound.updateCasting(state.settings.volume, state.technique, {
        step: result.stepIndex, pose: castingStep.pose, holdMs: castingStep.holdMs,
        valid: result.valid, progress: result.progress, holding: result.phase === 'holding',
        bluePan: handPan(result.primaryId), redPan: handPan(result.secondaryId),
      });
    }
    this.scene?.setCharge(result.phase === 'holding' ? result.progress : 0, result.stepIndex);
    labStore.set({ ...patch, phase: result.phase, progress: result.progress,
      releaseProgress: result.releaseProgress, cooldown: result.cooldownRemaining, hint: result.hint, stepIndex: result.stepIndex });
    if (result.fire) {
      this.requestAttack(false);
    }
  };

  private drawSkeleton(frame: HandFrame): void {
    const canvas = this.skeleton, context = canvas.getContext('2d');
    if (!context) return;
    canvas.width = frame.width; canvas.height = frame.height;
    if (!labStore.get().settings.showSkeleton) return;
    context.strokeStyle = '#82e9ff'; context.fillStyle = '#d1f8ff'; context.lineWidth = 2;
    for (const hand of frame.hands) {
      const point = (i: number) => ({ x: (1 - hand.raw[i].x) * frame.width, y: hand.raw[i].y * frame.height });
      for (const [a, b] of HAND_CONNECTIONS) {
        const from = point(a), to = point(b); context.beginPath(); context.moveTo(from.x, from.y);
        context.lineTo(to.x, to.y); context.stroke();
      }
      hand.raw.forEach((_, i) => { const p = point(i); context.beginPath(); context.arc(p.x, p.y, 3, 0, Math.PI * 2); context.fill(); });
    }
  }

  private tick = (now: number): void => {
    this.sound.updatePlayback(now);
    if (this.pendingCast && this.sound.releaseWaitMs(this.pendingCast.key, now) === 0) this.deliverAttack(this.pendingCast, now);
    const state = labStore.get();
    if (state.awaitingRespawn && !state.respawnReady && now >= this.respawnAt) labStore.set({ respawnReady: true });
    if (this.debugUntil && now > this.debugUntil) { this.debugUntil = 0; labStore.set({ debugEffect: false }); }
    if (state.stage === 'countdown') {
      const countdown = Math.max(0, Math.ceil((this.countdownEnd - now) / 1000));
      if (countdown !== state.countdown) labStore.set({ countdown });
      if (now >= this.countdownEnd) {
        this.startedAt = now; this.recognizer.interrupt();
        labStore.set({ stage: 'practice', phase: this.recognizer.snapshot(now).phase,
          hint: TECHNIQUES[state.technique].steps[0].instruction });
      }
    }
    if (state.stage === 'practice' && !this.pendingCast && now - this.lastFrame > 250) {
      this.sound.stopPreparation();
      this.scene?.setHands([]); this.scene?.setCharge(0); this.recognizer.interrupt();
      if (state.hands !== 0 || state.progress !== 0 || state.stepIndex !== 0) labStore.set({ hands: 0, progress: 0, stepIndex: 0, hint: 'Esperando una imagen reciente de la mano.' });
    }
    if (this.pendingCast && now - this.lastFrame > 250) this.scene?.setHands([]);
    if (state.stage === 'practice' && now - this.lastUi > 250) {
      this.lastUi = now; labStore.set({ elapsed: this.elapsedBefore + now - this.startedAt });
    }
    if (this.completeAt && now >= this.completeAt) {
      this.completeAt = 0; completeTechnique(state.technique);
    }
  };

  private visibilityChanged = (): void => { if (document.hidden) this.pause(); };
  private pageHidden = (): void => { this.disconnect(); };
  private keyDown = (event: KeyboardEvent): void => {
    if ((event.target as HTMLElement)?.matches('input, textarea, button, select')) return;
    if (event.key === 'Escape' && labStore.get().stage === 'practice') this.pause();
  };

  dispose(): void {
    this.cancelIncantation();
    this.playWhenReady = false;
    this.tracker.stop(); this.scene?.dispose(); this.sound.dispose(); this.unsubscribe();
    document.removeEventListener('visibilitychange', this.visibilityChanged);
    window.removeEventListener('pagehide', this.pageHidden); window.removeEventListener('keydown', this.keyDown);
  }
}
