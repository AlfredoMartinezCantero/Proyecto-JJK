import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HandFrame, TechniqueKey, TrackedHand } from '../src/core/types';
import { TECHNIQUES } from '../src/core/techniques';
import { handFrame, mergedHands, splitHands, trackedPose, shadowPair } from './fixtures';
import type { ShadowPose } from '../src/core/shadowConfig';
import type { CastingAudioFrame } from '../src/audio/castingAudio';

const harness = vi.hoisted(() => ({
  frame: null as ((frame: HandFrame) => void) | null,
  tick: null as ((now: number) => void) | null,
  status: null as ((status: { ready: boolean; message: string; backend: string; error?: string }) => void) | null,
  autoReady: true, starts: 0, stops: 0, resumes: 0, pauses: 0,
  pageHide: null as (() => void) | null,
  activations: [] as boolean[], targetPreviews: [] as boolean[], sounds: [] as TechniqueKey[],
  stoppedPreparations: 0,
  castingFrames: [] as { key: TechniqueKey; frame: CastingAudioFrame }[],
  audioTicks: [] as number[],
  releaseWait: 0,
}));

vi.mock('../src/tracking/HandTracker', () => ({ HandTracker: class {
  constructor(_video: unknown, frame: typeof harness.frame, status: typeof harness.status) { harness.frame = frame; harness.status = status; }
  start() { harness.starts++; harness.status?.(harness.autoReady
    ? { ready: true, message: 'Synthetic tracker ready', backend: 'TEST' }
    : { ready: false, message: 'Waiting for permission or local model', backend: '' }); }
  pause() { harness.pauses++; } resume() { harness.resumes++; } stop() { harness.stops++; }
} }));
vi.mock('../src/scene/TrainingScene', () => ({ TrainingScene: class {
  constructor(_host: unknown, _settings: unknown, tick: typeof harness.tick) { harness.tick = tick; }
  setSettings() {} setTechnique() {} setCurse() {} setHands() {} setCharge() {} freezeCasting() {} clear() {} respawnCurse() {} dispose() {}
  activate(debug: boolean, targetPreview = false) { harness.activations.push(debug); harness.targetPreviews.push(targetPreview); }
} }));
vi.mock('../src/audio/SoundEngine', () => ({ SoundEngine: class {
  unlock() {} stop() {} dispose() {} setFile() {} setVolume() {} prepare() {}
  updatePlayback(now: number) { harness.audioTicks.push(now); }
  prepareRelease() {} releaseWaitMs() { return harness.releaseWait; }
  stopPreparation() { harness.stoppedPreparations++; }
  updateCasting(_volume: number, key: TechniqueKey, frame: CastingAudioFrame) { harness.castingFrames.push({ key, frame }); }
  play(_volume: number, key: TechniqueKey) { harness.sounds.push(key); }
} }));

import { labStore } from '../src/app/state';
import { LabController } from '../src/app/LabController';
const initial = labStore.get();
let controller: LabController;
let now = 0;

beforeEach(() => {
  vi.stubGlobal('document', { hidden: false, addEventListener() {}, removeEventListener() {} });
  vi.stubGlobal('window', { addEventListener(type: string, handler: () => void) { if (type === 'pagehide') harness.pageHide = handler; }, removeEventListener() {} });
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
  now = 0; vi.spyOn(performance, 'now').mockImplementation(() => now);
  harness.activations = []; harness.targetPreviews = []; harness.sounds = []; harness.stoppedPreparations = 0;
  harness.castingFrames = [];
  harness.audioTicks = [];
  harness.releaseWait = 0;
  harness.autoReady = true; harness.starts = 0; harness.stops = 0; harness.resumes = 0; harness.pauses = 0;
  labStore.set({ ...initial, technique: 'blue', completedTechniques: [], tutorialComplete: false,
    stage: 'menu', ready: false, hits: 0, debug: false, debugEffect: false });
  controller = new LabController({} as HTMLElement, {} as HTMLVideoElement,
    { getContext: () => ({ clearRect() {} }) } as unknown as HTMLCanvasElement);
});
afterEach(() => { controller.dispose(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function start(key: TechniqueKey) {
  controller.selectTechnique(key); controller.enter('tutorial'); controller.connect(); controller.begin();
  now += 3000; harness.tick!(now); expect(labStore.get().stage).toBe('practice');
}
function hold(hands: TrackedHand[], milliseconds: number) {
  for (let i = 0; i <= milliseconds / 50; i++) { now += 50; harness.frame!(handFrame(now, hands)); }
}

describe('session integration with synthetic camera and rendering adapters', () => {
  for(const key of ['totality','toad','max-elephant','rabbit-escape','mahoraga','chimera-garden'] as const)it(`routes the full ${key} gesture through score, sound, result and manual respawn`,()=>{
    labStore.set({completedTechniques:['blue','nue']});start(key);
    for(const step of TECHNIQUES[key].steps)hold(shadowPair(step.pose as ShadowPose),step.holdMs);
    expect(harness.activations).toEqual([false]);expect(harness.sounds).toEqual([key]);expect(labStore.get().hits).toBe(1);expect(labStore.get().awaitingRespawn).toBe(true);
    now+=TECHNIQUES[key].effectMs+100;harness.tick!(now);expect(labStore.get().respawnReady).toBe(true);expect(labStore.get().awaitingRespawn).toBe(true);
    expect(labStore.get().completedTechniques.includes(key)).toBe(TECHNIQUES[key].tutorialGoal===1);
    controller.respawnCurse();expect(labStore.get().awaitingRespawn).toBe(false);expect(labStore.get().stage).toBe(TECHNIQUES[key].tutorialGoal===1?'complete':'practice');
    expect(labStore.get().completedTechniques).toContain('blue');expect(labStore.get().completedTechniques).toContain('nue');
  });
  for (const key of ['divine-dogs','nue'] as const) it(`routes Megumi ${key} from two real gesture observations to scoring, audio and manual respawn`, () => {
    labStore.set({completedTechniques:['blue','black-flash']});controller.selectCharacter('megumi');
    expect(labStore.get().technique).toBe('divine-dogs');expect(labStore.get().tutorialComplete).toBe(false);start(key);
    const pair=[trackedPose(key==='nue'?'open':'wolf',.435,1),trackedPose(key==='nue'?'open':'wolf',.565,2)];
    hold(pair,TECHNIQUES[key].steps[0].holdMs);
    if(key==='nue') {expect(harness.activations).toHaveLength(0);hold([trackedPose('open',.27,1),trackedPose('open',.73,2)],1000);}
    expect(harness.activations).toEqual([false]);expect(harness.sounds).toEqual([key]);expect(labStore.get().hits).toBe(1);
    expect(labStore.get().awaitingRespawn).toBe(true);now+=TECHNIQUES[key].effectMs+100;harness.tick!(now);
    expect(labStore.get().respawnReady).toBe(true);expect(labStore.get().completedTechniques).toEqual(['blue','black-flash']);
    controller.respawnCurse();expect(labStore.get().awaitingRespawn).toBe(false);expect(labStore.get().stage).toBe('practice');
  });
  for (const key of ['divergent','black-flash'] as const) it(`routes Yuji ${key} from fist motion to audio, score and manual respawn`, () => {
    labStore.set({completedTechniques:['blue']}); controller.selectCharacter('yuji');
    expect(labStore.get().technique).toBe('divergent'); expect(labStore.get().tutorialComplete).toBe(false);
    start(key); hold([trackedPose('fist',.4)],TECHNIQUES[key].steps[0].holdMs);
    expect(labStore.get().stepIndex).toBe(1); expect(harness.activations).toHaveLength(0);
    for (let i = 1; i <= 5; i++) hold([trackedPose('fist',.4+i*.016)],0);
    hold([trackedPose('fist',.48)],800);
    expect(harness.activations).toEqual([false]); expect(harness.sounds).toEqual([key]); expect(labStore.get().hits).toBe(1);
    expect(labStore.get().awaitingRespawn).toBe(true); expect(labStore.get().completedTechniques).toEqual(['blue']);
    now += TECHNIQUES[key].effectMs+100; harness.tick!(now);
    expect(labStore.get().awaitingRespawn).toBe(true); expect(labStore.get().respawnReady).toBe(true);
    controller.respawnCurse(); expect(labStore.get().awaitingRespawn).toBe(false);
    expect(labStore.get().stage).toBe('practice'); expect(labStore.get().completedTechniques).toEqual(['blue']);
  });
  it('finishes the gestures once, waits for the voice without requiring hands, and starts recovery only on delivery', () => {
    start('fusion'); harness.releaseWait = 15000;
    hold([splitHands()[0]], 3200); hold(splitHands(), 2800); hold(mergedHands(), 900);
    expect(labStore.get().incanting).toBe(true); expect(labStore.get().hits).toBe(0); expect(harness.activations).toEqual([]);
    now += 20000; harness.tick!(now); harness.frame!(handFrame(now + 1, []));
    expect(labStore.get().incanting).toBe(true); expect(labStore.get().awaitingRespawn).toBe(false);
    harness.releaseWait = 0; now += 50; harness.tick!(now);
    expect(labStore.get().incanting).toBe(false); expect(labStore.get().hits).toBe(1); expect(harness.activations).toEqual([false]);
    hold([trackedPose('open', .27, 1), trackedPose('open', .73, 2)], 100);
    expect(labStore.get().phase).toBe('cooldown'); expect(labStore.get().cooldown).toBeGreaterThan(TECHNIQUES.fusion.timing.cooldownMs - 300);
    expect(labStore.get().respawnReady).toBe(false);
  });
  it('cancels a queued invocation on pause and never delivers it later or awards a debug preview', () => {
    controller.selectTechnique('fusion'); labStore.set({ debug: true }); harness.releaseWait = 15000;
    controller.testEffect(true); expect(labStore.get().incanting).toBe(true);
    expect(labStore.get().hits).toBe(0); expect(harness.activations).toEqual([]);
    controller.pause(); harness.releaseWait = 0; now += 20000; harness.tick!(now);
    expect(labStore.get().incanting).toBe(false); expect(harness.activations).toEqual([]); expect(labStore.get().hits).toBe(0);
    expect(labStore.get().debugEffect).toBe(false);
  });
  it('updates the audio presentation clock outside practice so previews also stop at their deadline', () => {
    controller.selectTechnique('purple'); labStore.set({ debug: true }); controller.testEffect();
    now = TECHNIQUES.purple.effectMs; harness.tick!(now);
    expect(harness.audioTicks.at(-1)).toBe(TECHNIQUES.purple.effectMs);
    expect(labStore.get().stage).toBe('menu'); expect(labStore.get().hits).toBe(0);
  });
  it('delivers Purple at its short spoken cue after a validated final pose and starts respawn from that release', () => {
    start('purple'); harness.releaseWait = 1200;
    hold([splitHands()[0]], 3200); hold(splitHands(), 2800); hold(mergedHands(), 900);
    expect(harness.activations).toEqual([]); expect(labStore.get().hits).toBe(0);
    hold([trackedPose('purple', .435, 1)], 1000);
    expect(labStore.get().incanting).toBe(true); expect(labStore.get().hits).toBe(0);
    expect(harness.activations).toEqual([]); expect(labStore.get().awaitingRespawn).toBe(false);
    harness.frame!(handFrame(now + 1, [])); harness.releaseWait = 0;
    now += 1200; harness.tick!(now);
    expect(labStore.get().incanting).toBe(false); expect(harness.activations).toEqual([false]);
    expect(harness.sounds).toEqual(['purple']); expect(labStore.get().hits).toBe(1);
    expect(labStore.get().awaitingRespawn).toBe(true); expect(labStore.get().respawnReady).toBe(false);
    now += TECHNIQUES.purple.effectMs + 1; harness.tick!(now);
    expect(labStore.get().respawnReady).toBe(true); expect(harness.activations).toEqual([false]);
  });
  it('keeps the completed Azul step visible while waiting for Rojo instead of looping its charge', () => {
    start('purple'); const blue = [splitHands()[0]];
    hold(blue, 3200); expect(labStore.get().stepIndex).toBe(1);
    hold(blue, 2000); harness.tick!(now);
    expect(labStore.get().stepIndex).toBe(1); expect(labStore.get().hits).toBe(0);
    expect(labStore.get().hint).toContain('Azul preparado');
    hold(splitHands(), 2800); expect(labStore.get().stepIndex).toBe(2);
    hold(mergedHands(), 900); hold([trackedPose('purple', .435, 1)], 1000);
    expect(labStore.get().hits).toBe(1); expect(harness.activations).toEqual([false]);
  });
  it('routes the Azul/Rojo hand positions by stable roles, including reversed detection order, before the purple launch', () => {
    start('purple'); hold([splitHands()[0]], 3200);
    const first = harness.castingFrames.find(f => f.frame.step === 0 && f.frame.progress > .2)!.frame;
    expect(first.bluePan).toBeGreaterThan(0); expect(first.redPan).toBeNull();
    hold(splitHands().reverse(), 200);
    const swappedSides = [trackedPose('blue', .73, 1), trackedPose('red', .27, 2)]; hold(swappedSides, 100);
    const moved = harness.castingFrames.at(-1)!.frame;
    expect(moved.bluePan).toBeLessThan(0); expect(moved.redPan).toBeGreaterThan(0);
    hold(splitHands().reverse(), 2800); hold(mergedHands().reverse(), 900);
    expect(harness.castingFrames.some(f => f.frame.step === 1 && f.frame.holding && f.frame.valid)).toBe(true);
    expect(harness.activations).toEqual([]); expect(harness.sounds).toEqual([]);
    hold([trackedPose('purple', .435, 1)], 1000);
    expect(harness.activations).toEqual([false]); expect(harness.sounds).toEqual(['purple']);
  });
  it('routes Fuga audio during both casting holds before activation', () => {
    start('flame'); hold([trackedPose('open', .3, 1), trackedPose('open', .7, 2)], 300);
    expect(harness.castingFrames.some(f => f.frame.pose === 'flame-charge' && f.frame.progress * f.frame.holdMs >= 100)).toBe(true);
    expect(harness.sounds).toEqual([]); expect(harness.activations).toEqual([]);
    hold([trackedPose('open', .3, 1), trackedPose('open', .7, 2)], 600);
    hold([trackedPose('fist', .3, 1), trackedPose('red', .7, 2)], 300);
    expect(harness.castingFrames.some(f => f.frame.pose === 'flame-release' && f.frame.progress * f.frame.holdMs >= 100)).toBe(true);
    expect(harness.activations).toEqual([]);
    hold([trackedPose('fist', .3, 1), trackedPose('red', .7, 2)], 700);
    expect(harness.sounds).toEqual(['flame']); expect(harness.activations).toEqual([false]);
  });
  it.each(['blue', 'red', 'shrine'] as const)('provides %s audio progress before score, recovery or attack', key => {
    start(key);
    const hands = key === 'shrine' ? [trackedPose('blue', .435, 1), trackedPose('blue', .565, 2)] : [trackedPose(key)];
    hold(hands, 300);
    expect(harness.castingFrames.some(f => f.frame.valid && f.frame.holding && f.frame.progress * f.frame.holdMs >= 100)).toBe(true);
    expect(harness.activations).toEqual([]); expect(labStore.get().hits).toBe(0); expect(labStore.get().phase).toBe('holding');
  });
  it('cancels the preparation cue when fresh camera frames stop arriving', () => {
    start('flame'); hold([trackedPose('open', .3, 1), trackedPose('open', .7, 2)], 900);
    expect(harness.castingFrames.some(f => f.key === 'flame' && f.frame.holding)).toBe(true); const stopped = harness.stoppedPreparations;
    now += 300; harness.tick!(now); expect(harness.stoppedPreparations).toBeGreaterThan(stopped);
    expect(harness.activations).toEqual([]); expect(harness.sounds).toEqual([]);
  });
  it('blocks repeated casts until a manual respawn and retains the score', () => {
    start('red'); hold([trackedPose('red')], 1000); expect(labStore.get().awaitingRespawn).toBe(true);
    controller.respawnCurse(); expect(labStore.get().awaitingRespawn).toBe(true);
    now += 2700; harness.tick!(now); expect(labStore.get().respawnReady).toBe(true);
    hold([trackedPose('open')], 700); hold([trackedPose('red')], 1500);
    expect(labStore.get().hits).toBe(1); expect(harness.activations).toEqual([false]);
    controller.respawnCurse(); expect(labStore.get().awaitingRespawn).toBe(false);
    hold([trackedPose('red')], 1000); expect(labStore.get().hits).toBe(2);
  });
  it('respawn does not bypass the required open-hand release', () => {
    start('red'); hold([trackedPose('red')], 1000); now += 2700; harness.tick!(now); controller.respawnCurse();
    hold([trackedPose('red')], 2000); expect(labStore.get().hits).toBe(1);
    hold([trackedPose('open')], 700); hold([trackedPose('red')], 1000); expect(labStore.get().hits).toBe(2);
  });
  it('keeps the respawn requirement across pause/resume and enables debug-target respawn', () => {
    start('red'); hold([trackedPose('red')], 1000); controller.pause();
    now += 3000; harness.tick!(now); expect(labStore.get().respawnReady).toBe(true);
    controller.begin(); expect(labStore.get().awaitingRespawn).toBe(true);
    controller.respawnCurse(); expect(labStore.get().awaitingRespawn).toBe(false);
    controller.menu(); labStore.set({ debug: true }); controller.testEffect(true);
    expect(labStore.get().awaitingRespawn).toBe(true); now += 3000; harness.tick!(now);
    controller.respawnCurse(); expect(labStore.get().awaitingRespawn).toBe(false);
    expect(labStore.get().hits).toBe(0);
  });
  it('selects a target without restarting the camera or changing unlocks', () => {
    start('red'); labStore.set({ completedTechniques: ['blue'] });
    controller.selectCurse('hanami');
    expect(labStore.get().curse).toBe('hanami'); expect(labStore.get().stage).toBe('guide');
    expect(labStore.get().completedTechniques).toEqual(['blue']); expect(harness.starts).toBe(1);
    expect(localStorage.getItem('jjk-target-v1')).toBe('hanami');
    controller.begin(); now += 3000; harness.tick!(now); hold([trackedPose('red')], 1000);
    expect(labStore.get().hits).toBe(1);
  });
  it('changing target cancels a pending camera start', () => {
    harness.autoReady = false; controller.enter(); controller.begin(); controller.selectCurse('dagon');
    harness.status!({ ready: true, message: 'Ready', backend: 'TEST' });
    expect(labStore.get().stage).toBe('guide'); expect(labStore.get().startingPractice).toBe(false);
  });
  it('prepares the camera on entering and needs only Jugar to start practice', () => {
    expect(harness.starts).toBe(0); controller.enter();
    expect(harness.starts).toBe(1); expect(labStore.get().ready).toBe(true);
    expect(labStore.get().stage).toBe('guide'); controller.begin();
    expect(labStore.get().stage).toBe('countdown'); now += 3000; harness.tick!(now);
    expect(labStore.get().stage).toBe('practice'); expect(harness.starts).toBe(1);
    expect(labStore.get().hits).toBe(0);
  });
  it('keeps the camera when returning to the menu and choosing another lesson', () => {
    start('blue'); controller.menu();
    expect(labStore.get().ready).toBe(true); expect(harness.stops).toBe(0);
    controller.selectTechnique('red'); controller.enter(); controller.begin();
    expect(harness.starts).toBe(1); expect(labStore.get().stage).toBe('countdown');
  });
  it('queues Jugar until the camera is ready without duplicate requests or early countdown', () => {
    harness.autoReady = false; controller.enter(); controller.begin(); controller.begin();
    expect(harness.starts).toBe(1); expect(labStore.get().startingPractice).toBe(true);
    now = 5000; harness.tick!(now); expect(labStore.get().stage).toBe('guide');
    harness.status!({ ready: true, message: 'Ready', backend: 'TEST' });
    expect(labStore.get().stage).toBe('countdown'); expect(labStore.get().startingPractice).toBe(false);
    now = 7999; harness.tick!(now); expect(labStore.get().stage).toBe('countdown');
    now = 8000; harness.tick!(now); expect(labStore.get().stage).toBe('practice');
    expect(labStore.get().hits).toBe(0); expect(harness.activations).toEqual([]);
  });
  it.each(['guide', 'menu', 'technique'] as const)('cancels a pending start on %s even if camera readiness arrives late', action => {
    harness.autoReady = false; controller.enter(); controller.begin();
    if (action === 'guide') controller.guide();
    else if (action === 'menu') controller.menu(); else controller.selectTechnique('red');
    harness.status!({ ready: true, message: 'Late readiness', backend: 'TEST' });
    expect(labStore.get().startingPractice).toBe(false);
    expect(labStore.get().stage).toBe(action === 'menu' ? 'menu' : 'guide');
    now += 20000; harness.tick!(now); expect(labStore.get().hits).toBe(0);
  });
  it('recovers from denied permission with a single retry-and-play action', () => {
    harness.autoReady = false; controller.enter(); controller.begin();
    harness.status!({ ready: false, message: 'Denied', backend: '', error: 'Permission denied' });
    expect(labStore.get().startingPractice).toBe(false); expect(labStore.get().loading).toBe(false);
    expect(labStore.get().stage).toBe('guide');
    controller.begin(); expect(harness.starts).toBe(2); expect(labStore.get().startingPractice).toBe(true);
    harness.status!({ ready: true, message: 'Ready', backend: 'TEST' });
    expect(labStore.get().stage).toBe('countdown'); expect(labStore.get().error).toBe(null);
  });
  it('Jugar starts the camera after an explicit power-off', () => {
    controller.enter(); controller.disconnect();
    expect(labStore.get().ready).toBe(false); expect(harness.stops).toBe(1);
    controller.begin(); expect(harness.starts).toBe(2); expect(labStore.get().stage).toBe('countdown');
  });
  it('a hidden tab cannot auto-start when loading finishes', () => {
    harness.autoReady = false; controller.enter(); controller.begin();
    vi.stubGlobal('document', { hidden: true, addEventListener() {}, removeEventListener() {} });
    harness.status!({ ready: true, message: 'Ready', backend: 'TEST' });
    expect(labStore.get().startingPractice).toBe(false); expect(labStore.get().stage).toBe('guide');
    vi.stubGlobal('document', { hidden: false, addEventListener() {}, removeEventListener() {} });
    now += 5000; harness.tick!(now); expect(labStore.get().stage).toBe('guide');
    controller.begin(); expect(labStore.get().stage).toBe('countdown');
  });
  it('a tracker failure pauses practice and reanudar reconnects automatically', () => {
    start('red'); harness.status!({ ready: false, message: 'Lost camera', backend: '', error: 'Tracking failed' });
    expect(labStore.get().stage).toBe('paused'); expect(labStore.get().ready).toBe(false);
    controller.begin(); expect(harness.starts).toBe(2); expect(labStore.get().stage).toBe('countdown');
  });
  it('leaving the page stops the stream even though the menu keeps it', () => {
    controller.enter(); harness.pageHide!();
    expect(harness.stops).toBe(1); expect(labStore.get().ready).toBe(false);
  });
  it('a renderer failure never starts the camera or practice', () => {
    labStore.set({ rendererError: 'WebGL unavailable' }); controller.enter(); controller.begin();
    expect(harness.starts).toBe(0); expect(labStore.get().startingPractice).toBe(false);
  });
  it('routes Rojo recognition, effect and audio together', () => {
    start('red'); hold([trackedPose('blue')], 1400); expect(labStore.get().hits).toBe(0);
    hold([trackedPose('red')], 1000); expect(labStore.get().hits).toBe(1);
    expect(harness.activations).toEqual([false]); expect(harness.sounds).toEqual(['red']);
  });
  it('intermediate fusion phases do not count as activations', () => {
    start('fusion'); hold([splitHands()[0]], 3200); expect(labStore.get().hits).toBe(0);
    expect(labStore.get().stepIndex).toBe(1); hold(splitHands(), 2800); hold(mergedHands(), 900);
    expect(labStore.get().hits).toBe(1); expect(harness.activations).toEqual([false]);
  });
  it('debug effects cannot complete tutorials or change scores', () => {
    controller.selectTechnique('domain'); labStore.set({ debug: true }); controller.testEffect();
    now = 20000; harness.tick!(now);
    expect(harness.activations).toEqual([true]); expect(labStore.get().hits).toBe(0);
    expect(labStore.get().completedTechniques).toEqual([]);
  });
  it('cosmetic impact preview is marked debug, never scores and is blocked during practice', () => {
    controller.selectTechnique('purple'); labStore.set({ debug: true }); controller.testEffect(true);
    expect(harness.activations).toEqual([true]); expect(harness.targetPreviews).toEqual([true]);
    expect(labStore.get().debugEffect).toBe(true); expect(labStore.get().hits).toBe(0);
    expect(labStore.get().completedTechniques).toEqual([]);
    start('red'); controller.testEffect(true); expect(harness.activations).toEqual([true]);
  });
  it('completes the domain tutorial only after recognition and its effect interval', () => {
    start('domain'); hold([trackedPose('domain')], TECHNIQUES.domain.timing.holdMs);
    expect(labStore.get().hits).toBe(1); expect(labStore.get().stage).toBe('practice');
    now += TECHNIQUES.domain.effectMs + 100; harness.tick!(now);
    expect(labStore.get().stage).toBe('practice'); expect(labStore.get().completedTechniques).toEqual(['domain']);
    expect(labStore.get().awaitingRespawn).toBe(true); controller.respawnCurse(); expect(labStore.get().stage).toBe('complete');
    expect(JSON.parse(localStorage.getItem('jjk-gojo-completed-v3')!)).toEqual(['domain']);
  });
  it('does not unlock all techniques from the old Azul tutorial', () => {
    labStore.set({ completedTechniques: ['blue'], tutorialComplete: true });
    controller.selectTechnique('red'); controller.enter('free');
    expect(labStore.get().stage).toBe('menu'); expect(labStore.get().tutorialComplete).toBe(false);
    controller.selectTechnique('blue'); controller.enter('free'); expect(labStore.get().mode).toBe('free');
  });
  it('switching techniques clears a partial charge and all phase state', () => {
    start('fusion'); hold([splitHands()[0]], 3200); expect(labStore.get().stepIndex).toBe(1);
    controller.selectTechnique('purple'); expect(labStore.get().stage).toBe('guide');
    expect(labStore.get().stepIndex).toBe(0); expect(labStore.get().hits).toBe(0);
    controller.begin(); now += 3000; harness.tick!(now); hold(mergedHands(), 2000);
    expect(labStore.get().hits).toBe(0); expect(labStore.get().stepIndex).toBe(0);
  });
  it('changing character preserves Gojo progress and resets the active session', () => {
    labStore.set({ completedTechniques: ['blue', 'purple'], tutorialComplete: true });
    start('fusion'); hold([splitHands()[0]], 3200); controller.selectCharacter('sukuna');
    expect(labStore.get().technique).toBe('dismantle'); expect(labStore.get().stepIndex).toBe(0);
    expect(labStore.get().hits).toBe(0); expect(labStore.get().completedTechniques).toEqual(['blue', 'purple']);
    expect(labStore.get().tutorialComplete).toBe(false);
  });
  it('the Sukuna domain unlocks only its lesson and persists separately', () => {
    start('shrine'); hold([trackedPose('blue', .435, 1), trackedPose('blue', .565, 2)], 1800);
    expect(labStore.get().hits).toBe(1); now += TECHNIQUES.shrine.effectMs + 100; harness.tick!(now);
    expect(labStore.get().completedTechniques).toEqual(['shrine']);
    expect(JSON.parse(localStorage.getItem('jjk-lab-completed-v4')!)).toEqual(['shrine']);
    expect(JSON.parse(localStorage.getItem('jjk-gojo-completed-v3')!)).toEqual([]);
  });
});
