import type { HandLandmarker } from '@mediapipe/tasks-vision';
import { HandContinuity } from '../core/HandContinuity';
import type { HandFrame, HandObservation } from '../core/types';

export interface TrackerStatus { ready: boolean; message: string; backend: string; error?: string }

export class HandTracker {
  private model: HandLandmarker | null = null;
  private stream: MediaStream | null = null;
  private continuity = new HandContinuity();
  private generation = 0;
  private animation = 0;
  private lastFrame = -1;
  private lastDispatch = 0;
  private active = false;
  private backend = '';
  private starting = false;

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly onFrame: (frame: HandFrame) => void,
    private readonly onStatus: (status: TrackerStatus) => void,
    private readonly onEnded: () => void,
  ) {}

  async start(): Promise<void> {
    if (this.starting || this.stream) return;
    const ticket = ++this.generation;
    this.starting = true;
    this.onStatus({ ready: false, message: 'Autoriza la webcam en el navegador…', backend: '' });
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('Abre la aplicación en localhost o HTTPS para acceder a la cámara.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 960 }, height: { ideal: 720 }, frameRate: { ideal: 30 }, facingMode: 'user' },
        audio: false,
      });
      if (ticket !== this.generation) { stream.getTracks().forEach(track => track.stop()); return; }
      this.stream = stream;
      stream.getVideoTracks()[0].addEventListener('ended', this.onEnded, { once: true });
      this.video.srcObject = stream;
      await this.video.play();
      if (ticket !== this.generation) return;
      this.onStatus({ ready: false, message: 'Cargando el modelo local de manos…', backend: '' });
      const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
      const files = await FilesetResolver.forVisionTasks('/mediapipe');
      if (ticket !== this.generation) return;
      const options = {
        runningMode: 'VIDEO' as const, numHands: 2,
        minHandDetectionConfidence: .65, minHandPresenceConfidence: .65, minTrackingConfidence: .65,
      };
      let detector: HandLandmarker;
      try {
        detector = await HandLandmarker.createFromOptions(files, {
          ...options, baseOptions: { modelAssetPath: '/models/hand_landmarker.task', delegate: 'GPU' },
        });
        this.backend = 'GPU';
      } catch {
        if (ticket !== this.generation) return;
        detector = await HandLandmarker.createFromOptions(files, {
          ...options, baseOptions: { modelAssetPath: '/models/hand_landmarker.task', delegate: 'CPU' },
        });
        this.backend = 'CPU';
      }
      if (ticket !== this.generation) { detector.close(); return; }
      this.model = detector;
      this.starting = false;
      this.resume();
      this.onStatus({ ready: true, message: 'Seguimiento listo. Puedes empezar.', backend: this.backend });
    } catch (error) {
      if (ticket !== this.generation) return;
      this.stop();
      const name = error instanceof Error ? error.name : '';
      const message = name === 'NotAllowedError' ? 'Permiso de cámara denegado. Habilítalo en el navegador y vuelve a intentarlo.' :
        name === 'NotFoundError' ? 'No se encuentra una webcam. Conecta una y vuelve a intentarlo.' :
        name === 'NotReadableError' ? 'La webcam está ocupada o no se puede abrir. Cierra otras aplicaciones que la usen.' :
        `No se pudo iniciar el seguimiento. ${error instanceof Error ? error.message : ''} Si faltan recursos, ejecuta npm run setup:assets.`;
      this.onStatus({ ready: false, message, backend: '', error: message });
    }
  }

  pause(): void {
    this.active = false; cancelAnimationFrame(this.animation); this.continuity.reset();
  }

  resume(): void {
    if (!this.model || !this.stream) return;
    cancelAnimationFrame(this.animation);
    this.active = true; this.lastFrame = -1; this.lastDispatch = 0;
    this.continuity.reset(); this.animation = requestAnimationFrame(this.tick);
  }

  stop(): void {
    ++this.generation; this.starting = false; this.pause();
    this.stream?.getVideoTracks().forEach(track => track.removeEventListener('ended', this.onEnded));
    this.stream?.getTracks().forEach(track => track.stop()); this.stream = null;
    this.model?.close(); this.model = null; this.video.srcObject = null;
  }

  private tick = (now: number): void => {
    if (!this.active) return;
    this.animation = requestAnimationFrame(this.tick);
    if (document.hidden || !this.model || this.video.readyState < 2 || this.video.paused ||
        this.video.currentTime === this.lastFrame || now - this.lastDispatch < 50) return;
    this.lastFrame = this.video.currentTime; this.lastDispatch = now;
    try {
      // Synchronous inference is capped at 20 calls/s, with no queued frames.
      const capturedAt = performance.now();
      const result = this.model.detectForVideo(this.video, capturedAt);
      const observations: HandObservation[] = result.landmarks.map((landmarks, index) => ({
        landmarks, worldLandmarks: result.worldLandmarks[index],
        handedness: result.handedness[index]?.[0]?.categoryName ?? 'Unknown',
        handednessScore: result.handedness[index]?.[0]?.score ?? 0,
      }));
      this.onFrame({ hands: this.continuity.update(observations, capturedAt), capturedAt,
        receivedAt: performance.now(), width: this.video.videoWidth, height: this.video.videoHeight });
    } catch (error) {
      this.stop();
      this.onStatus({ ready: false, message: 'Seguimiento detenido.', backend: '',
        error: `Error del seguimiento: ${error instanceof Error ? error.message : String(error)}` });
    }
  };
}
