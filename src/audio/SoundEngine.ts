import type { TechniqueKey } from '../core/types';
import { TECHNIQUE_AUDIO } from './techniqueAudio';
import { GojoSequenceAudio } from './GojoSequenceAudio';
import { CAST_AUDIO_STABLE_MS, type CastingAudioFrame } from './castingAudio';
import { HOLLOW_PURPLE_FADE_MS, HOLLOW_PURPLE_RELEASE_MS, hasIncantation, incantationTailMs, isPurpleAudio } from './hollowPurpleAudio';
import { TECHNIQUES } from '../core/techniques';
import { DIVERGENT_DELAY_MS, isYujiTechnique, YUJI_CONTACT } from '../scene/yujiTimeline';
import { isMegumiTechnique, megumiContactTimes } from '../scene/megumiTimeline';

const PRESETS: Record<TechniqueKey, { start: number; end: number; duration: number; wave: OscillatorType; voices: number }> = {
  blue: { start: 150, end: 38, duration: 1.2, wave: 'sine', voices: 1 },
  red: { start: 65, end: 260, duration: .75, wave: 'triangle', voices: 1 },
  fusion: { start: 180, end: 90, duration: 1.8, wave: 'sine', voices: 2 },
  purple: { start: 230, end: 42, duration: 2, wave: 'triangle', voices: 2 },
  domain: { start: 55, end: 80, duration: 3, wave: 'sine', voices: 3 },
  dismantle: { start: 700, end: 85, duration: .4, wave: 'triangle', voices: 1 },
  cleave: { start: 380, end: 65, duration: .8, wave: 'triangle', voices: 2 },
  flame: { start: 95, end: 330, duration: 1.8, wave: 'sawtooth', voices: 1 },
  shrine: { start: 45, end: 60, duration: 3, wave: 'triangle', voices: 3 },
  divergent: { start: 155, end: 35, duration: .24, wave: 'triangle', voices: 2 },
  'black-flash': { start: 190, end: 28, duration: .40, wave: 'sawtooth', voices: 3 },
  'divine-dogs': { start: 175, end: 42, duration: .25, wave: 'triangle', voices: 2 },
  nue: { start: 680, end: 110, duration: .6, wave: 'sawtooth', voices: 2 },
  totality:{start:175,end:32,duration:.3,wave:'triangle',voices:2},
  toad:{start:130,end:65,duration:.4,wave:'sine',voices:2},
  'max-elephant':{start:145,end:75,duration:2.1,wave:'sawtooth',voices:2},
  'rabbit-escape':{start:360,end:210,duration:1.3,wave:'triangle',voices:2},
  mahoraga:{start:125,end:30,duration:1.1,wave:'triangle',voices:3},
  'chimera-garden':{start:65,end:38,duration:1.3,wave:'sine',voices:2},
};

export class SoundEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private files = new Map<TechniqueKey, { audio: HTMLAudioElement; url: string }>();
  private bundled = new Map<string, HTMLAudioElement>();
  private oscillators: OscillatorNode[] = [];
  private playback = 0;
  private volume = .3;
  private disposed = false;
  private castKey: TechniqueKey | null = null;
  private castCue: string | null = null;
  private castStep = 0;
  private launched = false;
  private endsAt: number | null = null;
  private playbackFade = 1;
  private cueStep = 0;
  private queuedFuga: CastingAudioFrame | null = null;
  private voice: { audio: HTMLAudioElement; began: number; advancedAt: number; position: number; fail: () => void; failed: boolean } | null = null;
  private readonly gojoSequence = new GojoSequenceAudio(() => this.context, () => this.synthesise('purple'));

  unlock(): void {
    if (this.disposed) return;
    try {
      if (!this.context) {
        this.context = new AudioContext(); this.master = this.context.createGain();
        this.master.gain.value = this.volume; this.master.connect(this.context.destination);
      }
      void this.context.resume().catch(() => {});
    } catch { /* Visuals remain usable. */ }
  }
  setVolume(volume: number): void {
    this.volume = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0;
    const output = this.volume * this.playbackFade;
    this.files.forEach(({ audio }) => { audio.volume = output; });
    this.bundled.forEach(audio => { audio.volume = output; });
    this.gojoSequence.setVolume(output);
    if (this.context && this.master) this.master.gain.setTargetAtTime(output, this.context.currentTime, .015);
  }
  /** Same monotonic render clock as the technique animation, including debug previews. */
  updatePlayback(now: number): void {
    this.gojoSequence.updatePlayback();
    if (this.queuedFuga && this.mediaRemaining(now) === 0) {
      const frame = this.queuedFuga; this.queuedFuga = null;
      this.updateCasting(this.volume, 'flame', frame);
    }
    if (this.endsAt === null) return;
    if (now >= this.endsAt) { this.stop(); return; }
    const fade = Math.min(1, Math.max(0, (this.endsAt - now) / HOLLOW_PURPLE_FADE_MS));
    if (fade !== this.playbackFade) { this.playbackFade = fade; this.setVolume(this.volume); }
  }
  private limitPlayback(key: TechniqueKey) {
    if (hasIncantation(key) || TECHNIQUES[key].character !== 'gojo') this.endsAt = performance.now() + TECHNIQUES[key].effectMs;
  }
  prepareRelease(volume: number, key: TechniqueKey): void {
    if (!hasIncantation(key)) return;
    if (!(this.castKey === key && (this.castCue === 'fusion' || this.castCue === 'activation' || this.castCue === 'custom'))) {
      const index = key === 'flame' ? 1 : 2, step = TECHNIQUES[key].steps[index];
      this.updateCasting(volume, key, { step: index, pose: step.pose, holdMs: step.holdMs,
        valid: true, holding: true, progress: .5, bluePan: 0, redPan: 0 });
    }
    if (key === 'purple' && !this.files.has(key)) this.gojoSequence.armLaunch();
  }
  releaseWaitMs(key: TechniqueKey, now: number): number | null {
    if (!hasIncantation(key) || this.volume <= 0) return 0;
    if (this.files.has(key) && TECHNIQUES[key].character === 'sukuna') return 0;
    // Only the bundled Purple voice has the user-verified cue; custom audio
    // keeps gesture-driven release and never waits for its unknown duration.
    if (key === 'purple') return this.files.has(key) ? 0 : this.gojoSequence.releaseWaitMs(now);
    if (this.queuedFuga) {
      const first = this.mediaRemaining(now);
      const audio = this.bundledAudio(TECHNIQUE_AUDIO.flame!.activation[0]);
      return first === null || !Number.isFinite(audio.duration) ? null : first + Math.max(0, audio.duration * 1000 - incantationTailMs(key));
    }
    const remaining = isPurpleAudio(key) && !this.files.has(key) ? this.gojoSequence.remainingMs(now) : this.mediaRemaining(now);
    return remaining === null ? null : Math.max(0, remaining - incantationTailMs(key));
  }
  private mediaRemaining(now: number): number | null {
    const voice = this.voice;
    if (!voice || voice.failed || voice.audio.ended) return 0;
    if (voice.audio.currentTime > voice.position) { voice.position = voice.audio.currentTime; voice.advancedAt = now; }
    if (now - voice.advancedAt >= 3000) { voice.fail(); return 0; }
    const duration = voice.audio.duration;
    if (!Number.isFinite(duration) || duration <= 0) {
      if (now - voice.began < 3000) return null;
      voice.fail(); return 0;
    }
    if (now - voice.began > duration * 1000 + 3000) { voice.fail(); return 0; }
    return Math.max(0, duration - voice.audio.currentTime) * 1000;
  }
  prepare(key: TechniqueKey): void {
    if (this.disposed) return;
    if (key === 'purple' || key === 'fusion') { this.gojoSequence.prepare(); return; }
    const config = TECHNIQUE_AUDIO[key];
    [...(config?.activation ?? []), ...(config?.preparation ? [config.preparation] : [])].forEach(url => this.bundledAudio(url));
  }
  private bundledAudio(url: string): HTMLAudioElement {
    let audio = this.bundled.get(url);
    if (!audio) {
      audio = new Audio(url); audio.preload = 'auto'; audio.volume = this.volume; this.bundled.set(url, audio);
    }
    return audio;
  }
  setFile(file: File, key: TechniqueKey): void {
    this.stop();
    const previous = this.files.get(key);
    if (previous) URL.revokeObjectURL(previous.url);
    if (this.disposed) return;
    const url = URL.createObjectURL(file), audio = new Audio(url); audio.preload = 'auto'; audio.volume = this.volume;
    this.files.set(key, { url, audio });
  }
  play(volume: number, key: TechniqueKey = 'blue'): void {
    const pair = isPurpleAudio(key);
    if (this.castKey === key && !this.launched) {
      this.setVolume(volume); this.launched = true; this.limitPlayback(key); this.gojoSequence.launch(); return;
    }
    this.stop();
    this.setVolume(volume);
    this.castKey = key; this.launched = true;
    this.limitPlayback(key);
    if (this.disposed || this.volume <= 0) return;
    const file = this.files.get(key);
    if (pair && !file) { this.gojoSequence.fuse(key === 'purple' ? HOLLOW_PURPLE_RELEASE_MS : null); this.gojoSequence.launch(); return; }
    const clips = file ? [file.audio] : (TECHNIQUE_AUDIO[key]?.activation ?? []).map(url => this.bundledAudio(url));
    if (clips.length) { this.playClips(clips, this.playback, () => this.synthesise(key)); return; }
    this.synthesise(key);
  }
  updateCasting(volume: number, key: TechniqueKey, frame: CastingAudioFrame): void {
    if (this.disposed || this.launched) return;
    // These characters have no supplied voice. Procedural hits are scheduled at contact.
    if ((isYujiTechnique(key) || isMegumiTechnique(key)) && !this.files.has(key)) return;
    if (volume !== this.volume) this.setVolume(volume);
    if (this.castKey && (this.castKey !== key || frame.step < this.castStep || (!frame.valid && frame.progress === 0 && frame.step <= this.cueStep))) this.stopPreparation();
    if (this.castKey === key) this.castStep = frame.step;
    if (!frame.valid || !frame.holding || frame.progress * frame.holdMs < CAST_AUDIO_STABLE_MS) return;
    const custom = this.files.get(key), pair = (key === 'purple' || key === 'fusion') && !custom;
    const cue = custom ? 'custom' : pair ? frame.pose === 'prepare-blue' ? 'blue' : frame.pose === 'prepare-red' ? 'red' : 'fusion'
      : key === 'flame' && frame.pose === 'flame-charge' ? 'flame-charge' : 'activation';
    if (key === 'flame' && !custom && this.castCue === 'flame-charge' && cue === 'activation' && this.volume > 0 && this.mediaRemaining(performance.now()) !== 0) {
      this.queuedFuga = { ...frame }; return;
    }
    if (this.castKey === key && this.castCue === cue) {
      this.gojoSequence.moveHands(frame.bluePan, frame.redPan); return;
    }
    this.stop(); this.setVolume(volume); this.castKey = key; this.castCue = cue; this.castStep = frame.step; this.cueStep = frame.step;
    if (pair) {
      if (cue === 'blue') this.gojoSequence.hand('blue', frame.bluePan ?? 0);
      else if (cue === 'red') this.gojoSequence.hand('red', frame.redPan ?? 0);
      else this.gojoSequence.fuse(key === 'purple' ? HOLLOW_PURPLE_RELEASE_MS : null);
      return;
    }
    if (this.volume <= 0) return;
    const config = TECHNIQUE_AUDIO[key];
    const clips = custom ? [custom.audio] : cue === 'flame-charge' && config?.preparation
      ? [this.bundledAudio(config.preparation)] : (config?.activation ?? []).map(url => this.bundledAudio(url));
    if (clips.length) this.playClips(clips, this.playback, () => { if (cue !== 'flame-charge') this.synthesise(key); });
    else this.synthesise(key);
  }
  stopPreparation(): void { if (this.castKey && !this.launched) this.stop(); }
  private playClips(clips: HTMLAudioElement[], generation: number, onFailure: () => void, index = 0): void {
    if (this.disposed || generation !== this.playback || index >= clips.length) return;
    const audio = clips[index];
    try { audio.currentTime = 0; } catch { /* Seek again after metadata when needed. */ }
    let failed = false;
    const fail = () => {
      if (failed || this.disposed || generation !== this.playback) return;
      failed = true; if (this.voice?.audio === audio) this.voice.failed = true;
      audio.pause(); audio.onended = null; audio.onerror = null; onFailure();
    };
    const now = performance.now();
    this.voice = { audio, began: now, advancedAt: now, position: 0, fail, failed: false };
    audio.onended = () => {
      if (!failed) this.playClips(clips, generation, onFailure, index + 1);
    };
    audio.onerror = fail;
    void audio.play().then(() => {
      // A pause may happen while play() is pending. Avoid reviving a stopped clip.
      if (failed || this.disposed || generation !== this.playback) {
        // A newer cast can legitimately reuse this element.
        if (audio.onended === null) audio.pause();
      }
    }).catch(fail);
  }
  private synthesise(key: TechniqueKey): void {
    if (!this.context || !this.master || this.context.state !== 'running' || this.volume <= 0 || this.disposed) return;
    const context = this.context;
    const preset = PRESETS[key];
    const delays = isMegumiTechnique(key)?megumiContactTimes(key).map(ms=>ms/1000):key === 'divergent' ? [YUJI_CONTACT.divergent/1000,(YUJI_CONTACT.divergent+DIVERGENT_DELAY_MS)/1000] :
      key === 'black-flash' ? [YUJI_CONTACT['black-flash']/1000] : [0];
    if (isMegumiTechnique(key)) {
      const oscillator = context.createOscillator(), gain = context.createGain(), t = context.currentTime;
      oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(72,t); oscillator.frequency.exponentialRampToValueAtTime(32,t+.6);
      gain.gain.setValueAtTime(.001,t); gain.gain.exponentialRampToValueAtTime(.13,t+.2); gain.gain.exponentialRampToValueAtTime(.001,t+.8);
      oscillator.connect(gain).connect(this.master); oscillator.start(t); oscillator.stop(t+.85); this.oscillators.push(oscillator);
    }
    for (const [beat,delay] of delays.entries()) for (let i = 0; i < preset.voices; i++) {
      const t = context.currentTime+delay;
      const oscillator = context.createOscillator(), gain = context.createGain(), ratio = 1 + i * .5;
      oscillator.type = preset.wave; oscillator.frequency.setValueAtTime(preset.start * ratio, t);
      oscillator.frequency.exponentialRampToValueAtTime(preset.end * ratio, t + preset.duration * .9);
      gain.gain.setValueAtTime(.001, t); gain.gain.exponentialRampToValueAtTime((key === 'divergent' && beat === 0 ? .16 : .3) / preset.voices, t + (isYujiTechnique(key) || isMegumiTechnique(key) ? .008 : .08));
      gain.gain.exponentialRampToValueAtTime(.001, t + preset.duration);
      oscillator.connect(gain).connect(this.master); oscillator.start(t); oscillator.stop(t + preset.duration + .05);
      this.oscillators.push(oscillator);
    }
  }
  stop(): void {
    this.playback++; this.castKey = null; this.castCue = null; this.castStep = 0; this.launched = false;
    this.endsAt = null; this.playbackFade = 1;
    this.queuedFuga = null; this.voice = null; this.cueStep = 0;
    this.gojoSequence.stop();
    const stop = (audio: HTMLAudioElement) => {
      audio.onended = null; audio.onerror = null; audio.pause();
      try { audio.currentTime = 0; } catch { /* Not decoded yet. */ }
    };
    this.files.forEach(({ audio }) => stop(audio)); this.bundled.forEach(stop);
    this.oscillators.forEach(oscillator => { try { oscillator.stop(); } catch { /* Already stopped. */ } });
    this.oscillators = [];
  }
  dispose(): void {
    this.disposed = true;
    this.stop(); this.files.forEach(file => URL.revokeObjectURL(file.url)); this.files.clear();
    this.gojoSequence.dispose();
    this.bundled.clear(); this.master?.disconnect();
    void this.context?.close().catch(() => {});
  }
}
