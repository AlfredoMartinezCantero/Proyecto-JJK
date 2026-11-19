import { TECHNIQUES } from '../core/techniques';
import type { TechniqueKey } from '../core/types';

export const HOLLOW_PURPLE_FADE_MS = 180;
/** User supplied the spoken "Murasaki" cue at 00:03 in the bundled recording. */
export const HOLLOW_PURPLE_RELEASE_MS = 3000;
export const isPurpleAudio = (key: TechniqueKey) => key === 'purple' || key === 'fusion';
export const hasIncantation = (key: TechniqueKey) => isPurpleAudio(key) || key === 'flame';
/** Fusión/Fuga reserve this tail; Purple uses its explicit spoken release cue. */
export const incantationTailMs = (key: TechniqueKey) => Math.max(0, TECHNIQUES[key].effectMs - 250);
