export const CURSES = {
  mahito: { name: 'Mahito', detail: 'Cabello gris azulado · costuras · ropa de retales' },
  hanami: { name: 'Hanami', detail: 'Corteza clara · ramas · brazo cubierto · flor' },
  jogo: { name: 'Jogo', detail: 'Cráter volcánico · ojo único · manto moteado' },
  dagon: { name: 'Dagon', detail: 'Forma evolucionada · tentáculos · aletas · escamas' },
} as const;
export type CurseKey = keyof typeof CURSES;
export const isCurseKey = (key: unknown): key is CurseKey => typeof key === 'string' && Object.hasOwn(CURSES, key);
