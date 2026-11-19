import { GestureGate } from './GestureGate';
import { evaluateBlue, evaluatePose } from './gesture';
import { isPairPose, PAIR_LIMITS } from './techniques';
import { SwipeTracker } from './SwipeTracker';
import { PunchTracker } from './PunchTracker';
import { isShadowPose, SHADOW_LIMITS, SHADOW_SIGNS } from './shadowConfig';
import type { GateResult, GestureMetrics, GesturePrecision, HandFrame, PairPose, Point, SinglePose, TechniqueDefinition, TrackedHand } from './types';

export interface TechniqueEvaluation {
  metrics: GestureMetrics[];
  valid: boolean;
  usable: boolean;
  tracked: boolean;
  match: number;
  hint: string;
  primaryId?: number;
  secondaryId?: number;
  span?: number;
  spanRaw?: number;
}
export interface TechniqueResult extends TechniqueEvaluation, GateResult {
  stepIndex: number;
  completedStep: number | null;
}
type Binding = { blue: number; red: number };
const combine = (hand: TrackedHand, frame: HandFrame, pose: SinglePose, precision: GesturePrecision = 'standard'): GestureMetrics => {
  const raw = evaluatePose(hand.raw, frame.width, frame.height, pose, precision);
  const filtered = evaluatePose(hand.landmarks, frame.width, frame.height, pose, precision);
  return { ...filtered, usable: raw.usable && filtered.usable, valid: raw.valid && filtered.valid,
    open: raw.open && filtered.open, match: Math.min(raw.match, filtered.match), message: raw.valid ? filtered.message : raw.message };
};
const distance = (a: Point, b: Point, frame: HandFrame) => Math.hypot((a.x - b.x) * frame.width, (a.y - b.y) * frame.height);
function relation(a: Point[], b: Point[], frame: HandFrame) {
  if(!Array.isArray(a)||!Array.isArray(b)||a.length!==21||b.length!==21||
    [a[0],a[9],b[0],b[9]].some(p=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)))return {span:0,vertical:Infinity};
  const scale = (distance(a[0], a[9], frame) + distance(b[0], b[9], frame)) / 2;
  return { span: distance(a[9], b[9], frame) / Math.max(1, scale),
    vertical: Math.abs(a[9].y - b[9].y) * frame.height / Math.max(1, scale) };
}

export class TechniqueRecognizer {
  private gate: GestureGate;
  private stepIndex = 0;
  private binding: Binding | null = null;
  private primaryId: number | undefined;
  private deadline = 0;
  private lastTracking = 0;
  private lastCaptured = -Infinity;
  private lastUpdate = -Infinity;
  private locked = false;
  private sequenceOwner: number | undefined;
  private swipe: SwipeTracker | null = null;
  private punch: PunchTracker | null = null;

  constructor(readonly technique: TechniqueDefinition, private precision: GesturePrecision = 'standard') { this.gate = this.makeGate(0); }
  setPrecision(precision: GesturePrecision): void { if (precision !== this.precision) { this.interrupt(); this.precision = precision; } }
  private makeGate(index: number) { return new GestureGate({ ...this.technique.timing, holdMs: this.technique.steps[index].holdMs }); }

  reset(): void {
    this.stepIndex = 0; this.binding = null; this.primaryId = undefined; this.deadline = 0;
    this.lastTracking = 0; this.lastCaptured = -Infinity; this.lastUpdate = -Infinity; this.locked = false;
    this.gate = this.makeGate(0);
    this.sequenceOwner = undefined; this.swipe = null; this.punch = null;
  }
  interrupt(): void {
    if (this.locked) this.gate.interrupt();
    else { this.stepIndex = 0; this.gate = this.makeGate(0); }
    this.binding = null; this.primaryId = undefined; this.deadline = 0;
    this.lastCaptured = -Infinity; this.lastUpdate = -Infinity; this.lastTracking = 0;
    this.sequenceOwner = undefined; this.swipe = null; this.punch = null;
  }
  snapshot(now: number): GateResult { return this.gate.snapshot(now); }
  get currentStep(): number { return this.stepIndex; }
  commitActivation(now: number): void { if (this.locked) this.gate.beginCooldown(now); }

  inspect(frame: HandFrame): TechniqueEvaluation {
    const pose = this.technique.steps[this.stepIndex].pose;
    if (isPairPose(pose)) return this.pair(frame, pose);
    const precision = this.technique.key === 'blue' ? 'standard' : this.precision;
    const metrics = frame.hands.map(hand => combine(hand, frame, pose, precision));
    const owner = this.binding && pose === 'purple' ? this.binding.blue : this.stepIndex > 0 ? this.sequenceOwner : undefined;
    let index = owner === undefined ? -1 : frame.hands.findIndex(hand => hand.id === owner);
    if (index < 0 && owner !== undefined) return { metrics, usable: false, valid: false,
      tracked: false, match: 0, hint: 'Vuelve a mostrar la mano que preparó esta secuencia.' };
    if (index < 0) index = frame.hands.findIndex((hand, i) => hand.id === this.primaryId && metrics[i].valid);
    if (index < 0) index = metrics.findIndex(value => value.valid);
    if (index < 0) index = metrics.findIndex(value => value.usable);
    if (index < 0 && frame.hands.length) index = 0;
    const metric = metrics[index];
    const prematureRed = pose === 'prepare-blue' && frame.hands.some((hand, i) => i !== index && combine(hand, frame, 'red', precision).valid);
    const movement = pose === 'strike' ? this.punch : pose === 'slash-sweep' ? this.swipe : null;
    return { metrics, usable: metric?.usable ?? false, valid: (metric?.valid ?? false) && !prematureRed && (!['strike', 'slash-sweep'].includes(pose) || (movement?.complete ?? false)),
      tracked: index >= 0, match: prematureRed ? Math.min(metric?.match ?? 0, .6) : metric?.match ?? 0, primaryId: frame.hands[index]?.id,
      hint: prematureRed ? 'Empieza solo con Azul. Prepara Rojo en el siguiente paso.' : pose === 'strike' && metric?.valid ? this.punch?.hint ?? 'Desplaza el puño hacia un lado y frena.' : pose === 'slash-sweep' && metric?.valid ? this.swipe?.hint ?? 'Mueve el índice hacia un lado y frena suavemente.' : metric?.message ?? 'Muestra una mano completa frente a la cámara.' };
  }

  private pair(frame: HandFrame, pose: PairPose): TechniqueEvaluation {
    const openPair = ['cleave-spread', 'cleave-close', 'flame-charge', 'nue-gather', 'nue-spread'].includes(pose);
    const signs = isShadowPose(pose) ? SHADOW_SIGNS[pose] : null;
    const first: SinglePose = signs ? signs[0] : openPair ? 'palm' : pose === 'flame-release' ? 'fist' : 'blue';
    const second: SinglePose = signs ? signs[1] : openPair ? 'palm' : pose === 'flame-release' ? this.precision === 'detailed' ? 'bow' : 'blade' : pose === 'shrine' ? 'blue' : 'red';
    const precision = this.technique.character === 'gojo' ? this.precision : 'standard';
    const blues = frame.hands.map(hand => combine(hand, frame, first, precision));
    const reds = frame.hands.map(hand => combine(hand, frame, second, precision));
    const candidates: { a: number; b: number; score: number }[] = [];
    frame.hands.forEach((hand, a) => frame.hands.forEach((other, b) => {
      const bound = !this.binding || (hand.id === this.binding.blue && other.id === this.binding.red) ||
        ((pose === 'flame-release'||pose==='elephant-release') && hand.id === this.binding.red && other.id === this.binding.blue);
      if (a === b || !bound || pose === 'prepare-red' && hand.id !== this.sequenceOwner) return;
      candidates.push({ a, b, score: blues[a].match + reds[b].match });
    }));
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    // Before Rojo has been assigned, only the completed Azul hand must remain tracked.
    // Requiring the not-yet-present second hand here reset the whole sequence after 250 ms.
    const waitingBlue = pose === 'prepare-red' && !this.binding
      ? frame.hands.findIndex(hand => hand.id === this.sequenceOwner) : -1;
    if (!best && waitingBlue >= 0) return {
      metrics: blues, usable: false, valid: false, tracked: true,
      match: blues[waitingBlue].match * .5, primaryId: this.sequenceOwner,
      hint: blues[waitingBlue].valid ? 'Azul preparado. Conserva esa mano y muestra Rojo con la otra, separados.' : blues[waitingBlue].message,
    };
    if (!best) return { metrics: blues, usable: false, valid: false, tracked: false, match: 0,
      hint: this.technique.character === 'gojo' ? 'Necesitas dos manos visibles: Azul en una y Rojo en la otra.' : 'Necesitas dos manos completas y visibles.' };
    const blue = frame.hands[best.a], red = frame.hands[best.b], a = blues[best.a], b = reds[best.b];
    const raw = relation(blue.raw, red.raw, frame), filtered = relation(blue.landmarks, red.landmarks, frame);
    const apart = ['split', 'prepare-red', 'cleave-spread', 'flame-charge', 'flame-release'].includes(pose);
    const shadow = isShadowPose(pose) ? SHADOW_LIMITS[pose] : null;
    const min = shadow ? shadow.min : apart ? PAIR_LIMITS.splitMin : PAIR_LIMITS.mergeMin;
    const max = shadow ? shadow.max : apart ? PAIR_LIMITS.splitMax : PAIR_LIMITS.mergeMax;
    const maxVertical = shadow ? SHADOW_LIMITS.maxVertical : PAIR_LIMITS.maxVertical;
    const acceptable = (r: ReturnType<typeof relation>) => r.span >= min && r.span <= max && r.vertical <= maxVertical;
    const positioned = acceptable(raw) && acceptable(filtered);
    const metrics = frame.hands.map((_, i) => i === best.b ? reds[i] : blues[i]);
    return { metrics, usable: a.usable && b.usable, valid: a.valid && b.valid && positioned, tracked: true,
      match: Math.min(a.match, b.match) * (positioned ? 1 : .6), primaryId: blue.id, secondaryId: red.id,
      span: filtered.span, spanRaw: raw.span,
      hint: !a.usable || !b.usable ? (!a.usable ? a.message : b.message) : !a.valid || !b.valid ? (!a.valid ? a.message : b.message) : raw.vertical > maxVertical ? 'Coloca ambas palmas a una altura parecida.' :
        !positioned ? (raw.span < min ? 'Separa un poco las palmas; no las superpongas.' : 'Acerca las palmas manteniendo ambos gestos.') :
          'Bien. Conserva ambas manos visibles y mantén la postura.',
    };
  }

  private releaseSample(frame: HandFrame) {
    const metrics = frame.hands.map(hand => {
      const raw = evaluateBlue(hand.raw, frame.width, frame.height), smooth = evaluateBlue(hand.landmarks, frame.width, frame.height);
      return { hand, open: raw.usable && smooth.usable && raw.open && smooth.open };
    });
    const open = metrics.filter(value => value.open).sort((a, b) => a.hand.id - b.hand.id).slice(0, this.technique.handCount);
    const firstPose = this.technique.steps[0].pose;
    const stillHolding = !isPairPose(firstPose) && frame.hands.some(hand => combine(hand, frame, firstPose).valid);
    const valid = open.length === this.technique.handCount && !stillHolding;
    return { usable: valid, valid: false, open: valid, capturedAt: frame.capturedAt,
      trackId: valid ? open.map(value => value.hand.id).join(':') : null };
  }

  update(frame: HandFrame): TechniqueResult {
    const now = frame.receivedAt;
    const fresh = Number.isFinite(now) && now > this.lastUpdate && frame.capturedAt > this.lastCaptured &&
      frame.capturedAt <= now && now - frame.capturedAt <= 200;
    if (fresh && !this.locked && this.technique.steps[this.stepIndex].pose === 'slash-sweep' && this.swipe) {
      const hand = frame.hands.find(h => h.id === this.sequenceOwner);
      if (hand) this.swipe.update(hand, frame, combine(hand, frame, 'slash-sweep').valid);
    }
    if (fresh && !this.locked && this.technique.steps[this.stepIndex].pose === 'strike' && this.punch) {
      const hand = frame.hands.find(h => h.id === this.sequenceOwner);
      if (hand) this.punch.update(hand, frame, combine(hand, frame, 'strike').valid);
    }
    let evaluation = this.inspect(frame);
    if (now <= this.lastUpdate || !Number.isFinite(now)) {
      return { ...evaluation, ...this.gate.snapshot(Number.isFinite(this.lastUpdate) ? this.lastUpdate : 0), stepIndex: this.stepIndex, completedStep: null };
    }
    this.lastUpdate = now;
    if (fresh) this.lastCaptured = frame.capturedAt;
    if (this.locked) {
      const sample = this.releaseSample(frame);
      const gate = this.gate.update(now, fresh ? sample : { ...sample, usable: false, open: false });
      if (gate.phase === 'ready') { this.locked = false; this.binding = null; this.gate = this.makeGate(0); }
      return { ...evaluation, ...gate, stepIndex: 0, completedStep: null,
        hint: gate.phase === 'cooldown' ? `${this.technique.name} activado. Espera a que termine la recuperación.` :
          gate.phase === 'release' ? `Abre ${this.technique.handCount === 2 ? 'ambas manos' : 'la mano'} y mantén la postura para volver a preparar.` : 'Técnica preparada.',
      };
    }
    if ((this.stepIndex > 0 && (now > this.deadline || (fresh && now - this.lastTracking > this.technique.timing.lostGraceMs))) ||
        ((this.binding || this.sequenceOwner !== undefined) && !evaluation.tracked && now - this.lastTracking > this.technique.timing.lostGraceMs) || this.swipe?.expired || this.punch?.expired) {
      this.stepIndex = 0; this.binding = null; this.gate = this.makeGate(0); this.deadline = 0;
      this.sequenceOwner = undefined; this.swipe = null; this.punch = null;
      evaluation = { ...this.inspect(frame), hint: 'Secuencia reiniciada. ' + this.technique.steps[0].instruction };
    }
    if (evaluation.tracked && fresh) this.lastTracking = now;
    if (evaluation.valid && fresh) {
      this.primaryId = evaluation.primaryId;
      if (!this.binding && evaluation.secondaryId !== undefined && evaluation.primaryId !== undefined) {
        this.binding = { blue: evaluation.primaryId, red: evaluation.secondaryId };
      }
    }
    const identity = evaluation.secondaryId === undefined ? evaluation.primaryId ?? null :
      `${evaluation.primaryId}:${evaluation.secondaryId}`;
    const result = this.gate.update(now, { usable: fresh && evaluation.usable, valid: fresh && evaluation.valid,
      open: false, trackId: identity, capturedAt: frame.capturedAt });
    if (result.fire) {
      if (this.stepIndex < this.technique.steps.length - 1) {
        const completedStep = this.stepIndex++;
        if (evaluation.secondaryId === undefined) this.sequenceOwner = evaluation.primaryId;
        if (this.technique.steps[this.stepIndex].pose === 'slash-sweep') {
          const hand = frame.hands.find(h => h.id === this.sequenceOwner);
          if (hand) this.swipe = new SwipeTracker(hand.id, hand, frame);
        }
        if (this.technique.steps[this.stepIndex].pose === 'strike') {
          const hand = frame.hands.find(h => h.id === this.sequenceOwner);
          if (hand) this.punch = new PunchTracker(hand.id, hand, frame);
        }
        this.gate = this.makeGate(this.stepIndex); this.deadline = now + PAIR_LIMITS.sequenceWindowMs;
        return { ...evaluation, ...this.gate.snapshot(now), stepIndex: this.stepIndex, completedStep,
          hint: this.technique.steps[this.stepIndex].instruction };
      }
      this.locked = true; this.stepIndex = 0; this.deadline = 0;
      return { ...evaluation, ...result, stepIndex: 0, completedStep: this.technique.steps.length - 1,
        hint: `¡${this.technique.name}!` };
    }
    return { ...evaluation, ...result, stepIndex: this.stepIndex, completedStep: null,
      hint: !fresh ? 'Esperando un fotograma reciente.' : result.phase === 'paused' ? 'Seguimiento perdido. La carga no aumenta.' :
        result.phase === 'holding' ? this.technique.steps[this.stepIndex].pose === 'strike' ? this.punch!.hint : this.technique.steps[this.stepIndex].pose === 'slash-sweep' ? this.swipe!.hint : `Mantén: ${this.technique.steps[this.stepIndex].label}.` : evaluation.hint };
  }
}
