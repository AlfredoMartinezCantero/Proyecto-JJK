import type { TechniqueKey } from '../core/types';

export interface TechniqueAudio {
  label: string;
  activation: string[];
  preparation?: string;
}
const file = (name: string) => `${import.meta.env.BASE_URL}audio/sukuna/${name}`;
const gojoFile = (name: string) => `${import.meta.env.BASE_URL}audio/gojo/${name}`;
export const GOJO_SEQUENCE_AUDIO = {
  blue: gojoFile('gojo-azul.m4a'), red: gojoFile('gojo-rojo.m4a'), fusion: gojoFile('gojo-hollow-purple.m4a'),
};

/** User-supplied files bundled locally; optional session uploads take precedence. */
export const TECHNIQUE_AUDIO: Partial<Record<TechniqueKey, TechniqueAudio>> = {
  blue: { label: 'Gojo azul.m4a', activation: [GOJO_SEQUENCE_AUDIO.blue] },
  red: { label: 'Gojo rojo.m4a', activation: [GOJO_SEQUENCE_AUDIO.red] },
  domain: { label: 'Expansión de dominio de Gojo', activation: [gojoFile('gojo-domain.mp3')] },
  fusion: { label: 'Azul → Rojo → Hollow Purple durante el casteo', activation: [GOJO_SEQUENCE_AUDIO.fusion] },
  purple: { label: 'Azul → Rojo → Hollow Purple durante el casteo', activation: [GOJO_SEQUENCE_AUDIO.fusion] },
  dismantle: { label: 'Dismantle.mp3', activation: [file('dismantle.mp3')] },
  cleave: { label: 'cleave.mp3', activation: [file('cleave.mp3')] },
  shrine: { label: 'santuario.m4a', activation: [file('santuario.m4a')] },
  flame: { label: 'fuga1.m4a (carga) · fuga2.m4a (casteo final)', preparation: file('fuga1.m4a'), activation: [file('fuga2.m4a')] },
};
