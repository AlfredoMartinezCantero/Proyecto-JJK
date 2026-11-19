import type { CharacterKey } from '../core/types';

/** Original procedural styling matching the selectable casters. */
export const HAND_APPEARANCE = {
  gojo: {
    skin: '#efd4bc', nail: '#f1d7c8', sleeve: '#192134', lining: '#101627',
    ink: '#251e2c', wristMarks: false, pointedNails: false, cuffAt: -.22, cuffRadius: .29, sleeveLength: 1.4,
  },
  sukuna: {
    skin: '#ddae9a', nail: '#211c28', sleeve: '#e3d8c7', lining: '#251e2c',
    ink: '#251e2c', wristMarks: true, pointedNails: true, cuffAt: -.62, cuffRadius: .39, sleeveLength: 1,
  },
  yuji: {
    skin: '#e7b99d', nail: '#edcbbb', sleeve: '#222c42', lining: '#b63446', ink: '#332731',
    wristMarks: false, pointedNails: false, cuffAt: -.35, cuffRadius: .31, sleeveLength: 1.25,
  },
  megumi: {
    skin: '#e5c7b7', nail: '#ecd3c8', sleeve: '#1d293e', lining: '#303d55', ink: '#232438',
    wristMarks: false, pointedNails: false, cuffAt: -.24, cuffRadius: .28, sleeveLength: 1.4,
  },
} satisfies Record<CharacterKey, {
  skin: string; nail: string; sleeve: string; lining: string; ink: string;
  wristMarks: boolean; pointedNails: boolean; cuffAt: number; cuffRadius: number; sleeveLength: number;
}>;
