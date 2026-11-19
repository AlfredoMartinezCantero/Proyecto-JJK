export interface Point { x: number; y: number; z: number }
export interface HandObservation {
  landmarks: Point[];
  worldLandmarks?: Point[];
  handedness: string;
  handednessScore: number;
}
export interface TrackedHand extends HandObservation {
  id: number;
  raw: Point[];
}
export interface HandFrame {
  hands: TrackedHand[];
  capturedAt: number;
  receivedAt: number;
  width: number;
  height: number;
}
export interface GestureMetrics {
  usable: boolean;
  valid: boolean;
  open: boolean;
  match: number;
  message: string;
  angles: number[];
  curls: number[];
  palmPixels: number;
  separation: number;
  thumbDistance?: number;
  crossing?: number;
  thumbAngle?: number;
  thumbAlignment?: number;
}
export type GesturePrecision = 'standard' | 'detailed';
export type CharacterKey = 'gojo' | 'sukuna' | 'yuji' | 'megumi';
export type TechniqueKey = 'blue' | 'red' | 'fusion' | 'purple' | 'domain' | 'dismantle' | 'cleave' | 'flame' | 'shrine' | 'divergent' | 'black-flash' | 'divine-dogs' | 'nue' | 'totality' | 'toad' | 'max-elephant' | 'rabbit-escape' | 'mahoraga' | 'chimera-garden';
export type PairPose = 'split' | 'prepare-red' | 'merge' | 'cleave-spread' | 'cleave-close' | 'flame-charge' | 'flame-release' | 'shrine' | 'hounds' | 'nue-gather' | 'nue-spread' | 'totality-gather' | 'totality-release' | 'toad-sign' | 'elephant-gather' | 'elephant-release' | 'rabbit-sign' | 'ritual' | 'chimera-gather' | 'chimera-release';
export type SinglePose = 'blue' | 'prepare-blue' | 'red' | 'purple' | 'domain' | 'blade' | 'slash-sweep' | 'palm' | 'fist' | 'bow' | 'strike' | 'wolf';
export type Pose = SinglePose | PairPose;
export interface TechniqueStep { pose: Pose; label: string; instruction: string; holdMs: number }
export interface TechniqueDefinition {
  character: CharacterKey;
  key: TechniqueKey;
  id: string;
  name: string;
  title: string;
  subtitle: string;
  color: string;
  handCount: 1 | 2;
  difficulty: string;
  tutorialGoal: number;
  description: string;
  instructions: string[];
  timing: Timing;
  effectMs: number;
  steps: TechniqueStep[];
}
export type GatePhase = 'ready' | 'holding' | 'paused' | 'cooldown' | 'release';
export interface GateSample {
  usable: boolean;
  valid: boolean;
  open: boolean;
  trackId: number | string | null;
  capturedAt: number;
}
export interface GateResult {
  phase: GatePhase;
  progress: number;
  releaseProgress: number;
  cooldownRemaining: number;
  fire: boolean;
}
export interface Timing {
  holdMs: number;
  lostGraceMs: number;
  cooldownMs: number;
  releaseMs: number;
}
export type Stage = 'menu' | 'guide' | 'countdown' | 'practice' | 'paused' | 'complete';
