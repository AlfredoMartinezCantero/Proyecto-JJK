import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { SoundEngine } from '../src/audio/SoundEngine';
import { TECHNIQUE_AUDIO } from '../src/audio/techniqueAudio';
import { mirroredHandPan } from '../src/audio/GojoSequenceAudio';
import type { CastingAudioFrame } from '../src/audio/castingAudio';
import { TECHNIQUES } from '../src/core/techniques';
import type { TechniqueKey } from '../src/core/types';
import { HOLLOW_PURPLE_FADE_MS, HOLLOW_PURPLE_RELEASE_MS, incantationTailMs } from '../src/audio/hollowPurpleAudio';

class FakeAudio {
  static instances: FakeAudio[] = [];
  volume = 1; currentTime = 0; preload = ''; onended: (() => void) | null = null; onerror: (() => void) | null = null;
  paused = true;
  duration = 19.509; onloadedmetadata: (() => void) | null = null; load = vi.fn();
  play = vi.fn(() => { this.paused = false; return Promise.resolve(); }); pause = vi.fn(() => { this.paused = true; });
  constructor(public src: string) {
    this.duration = src.endsWith('fuga1.m4a') ? 6.739 : src.endsWith('fuga2.m4a') ? 5.71 : 19.509;
    FakeAudio.instances.push(this);
  }
}
const parameter = () => ({ value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn() });
let oscillators: { stop: ReturnType<typeof vi.fn> }[];
let mediaRoutes: { audio: HTMLMediaElement; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[];
class FakeContext {
  state = 'running'; currentTime = 0; destination = {};
  resume = vi.fn(() => Promise.resolve()); close = vi.fn(() => Promise.resolve());
  createGain() { const node = { gain: parameter(), connect: vi.fn(), disconnect: vi.fn() }; node.connect.mockReturnValue(node); return node; }
  createStereoPanner() { return { pan: parameter(), connect: vi.fn(), disconnect: vi.fn() }; }
  createMediaElementSource(audio: HTMLMediaElement) {
    const source = { audio, connect: vi.fn(), disconnect: vi.fn() }; mediaRoutes.push(source); return source;
  }
  createOscillator() {
    const node = { frequency: parameter(), type: '', connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
    node.connect.mockImplementation(target => target); oscillators.push(node); return node;
  }
}
let engine: SoundEngine;
beforeEach(() => {
  FakeAudio.instances = []; oscillators = []; mediaRoutes = [];
  vi.stubGlobal('Audio', FakeAudio); vi.stubGlobal('AudioContext', FakeContext);
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:session-audio'); vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  engine = new SoundEngine();
});

function casting(key: TechniqueKey, step = 0, patch: Partial<CastingAudioFrame> = {}): CastingAudioFrame {
  const config = TECHNIQUES[key].steps[step];
  return { step, pose: config.pose, holdMs: config.holdMs, valid: true, holding: true, progress: .25, bluePan: .6, redPan: -.6, ...patch };
}
const pannerFor = (suffix: string) => mediaRoutes.find(r => r.audio.src.endsWith(suffix))!.connect.mock.calls[0][0] as { pan: ReturnType<typeof parameter> };

describe('audio during casting, before recovery/attack', () => {
  it.each(['dismantle', 'cleave', 'flame', 'shrine'] as const)('%s keeps the casting voice and closes it with the visible effect, without a stale callback restart', key => {
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    const step = key === 'flame' ? 1 : 0;
    engine.updateCasting(.4, key, casting(key, step));
    const audio = FakeAudio.instances[0];
    audio.currentTime = .6; const oldEnd = audio.onended;
    engine.play(.4, key); expect(audio.currentTime).toBe(.6); expect(audio.play).toHaveBeenCalledOnce();
    const end = 1000 + TECHNIQUES[key].effectMs;
    engine.updatePlayback(end - HOLLOW_PURPLE_FADE_MS / 2); expect(audio.volume).toBeCloseTo(.2);
    engine.updatePlayback(end); expect(audio.paused).toBe(true);
    oldEnd?.(); expect(audio.play).toHaveBeenCalledOnce();
  });
  it('a stalled Fuga preparation does not wait for the full duration before recovering into its second clip', () => {
    const clock = vi.spyOn(performance, 'now').mockReturnValue(1000);
    engine.prepare('flame');
    engine.updateCasting(.4, 'flame', casting('flame'));
    engine.updateCasting(.4, 'flame', casting('flame', 1)); engine.prepareRelease(.4, 'flame');
    const first = FakeAudio.instances.find(a => a.src.endsWith('fuga1.m4a'))!, second = FakeAudio.instances.find(a => a.src.endsWith('fuga2.m4a'))!;
    clock.mockReturnValue(4000); engine.updatePlayback(4000);
    expect(first.paused).toBe(true); expect(second.play).toHaveBeenCalledOnce();
    second.currentTime = 2; expect(engine.releaseWaitMs('flame', 4000)).toBe(0);
  });
  it('a long custom Sukuna voice uses gesture release and still ends with its effect', () => {
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    engine.setFile(new File(['test'], 'custom.m4a'), 'flame');
    const audio = FakeAudio.instances[0]; audio.duration = 180;
    engine.updateCasting(.4, 'flame', casting('flame')); engine.prepareRelease(.4, 'flame');
    expect(engine.releaseWaitMs('flame', 1000)).toBe(0);
    engine.play(.4, 'flame'); engine.updatePlayback(1000 + TECHNIQUES.flame.effectMs);
    expect(audio.paused).toBe(true); expect(audio.play).toHaveBeenCalledOnce();
  });
  it.each(['blue', 'red', 'domain', 'dismantle', 'cleave', 'shrine'] as const)('%s starts during stable holding and keeps its current time on launch', key => {
    engine.prepare(key); const audio = FakeAudio.instances[0];
    engine.updateCasting(.4, key, casting(key, 0, { progress: 0 })); expect(audio.play).not.toHaveBeenCalled();
    engine.updateCasting(.4, key, casting(key)); expect(audio.play).toHaveBeenCalledOnce();
    audio.currentTime = .6; engine.updateCasting(.4, key, casting(key)); engine.play(.4, key);
    expect(audio.play).toHaveBeenCalledOnce(); expect(audio.currentTime).toBe(.6);
    engine.stopPreparation(); expect(audio.paused).toBe(false);
  });
  it('Fuga starts its first clip during charging and its second during the release hold, before firing', () => {
    engine.prepare('flame'); engine.updateCasting(.4, 'flame', casting('flame'));
    const first = FakeAudio.instances.find(a => a.src.endsWith('fuga1.m4a'))!, second = FakeAudio.instances.find(a => a.src.endsWith('fuga2.m4a'))!;
    expect(first.play).toHaveBeenCalledOnce(); expect(second.play).not.toHaveBeenCalled();
    engine.updateCasting(.4, 'flame', casting('flame', 1));
    expect(first.paused).toBe(false); expect(second.play).not.toHaveBeenCalled();
    first.currentTime = first.duration; engine.updatePlayback(performance.now());
    expect(first.paused).toBe(true); expect(second.play).toHaveBeenCalledOnce();
    second.currentTime = .5; engine.play(.4, 'flame');
    expect(second.play).toHaveBeenCalledOnce(); expect(second.currentTime).toBe(.5);
  });
  it('missing/invalid poses are silent, a cancelled cast can restart, and mute never starts a clip', () => {
    engine.prepare('red'); const audio = FakeAudio.instances[0];
    engine.updateCasting(.4, 'red', casting('red', 0, { valid: false, holding: false, progress: 0 })); expect(audio.play).not.toHaveBeenCalled();
    engine.updateCasting(.4, 'red', casting('red')); expect(audio.paused).toBe(false);
    engine.stopPreparation(); expect(audio.paused).toBe(true);
    engine.updateCasting(0, 'red', casting('red')); expect(audio.play).toHaveBeenCalledOnce();
    engine.stop(); engine.updateCasting(.4, 'red', casting('red')); expect(audio.play).toHaveBeenCalledTimes(2);
  });
  it('a failed domain clip falls back during holding and does not repeat its tone on launch', async () => {
    engine.unlock(); engine.prepare('domain'); FakeAudio.instances[0].play.mockRejectedValue(new Error('Unsupported codec'));
    engine.updateCasting(.3, 'domain', casting('domain')); await Promise.resolve(); await Promise.resolve();
    expect(oscillators).toHaveLength(3);
    engine.play(.3, 'domain'); expect(oscillators).toHaveLength(3);
  });
});

describe('ordered Gojo preparation voices', () => {
  it('fusion preserves the recording and its existing invocation timing', () => {
    const key = 'fusion';
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    engine.prepareRelease(.4, key);
    const hollow = FakeAudio.instances.find(a => a.src.includes('hollow'))!;
    expect(hollow.currentTime).toBe(0); expect(hollow.play).toHaveBeenCalledOnce();
    expect(engine.releaseWaitMs(key, 1000)).toBeGreaterThan(14000);
    hollow.currentTime = hollow.duration - incantationTailMs(key) / 1000;
    expect(engine.releaseWaitMs(key, 1000)).toBeCloseTo(0);
    const position = hollow.currentTime; engine.play(.4, key);
    expect(hollow.currentTime).toBe(position); expect(hollow.play).toHaveBeenCalledOnce();
    const end = 1000 + TECHNIQUES[key].effectMs;
    engine.updatePlayback(end - HOLLOW_PURPLE_FADE_MS / 2); expect(hollow.volume).toBeCloseTo(.2);
    engine.updatePlayback(end); expect(hollow.paused).toBe(true);
  });
  it('Purple releases at the spoken 00:03 cue after the final gesture, then fades with the attack', () => {
    const clock = vi.spyOn(performance, 'now').mockReturnValue(1000);
    engine.updateCasting(.4, 'purple', casting('purple', 2));
    const hollow = FakeAudio.instances.find(a => a.src.includes('hollow'))!;
    hollow.currentTime = 1.8;
    engine.updateCasting(.4, 'purple', casting('purple', 3));
    engine.prepareRelease(.4, 'purple');
    expect(engine.releaseWaitMs('purple', 1000)).toBeCloseTo(1200);
    hollow.currentTime = 2.999; expect(engine.releaseWaitMs('purple', 1000)).toBeCloseTo(1);
    hollow.currentTime = HOLLOW_PURPLE_RELEASE_MS / 1000;
    engine.updatePlayback(2200); expect(hollow.paused).toBe(false);
    expect(engine.releaseWaitMs('purple', 2200)).toBe(0);
    clock.mockReturnValue(2200);
    engine.play(.4, 'purple');
    expect(hollow.currentTime).toBe(3); expect(hollow.play).toHaveBeenCalledOnce();
    const end = 2200 + TECHNIQUES.purple.effectMs;
    engine.updatePlayback(end - HOLLOW_PURPLE_FADE_MS - 1); expect(hollow.paused).toBe(false); expect(hollow.volume).toBe(.4);
    engine.updatePlayback(end - HOLLOW_PURPLE_FADE_MS / 2); expect(hollow.volume).toBeCloseTo(.2);
    engine.updatePlayback(end); expect(hollow.paused).toBe(true);
  });
  it('Purple uses the spoken cue without duration metadata and never waits for a long custom recording', () => {
    engine.prepareRelease(.4, 'purple');
    const hollow = FakeAudio.instances.find(a => a.src.includes('hollow'))!;
    hollow.duration = NaN;
    hollow.currentTime = 3;
    expect(engine.releaseWaitMs('purple', performance.now())).toBe(0);
    engine.setFile(new File(['test'], 'long-custom.m4a'), 'purple');
    engine.prepareRelease(.4, 'purple');
    FakeAudio.instances.at(-1)!.duration = 180;
    expect(engine.releaseWaitMs('purple', performance.now())).toBe(0);
  });
  it('holds the spoken cue for a slower final pose and resumes there once, without replaying the introduction', () => {
    const clock = vi.spyOn(performance, 'now').mockReturnValue(1000);
    engine.updateCasting(.4, 'purple', casting('purple', 2));
    const hollow = FakeAudio.instances.find(a => a.src.includes('hollow'))!;
    hollow.currentTime = 3.025; engine.updatePlayback(4025);
    expect(hollow.paused).toBe(true); expect(hollow.currentTime).toBe(3);
    engine.updatePlayback(20000); expect(hollow.play).toHaveBeenCalledOnce();
    engine.prepareRelease(.4, 'purple'); expect(engine.releaseWaitMs('purple', 20000)).toBe(0);
    clock.mockReturnValue(20000);
    engine.play(.4, 'purple'); expect(hollow.paused).toBe(false); expect(hollow.currentTime).toBe(3);
    expect(hollow.play).toHaveBeenCalledTimes(2);
    hollow.currentTime = 3.6; engine.updatePlayback(20100);
    expect(hollow.currentTime).toBe(3.6); expect(hollow.paused).toBe(false);
  });
  it('cancels a held Purple cue and cannot revive its old failure on a new preparation', () => {
    engine.unlock(); engine.updateCasting(.4, 'purple', casting('purple', 2));
    const hollow = FakeAudio.instances.find(a => a.src.includes('hollow'))!, oldFailure = hollow.onerror;
    hollow.currentTime = 3; engine.updatePlayback(performance.now()); expect(hollow.paused).toBe(true);
    engine.stopPreparation(); oldFailure?.(); engine.updatePlayback(performance.now() + 10000);
    expect(hollow.paused).toBe(true); expect(hollow.currentTime).toBe(0); expect(oscillators).toHaveLength(0);
    engine.updateCasting(.4, 'purple', casting('purple')); expect(FakeAudio.instances.find(a => a.src.includes('azul'))!.paused).toBe(false);
    expect(hollow.play).toHaveBeenCalledOnce();
  });
  it('a muted or stalled Purple recording cannot trap a validated gesture before the spoken cue', () => {
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    engine.prepareRelease(0, 'purple'); expect(engine.releaseWaitMs('purple', 1000)).toBe(0);
    engine.stop(); engine.prepareRelease(.4, 'purple');
    const hollow = FakeAudio.instances.find(a => a.src.includes('hollow'))!;
    expect(engine.releaseWaitMs('purple', 1000)).toBe(3000);
    expect(engine.releaseWaitMs('purple', 4000)).toBe(0); expect(hollow.paused).toBe(true);
  });
  it('Fuga waits for all of the first clip, then the spoken part of the second, without overlapping or cropping', () => {
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    engine.prepare('flame');
    engine.updateCasting(.4, 'flame', casting('flame'));
    const first = FakeAudio.instances.find(a => a.src.endsWith('fuga1.m4a'))!;
    engine.updateCasting(.4, 'flame', casting('flame', 1, { valid: false, holding: false, progress: 0 }));
    expect(first.paused).toBe(false);
    engine.prepareRelease(.4, 'flame');
    const second = FakeAudio.instances.find(a => a.src.endsWith('fuga2.m4a'))!;
    expect(second.play).not.toHaveBeenCalled(); expect(engine.releaseWaitMs('flame', 1000)).toBeGreaterThan(6000);
    first.currentTime = first.duration; engine.updatePlayback(1000);
    expect(second.play).toHaveBeenCalledOnce(); expect(second.currentTime).toBe(0); expect(first.paused).toBe(true);
    expect(engine.releaseWaitMs('flame', 1000)).toBeGreaterThan(1000);
    second.currentTime = 2; expect(engine.releaseWaitMs('flame', 1000)).toBe(0);
    engine.play(.4, 'flame'); expect(second.currentTime).toBe(2); expect(second.play).toHaveBeenCalledOnce();
  });
  it('mute and failed/stalled recordings never trap the user in an invocation', () => {
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    engine.prepareRelease(0, 'fusion'); expect(engine.releaseWaitMs('fusion', 1000)).toBe(0);
    engine.stop(); engine.prepareRelease(.4, 'fusion');
    const hollow = FakeAudio.instances.find(a => a.src.includes('hollow'))!;
    hollow.duration = NaN; expect(engine.releaseWaitMs('fusion', 1000)).toBeNull();
    expect(engine.releaseWaitMs('fusion', 5000)).toBe(0); expect(hollow.paused).toBe(true);
  });
  it('also bounds a long custom purple audio and leaves no stale deadline after stopping', () => {
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    engine.setFile(new File(['test'], 'custom.m4a'), 'purple'); engine.play(.4, 'purple'); const custom = FakeAudio.instances[0];
    engine.updatePlayback(1000 + TECHNIQUES.purple.effectMs); expect(custom.paused).toBe(true);
    engine.play(.4, 'domain'); const domain = FakeAudio.instances.find(a => a.src.includes('gojo-domain'))!;
    engine.updatePlayback(90000); expect(domain.paused).toBe(false);
  });
  it('reflects each role position once', () => {
    expect(mirroredHandPan(.2)).toBeGreaterThan(0); expect(mirroredHandPan(.8)).toBeLessThan(0);
    expect(mirroredHandPan(.5)).toBe(0); expect(mirroredHandPan(NaN)).toBe(0);
  });
  it.each(['purple', 'fusion'] as const)('%s plays Azul, then Rojo, then Hollow Purple without simultaneous voices or restart on launch', key => {
    engine.unlock(); engine.prepare(key);
    const blue = FakeAudio.instances.find(a => a.src.includes('azul'))!, red = FakeAudio.instances.find(a => a.src.includes('rojo'))!, hollow = FakeAudio.instances.find(a => a.src.includes('hollow'))!;
    engine.updateCasting(.4, key, casting(key, 0, { progress: 0 })); expect(blue.play).not.toHaveBeenCalled();
    engine.updateCasting(.4, key, casting(key));
    expect(blue.paused).toBe(false); expect(red.play).not.toHaveBeenCalled(); expect(hollow.play).not.toHaveBeenCalled();
    expect(pannerFor('gojo-azul.m4a').pan.setTargetAtTime).toHaveBeenLastCalledWith(.6, 0, .025);
    engine.updateCasting(.4, key, casting(key, 0, { bluePan: .3 })); expect(blue.play).toHaveBeenCalledOnce();
    expect(pannerFor('gojo-azul.m4a').pan.setTargetAtTime).toHaveBeenLastCalledWith(.3, 0, .025);
    engine.updateCasting(.4, key, casting(key, 1));
    expect(blue.paused).toBe(true); expect(red.paused).toBe(false); expect(hollow.play).not.toHaveBeenCalled();
    expect(pannerFor('gojo-rojo.m4a').pan.setTargetAtTime).toHaveBeenLastCalledWith(-.6, 0, .025);
    engine.updateCasting(.4, key, casting(key, 2, { valid: false, progress: 0, holding: false }));
    expect(hollow.play).not.toHaveBeenCalled();
    engine.updateCasting(.4, key, casting(key, 2)); expect(red.paused).toBe(true); expect(hollow.paused).toBe(false);
    expect(FakeAudio.instances.filter(a => !a.paused)).toHaveLength(1);
    hollow.currentTime = 1.5; engine.play(.4, key); expect(hollow.play).toHaveBeenCalledOnce(); expect(hollow.currentTime).toBe(1.5);
    engine.stopPreparation(); expect(hollow.paused).toBe(false);
    engine.stop(); expect(hollow.paused).toBe(true); expect(hollow.currentTime).toBe(0);
  });
  it('a sequence restart stops the old narration and a stale failure cannot revive it', async () => {
    engine.unlock(); engine.prepare('purple'); const hollow = FakeAudio.instances.find(a => a.src.includes('hollow'))!;
    let reject!: (error: Error) => void; hollow.play.mockImplementation(() => new Promise((_resolve, r) => { reject = r; }));
    engine.updateCasting(.3, 'purple', casting('purple', 2)); const fail = hollow.onerror;
    engine.updateCasting(.3, 'purple', casting('purple', 0, { valid: false, progress: 0, holding: false }));
    reject(new Error('Aborted')); fail?.(); await Promise.resolve(); await Promise.resolve(); expect(oscillators).toHaveLength(0);
    engine.updateCasting(.3, 'purple', casting('purple')); expect(FakeAudio.instances.find(a => a.src.includes('azul'))!.paused).toBe(false);
  });
  it('a session upload replaces a technique once at cast start and survives its later phases', () => {
    engine.setFile(new File(['test'], 'custom.m4a'), 'purple'); engine.updateCasting(.3, 'purple', casting('purple'));
    const custom = FakeAudio.instances[0]; expect(custom.play).toHaveBeenCalledOnce(); custom.currentTime = .6;
    engine.updateCasting(.3, 'purple', casting('purple', 1)); engine.updateCasting(.3, 'purple', casting('purple', 2)); engine.play(.3, 'purple');
    expect(custom.play).toHaveBeenCalledOnce(); expect(custom.currentTime).toBe(.6); expect(FakeAudio.instances).toHaveLength(1);
  });
});
afterEach(() => { engine.dispose(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('bundled user audio and playback lifecycle (media API adapters, without listening)', () => {
  it.each(['blue', 'red'] as const)('uses the supplied Gojo %s clip for the standalone technique', key => {
    engine.prepare(key); expect(FakeAudio.instances[0].play).not.toHaveBeenCalled();
    engine.play(.5, key); expect(FakeAudio.instances[0].src).toBe(TECHNIQUE_AUDIO[key]!.activation[0]);
    expect(FakeAudio.instances[0].play).toHaveBeenCalledOnce();
  });
  it.each(['dismantle', 'cleave', 'shrine'] as const)('preloads %s without playing and restarts its included clip on each cast', key => {
    engine.prepare(key); engine.prepare(key);
    expect(FakeAudio.instances).toHaveLength(1);
    const audio = FakeAudio.instances[0]; expect(audio.play).not.toHaveBeenCalled(); expect(audio.preload).toBe('auto');
    engine.play(.45, key); expect(audio.src).toBe(TECHNIQUE_AUDIO[key]!.activation[0]); expect(audio.volume).toBe(.45);
    audio.currentTime = 2; engine.play(.2, key); expect(audio.currentTime).toBe(0); expect(audio.play).toHaveBeenCalledTimes(2);
  });
  it('applies volume changes and mute to a clip already playing', () => {
    engine.play(.6, 'shrine'); const audio = FakeAudio.instances[0];
    engine.setVolume(.15); expect(audio.volume).toBe(.15);
    engine.setVolume(0); expect(audio.volume).toBe(0);
    engine.play(0, 'cleave'); expect(FakeAudio.instances).toHaveLength(1);
    engine.setVolume(NaN); expect(audio.volume).toBe(0);
  });
  it('a session upload takes priority over the built-in clip and releases replaced URLs', () => {
    engine.prepare('cleave'); const included = FakeAudio.instances[0];
    engine.setFile(new File(['test'], 'custom.mp3'), 'cleave'); engine.play(.3, 'cleave');
    expect(included.play).not.toHaveBeenCalled(); expect(FakeAudio.instances[1].play).toHaveBeenCalledOnce();
    engine.setFile(new File(['new'], 'replacement.mp3'), 'cleave'); expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:session-audio');
  });
  it('never revives a paused clip or fallback from an old pending play promise', async () => {
    engine.unlock(); engine.prepare('shrine'); const audio = FakeAudio.instances[0];
    let reject!: (error: Error) => void;
    audio.play.mockImplementation(() => new Promise((_resolve, r) => { reject = r; }));
    engine.play(.3, 'shrine'); const staleError = audio.onerror;
    engine.stop(); reject(new Error('Interrupted')); staleError?.(); await Promise.resolve(); await Promise.resolve();
    expect(oscillators).toHaveLength(0); expect(audio.currentTime).toBe(0); expect(audio.onended).toBeNull();
  });
  it('falls back once to a synthesized tone when a current clip cannot play', async () => {
    engine.unlock(); engine.prepare('cleave'); const audio = FakeAudio.instances[0];
    audio.play.mockRejectedValue(new Error('Unsupported codec'));
    engine.play(.4, 'cleave'); const error = audio.onerror; error?.(); await Promise.resolve(); await Promise.resolve();
    expect(oscillators).toHaveLength(2);
    engine.stop(); expect(oscillators.every(o => o.stop.mock.calls.length === 2)).toBe(true);
  });
  it('does not pause a new cast that reuses an element when the older play promise resolves', async () => {
    engine.prepare('cleave'); const audio = FakeAudio.instances[0];
    let resolve!: () => void; audio.play.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    engine.play(.3, 'cleave'); engine.stop(); engine.play(.3, 'cleave'); const pauses = audio.pause.mock.calls.length;
    resolve(); await Promise.resolve(); expect(audio.pause).toHaveBeenCalledTimes(pauses);
  });
  it('ships real MP3/M4A files, rather than placeholder URLs', () => {
    for (const file of ['dismantle.mp3', 'cleave.mp3', 'santuario.m4a', 'fuga1.m4a', 'fuga2.m4a']) {
      const b = readFileSync(new URL(`../public/audio/sukuna/${file}`, import.meta.url)); expect(b.length).toBeGreaterThan(10000);
      if (file.endsWith('.m4a')) expect(b.toString('ascii', 4, 8)).toBe('ftyp');
      else expect(b.toString('ascii', 0, 3)).toBe('ID3');
    }
    for (const file of ['gojo-azul.m4a', 'gojo-rojo.m4a', 'gojo-hollow-purple.m4a']) {
      const b = readFileSync(new URL(`../public/audio/gojo/${file}`, import.meta.url));
      expect(b.length).toBeGreaterThan(10000); expect(b.toString('ascii', 4, 8)).toBe('ftyp');
    }
    const domain = readFileSync(new URL('../public/audio/gojo/gojo-domain.mp3', import.meta.url));
    expect(domain.length).toBeGreaterThan(10000); expect(domain.toString('ascii', 0, 3)).toBe('ID3');
  });
});
