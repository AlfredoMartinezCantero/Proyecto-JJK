import type { GesturePrecision } from './types';
export interface Settings {
  volume: number;
  intensity: number;
  reducedFlashes: boolean;
  showCamera: boolean;
  showSkeleton: boolean;
  quality: 'low' | 'high';
  gesturePrecision: GesturePrecision;
}
export const DEFAULT_SETTINGS: Settings = {
  volume: .3, intensity: .75, reducedFlashes: true, showCamera: true, showSkeleton: false, quality: 'high', gesturePrecision: 'standard',
};
export function parseSettings(input: unknown): Settings {
  const value = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const number = (key: 'volume' | 'intensity') => typeof value[key] === 'number' && Number.isFinite(value[key])
    ? Math.min(1, Math.max(0, value[key] as number)) : DEFAULT_SETTINGS[key];
  const boolean = (key: 'reducedFlashes' | 'showCamera' | 'showSkeleton') =>
    typeof value[key] === 'boolean' ? value[key] as boolean : DEFAULT_SETTINGS[key];
  return { volume: number('volume'), intensity: number('intensity'),
    reducedFlashes: boolean('reducedFlashes'), showCamera: boolean('showCamera'),
    showSkeleton: boolean('showSkeleton'), quality: value.quality === 'low' ? 'low' : 'high',
    gesturePrecision: value.gesturePrecision === 'detailed' ? 'detailed' : 'standard' };
}
export function loadSettings(): Settings {
  try { return parseSettings(JSON.parse(localStorage.getItem('jjk-settings-v2') ?? '{}')); }
  catch { return { ...DEFAULT_SETTINGS }; }
}
