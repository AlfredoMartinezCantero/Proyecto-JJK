import config from '../../web/config.json';
import catalog from '../config/gojo.json';
import sukunaCatalog from '../config/sukuna.json';
import yujiCatalog from '../config/yuji.json';
import megumiCatalog from '../config/megumi.json';
import type { CharacterKey, PairPose, Pose, TechniqueDefinition, TechniqueKey } from './types';

const keys: TechniqueKey[] = ['blue', 'red', 'fusion', 'purple', 'domain'];
export const SUKUNA_KEYS: TechniqueKey[] = ['dismantle', 'cleave', 'flame', 'shrine'];
export const YUJI_KEYS: TechniqueKey[] = ['divergent', 'black-flash'];
export const MEGUMI_KEYS: TechniqueKey[] = ['divine-dogs', 'nue', 'totality', 'toad', 'max-elephant', 'rabbit-escape', 'mahoraga', 'chimera-garden'];
export const SHADOW_POSES: PairPose[] = ['hounds', 'nue-gather', 'nue-spread', 'totality-gather', 'totality-release', 'toad-sign', 'elephant-gather', 'elephant-release', 'rabbit-sign', 'ritual', 'chimera-gather', 'chimera-release'];
const poses: Pose[] = ['blue', 'prepare-blue', 'prepare-red', 'red', 'split', 'merge', 'purple', 'domain', 'blade', 'slash-sweep', 'palm', 'fist', 'strike', 'bow', 'cleave-spread', 'cleave-close', 'flame-charge', 'flame-release', 'shrine', 'wolf', ...SHADOW_POSES];
export const isPairPose = (pose: Pose): pose is PairPose => [...SHADOW_POSES, 'split', 'prepare-red', 'merge', 'cleave-spread', 'cleave-close', 'flame-charge', 'flame-release', 'shrine'].includes(pose as PairPose);

export function validateCatalog(input: unknown, expected: TechniqueKey[] = keys, character: CharacterKey = 'gojo'): TechniqueDefinition[] {
  if (!input || typeof input !== 'object' || !('techniques' in input) || !Array.isArray(input.techniques)) {
    throw new Error('Catálogo de técnicas no válido.');
  }
  const seen = new Set<string>();
  const seenIds = new Set<string>();
  for (const value of input.techniques) {
    if (!value || typeof value !== 'object') throw new Error('Ficha de técnica no válida.');
    const t = value as Record<string, unknown>;
    if (!expected.includes(t.key as TechniqueKey) || seen.has(String(t.key))) throw new Error('Clave de técnica desconocida o repetida.');
    seen.add(String(t.key));
    for (const field of ['id', 'name', 'title', 'subtitle', 'description', 'difficulty']) {
      if (typeof t[field] !== 'string' || !(t[field] as string).trim()) throw new Error(`Texto no válido: ${field}`);
    }
    if (seenIds.has(String(t.id))) throw new Error('Identificador de técnica repetido.');
    seenIds.add(String(t.id));
    if (typeof t.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(t.color)) throw new Error('Color de técnica no válido.');
    if (t.handCount !== 1 && t.handCount !== 2) throw new Error('Número de manos no válido.');
    if (!Array.isArray(t.instructions) || t.instructions.length < 1 || t.instructions.some(v => typeof v !== 'string')) throw new Error('Instrucciones no válidas.');
    if (!Number.isInteger(t.tutorialGoal) || (t.tutorialGoal as number) < 1 || (t.tutorialGoal as number) > 5) throw new Error('Objetivo no válido.');
    const timing = t.timing as Record<string, unknown> | undefined;
    if (!timing) throw new Error('Faltan los tiempos de la técnica.');
    for (const [key, min, max] of [['holdMs', 500, 5000], ['lostGraceMs', 0, 500], ['cooldownMs', 1000, 12000], ['releaseMs', 300, 2000]] as const) {
      if (typeof timing[key] !== 'number' || !Number.isFinite(timing[key]) || (timing[key] as number) < min || (timing[key] as number) > max) throw new Error(`Tiempo no válido: ${key}`);
    }
    if (typeof t.effectMs !== 'number' || !Number.isFinite(t.effectMs) || t.effectMs < 500 || t.effectMs > (timing.cooldownMs as number)) throw new Error('Duración de efecto no válida.');
    if (!Array.isArray(t.steps) || !t.steps.length || t.steps.length > 4) throw new Error('Secuencia no válida.');
    for (const step of t.steps) {
      if (!step || !poses.includes(step.pose) || typeof step.label !== 'string' || typeof step.instruction !== 'string' ||
          !Number.isFinite(step.holdMs) || step.holdMs < 500 || step.holdMs > 5000) throw new Error('Paso de reconocimiento no válido.');
    }
  }
  if (seen.size !== expected.length) throw new Error('El catálogo debe contener todos sus entrenamientos.');
  return input.techniques.map(t => ({ ...t, character })) as TechniqueDefinition[];
}

export const GOJO_TECHNIQUES = validateCatalog(catalog);
export const SUKUNA_TECHNIQUES = validateCatalog(sukunaCatalog, SUKUNA_KEYS, 'sukuna');
export const YUJI_TECHNIQUES = validateCatalog(yujiCatalog, YUJI_KEYS, 'yuji');
export const MEGUMI_TECHNIQUES = validateCatalog(megumiCatalog, MEGUMI_KEYS, 'megumi');
export const ALL_TECHNIQUES = [...GOJO_TECHNIQUES, ...SUKUNA_TECHNIQUES, ...YUJI_TECHNIQUES, ...MEGUMI_TECHNIQUES];
export const TECHNIQUES = Object.fromEntries(ALL_TECHNIQUES.map(t => [t.key, t])) as Record<TechniqueKey, TechniqueDefinition>;
export const CHARACTERS = {
  gojo: { name: 'Satoru Gojo', shortName: 'Gojo', monogram: '五', title: 'EL ILIMITADO', trait: 'Ilimitado', techniques: GOJO_TECHNIQUES },
  sukuna: { name: 'Ryomen Sukuna', shortName: 'Sukuna', monogram: '宿', title: 'EL REY DE LAS MALDICIONES', trait: 'Santuario', techniques: SUKUNA_TECHNIQUES },
  yuji: { name: 'Yuji Itadori', shortName: 'Yuji', monogram: '虎', title: 'EL PUÑO QUE ROMPE LA MALDICIÓN', trait: 'Combate cuerpo a cuerpo', techniques: YUJI_TECHNIQUES },
  megumi: { name: 'Megumi Fushiguro', shortName: 'Megumi', monogram: '影', title: 'HEREDERO DE LAS DIEZ SOMBRAS', trait: 'Diez Sombras', techniques: MEGUMI_TECHNIQUES },
};
export const CHARACTER_KEYS = Object.keys(CHARACTERS) as CharacterKey[];
export const GEOMETRY = config.technique.gesture;
export const PAIR_LIMITS = { splitMin: 2.6, splitMax: 7, mergeMin: 1.1, mergeMax: 2.1, maxVertical: 1.4, sequenceWindowMs: 10000 };

export const BLUE = {
  ...TECHNIQUES.blue,
  character: 'Satoru Gojo',
  canon: 'Adaptación jugable para webcam. Sello original sin verificar.',
  instructions: TECHNIQUES.blue.instructions.join(' '),
  gesture: { ...config.technique.gesture },
  timing: {
    ...TECHNIQUES.blue.timing,
  },
} as const;

export const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
] as const;
