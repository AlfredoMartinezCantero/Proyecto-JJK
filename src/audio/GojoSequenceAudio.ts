import { GOJO_SEQUENCE_AUDIO } from './techniqueAudio';

/** Raw MediaPipe x is reflected once, like the visible camera/hand overlay. */
export const mirroredHandPan = (x: number) => Number.isFinite(x) ? Math.max(-.9, Math.min(.9, (1 - x * 2) * .9)) : 0;
type Clip = keyof typeof GOJO_SEQUENCE_AUDIO;
type Routing = { source: MediaElementAudioSourceNode; panner: StereoPannerNode | null };

/** One voice at a time: Azul, then Rojo, then fusion; launch preserves the current clip. */
export class GojoSequenceAudio {
  private readonly audio = new Map<Clip, HTMLAudioElement>();
  private readonly routing = new Map<Clip, Routing>();
  private readonly active = new Map<Clip, number>();
  private generation = 0;
  private phase: 'idle' | 'blue' | 'red' | 'fusion' = 'idle';
  private launched = false;
  private disposed = false;
  private volume = .3;
  private began = 0;
  private failVoice: (() => void) | null = null;
  private launchCueMs: number | null = null;
  private releaseArmed = false;
  private cueHeld = false;
  private lastPlaybackTime = 0;
  private lastAdvancedAt = 0;

  constructor(private readonly getContext: () => AudioContext | null, private readonly onFusionFailure: () => void) {}
  get fusionStarted() { return this.phase === 'fusion'; }
  get preparing() { return this.phase !== 'idle' && !this.launched; }
  prepare() { if (!this.disposed) (['blue', 'red', 'fusion'] as const).forEach(key => this.clip(key)); }
  private clip(key: Clip) {
    let audio = this.audio.get(key);
    if (!audio) {
      audio = new Audio(GOJO_SEQUENCE_AUDIO[key]); audio.preload = 'auto'; this.audio.set(key, audio);
    }
    audio.volume = this.volume;
    return audio;
  }
  setVolume(volume: number) {
    this.volume = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0;
    this.audio.forEach(audio => { audio.volume = this.volume; });
  }
  private pan(key: Clip, value: number) {
    const context = this.getContext();
    if (!context) return; // Centered media playback remains available without Web Audio.
    let route = this.routing.get(key);
    if (!route) {
      let source: MediaElementAudioSourceNode | undefined;
      try {
        const panner = typeof context.createStereoPanner === 'function' ? context.createStereoPanner() : null;
        source = context.createMediaElementSource(this.clip(key));
        if (panner) { source.connect(panner); panner.connect(context.destination); }
        else source.connect(context.destination);
        route = { source, panner }; this.routing.set(key, route);
      } catch {
        // Once an element has a media source, reconnect it rather than creating a second source.
        if (source) { source.disconnect(); source.connect(context.destination); this.routing.set(key, { source, panner: null }); }
        return;
      }
    }
    route.panner?.pan.setTargetAtTime(Math.max(-.9, Math.min(.9, value)), context.currentTime, .025);
  }
  hand(key: 'blue' | 'red', pan: number) {
    if (this.disposed) return;
    if (this.phase !== key) {
      this.stop(); this.phase = key; this.pan(key, pan); this.play(key);
    } else this.pan(key, pan);
  }
  moveHands(bluePan: number | null, redPan: number | null) {
    if (this.phase === 'blue' && bluePan !== null) this.pan('blue', bluePan);
    if (this.phase === 'red' && redPan !== null) this.pan('red', redPan);
  }
  fuse(launchCueMs: number | null = null) {
    if (this.disposed || this.phase === 'fusion') return;
    this.stop(); this.phase = 'fusion'; this.launchCueMs = launchCueMs; this.pan('fusion', 0); this.play('fusion');
  }
  armLaunch() { this.releaseArmed = true; }
  updatePlayback() {
    const audio = this.audio.get('fusion');
    if (this.launchCueMs === null || this.phase !== 'fusion' || this.launched || this.releaseArmed || this.cueHeld || !audio || !this.active.has('fusion')) return;
    if (audio.currentTime * 1000 >= this.launchCueMs) {
      // Keep the spoken cue available if the user needs longer to form the final pose.
      audio.pause(); this.cueHeld = true;
      try { audio.currentTime = this.launchCueMs / 1000; } catch { /* Already at the cue. */ }
    }
  }
  releaseWaitMs(now: number): number {
    const audio = this.audio.get('fusion');
    if (this.launchCueMs === null || this.phase !== 'fusion' || !this.active.has('fusion') || !audio || audio.ended || this.cueHeld) return 0;
    const position = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    if (position > this.lastPlaybackTime) { this.lastPlaybackTime = position; this.lastAdvancedAt = now; }
    if (now - this.lastAdvancedAt >= 3000) { this.failVoice?.(); return 0; }
    return Math.max(0, this.launchCueMs - position * 1000);
  }
  launch() {
    if (this.phase !== 'fusion') return;
    this.launched = true;
    const audio = this.audio.get('fusion');
    if (!this.cueHeld || !audio || !this.active.has('fusion')) return;
    this.cueHeld = false;
    const generation = this.generation, fail = this.failVoice;
    try {
      void audio.play().then(() => {
        if ((this.disposed || generation !== this.generation) && !this.active.has('fusion')) audio.pause();
      }).catch(() => fail?.());
    } catch { fail?.(); }
  }
  remainingMs(now: number): number | null {
    const audio = this.audio.get('fusion');
    if (this.phase !== 'fusion' || !this.active.has('fusion') || !audio || audio.ended) return 0;
    const duration = audio.duration;
    if (!Number.isFinite(duration) || duration <= 0) {
      if (now - this.began < 3000) return null;
      this.failVoice?.(); return 0;
    }
    if (now - this.began > duration * 1000 + 3000) { this.failVoice?.(); return 0; }
    return Math.max(0, duration - audio.currentTime) * 1000;
  }
  private play(key: Clip) {
    const audio = this.clip(key), generation = this.generation;
    if (this.volume <= 0) return;
    this.active.set(key, generation);
    this.began = performance.now();
    this.lastPlaybackTime = 0; this.lastAdvancedAt = this.began;
    let failed = false;
    const fail = () => {
      if (failed || this.disposed || this.active.get(key) !== generation) return;
      failed = true; this.active.delete(key); audio.pause(); audio.onerror = null; audio.onloadedmetadata = null;
      if (key === 'fusion') this.onFusionFailure();
    };
    if (key === 'fusion') this.failVoice = fail;
    audio.onerror = fail;
    try {
      audio.currentTime = 0;
      void audio.play().then(() => { if (failed || !this.active.has(key)) audio.pause(); }).catch(fail);
    } catch { fail(); }
  }
  stop() {
    this.generation++; this.active.clear(); this.phase = 'idle'; this.launched = false;
    this.failVoice = null;
    this.launchCueMs = null; this.releaseArmed = false; this.cueHeld = false;
    this.audio.forEach(audio => {
      audio.onerror = null; audio.onloadedmetadata = null; audio.pause(); try { audio.currentTime = 0; } catch { /* Not decoded yet. */ }
    });
  }
  dispose() {
    this.disposed = true; this.stop();
    this.routing.forEach(({ source, panner }) => { source.disconnect(); panner?.disconnect(); });
    this.routing.clear(); this.audio.clear();
  }
}
