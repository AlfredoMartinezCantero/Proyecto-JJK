import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SoundEngine } from '../src/audio/SoundEngine';
import { YUJI_CONTACT, DIVERGENT_DELAY_MS } from '../src/scene/yujiTimeline';
import { MEGUMI_CONTACT, DOG_SECOND_HIT_MS, megumiContactTimes } from '../src/scene/megumiTimeline';
import { TECHNIQUES } from '../src/core/techniques';

const parameter = () => ({ setValueAtTime:vi.fn(),exponentialRampToValueAtTime:vi.fn(),setTargetAtTime:vi.fn(),value:0 });
const nodes: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }[] = [];
class Context {
  state = 'running'; currentTime = 10; destination = {};
  resume() { return Promise.resolve(); } close() { return Promise.resolve(); }
  createGain() { const gain = { gain:parameter(),connect:vi.fn(),disconnect:vi.fn() }; gain.connect.mockReturnValue(gain); return gain; }
  createOscillator() {
    const oscillator = { frequency:parameter(),type:'',connect:vi.fn(target => target),start:vi.fn(),stop:vi.fn() };
    nodes.push(oscillator); return oscillator;
  }
}
let engine: SoundEngine;
beforeEach(() => { nodes.length = 0; vi.stubGlobal('AudioContext',Context); vi.spyOn(performance,'now').mockReturnValue(0); engine = new SoundEngine(); engine.unlock(); });
afterEach(() => { engine.dispose(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('Megumi synthesized summon and contact synchronization', () => {
  for(const key of ['totality','toad','max-elephant','rabbit-escape','mahoraga','chimera-garden'] as const)it(`${key}: uses its shared contact schedule and cancels every queued sound`,()=>{
    engine.play(.3,key);const times=nodes.map(n=>n.start.mock.calls[0][0]);expect(times[0]).toBe(10);
    for(const contact of megumiContactTimes(key))expect(times.filter(t=>Math.abs(t-(10+contact/1000))<1e-6).length).toBeGreaterThan(0);
    expect(new Set(times).size).toBe(megumiContactTimes(key).length+1);
    const stops=nodes.map(n=>n.stop.mock.calls.length);engine.stop();expect(nodes.every((n,i)=>n.stop.mock.calls.length>stops[i])).toBe(true);
  });
  it('keeps the unsupplied voice silent during the gesture and schedules summon, then both dog bites', () => {
    engine.updateCasting(.3,'divine-dogs',{step:0,pose:'hounds',holdMs:1200,valid:true,holding:true,progress:.8,bluePan:0,redPan:0});
    expect(nodes).toHaveLength(0); engine.play(.3,'divine-dogs'); expect(nodes).toHaveLength(5);
    expect(nodes.map(n=>n.start.mock.calls[0][0])).toEqual([10,10+MEGUMI_CONTACT['divine-dogs']/1000,10+MEGUMI_CONTACT['divine-dogs']/1000,
      10+(MEGUMI_CONTACT['divine-dogs']+DOG_SECOND_HIT_MS)/1000,10+(MEGUMI_CONTACT['divine-dogs']+DOG_SECOND_HIT_MS)/1000]);
  });
  it('schedules Nue electricity at contact and cancels queued sounds on interruption', () => {
    engine.play(.4,'nue'); expect(nodes).toHaveLength(3); expect(nodes.map(n=>n.start.mock.calls[0][0])).toEqual([10,11.6,11.6]);
    const stops=nodes.map(n=>n.stop.mock.calls.length); engine.stop(); expect(nodes.every((n,i)=>n.stop.mock.calls.length>stops[i])).toBe(true);
  });
  it('honors mute and stops with the end of the summon animation', () => {
    engine.play(0,'divine-dogs'); expect(nodes).toHaveLength(0); engine.play(.3,'nue');const stops=nodes.map(n=>n.stop.mock.calls.length);
    engine.updatePlayback(TECHNIQUES.nue.effectMs);expect(nodes.every((n,i)=>n.stop.mock.calls.length>stops[i])).toBe(true);
  });
});
describe('Yuji synthesized impact synchronization', () => {
  it('keeps preparation silent and schedules the two Divergent Fist impacts at their shared contact times', () => {
    engine.updateCasting(.3,'divergent',{step:0,pose:'fist',holdMs:700,valid:true,holding:true,progress:.8,bluePan:0,redPan:0});
    expect(nodes).toHaveLength(0); engine.play(.3,'divergent'); expect(nodes).toHaveLength(4);
    expect(nodes.map(n => n.start.mock.calls[0][0])).toEqual([10+YUJI_CONTACT.divergent/1000,10+YUJI_CONTACT.divergent/1000,
      10+(YUJI_CONTACT.divergent+DIVERGENT_DELAY_MS)/1000,10+(YUJI_CONTACT.divergent+DIVERGENT_DELAY_MS)/1000]);
  });
  it('schedules a single layered Black Flash contact and cancels every scheduled voice on interruption', () => {
    engine.play(.4,'black-flash'); expect(nodes).toHaveLength(3);
    expect(nodes.every(n => n.start.mock.calls[0][0] === 10+YUJI_CONTACT['black-flash']/1000)).toBe(true);
    const stops = nodes.map(n => n.stop.mock.calls.length); engine.stop();
    expect(nodes.every((n,i) => n.stop.mock.calls.length > stops[i])).toBe(true);
  });
  it('honors mute and stops sound with the end of the technique animation', () => {
    engine.play(0,'black-flash'); expect(nodes).toHaveLength(0);
    engine.play(.4,'black-flash'); const stops = nodes.map(n => n.stop.mock.calls.length);
    engine.updatePlayback(TECHNIQUES['black-flash'].effectMs);
    expect(nodes.every((n,i) => n.stop.mock.calls.length > stops[i])).toBe(true);
  });
});
