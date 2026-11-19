import { createStore } from '../core/store';
import { loadSettings, type Settings } from '../core/settings';
import type { GatePhase, GestureMetrics, Stage, TechniqueKey } from '../core/types';
import { normalizeProgress } from '../core/progress';
import { TECHNIQUES } from '../core/techniques';
import { isCurseKey, type CurseKey } from '../core/curses';

export interface LabState {
  curse: CurseKey;
  technique: TechniqueKey;
  completedTechniques: TechniqueKey[];
  stepIndex: number;
  pairSpan: number | null;
  stage: Stage;
  mode: 'tutorial' | 'free';
  ready: boolean;
  loading: boolean;
  startingPractice: boolean;
  awaitingRespawn: boolean;
  incanting: boolean;
  respawnReady: boolean;
  error: string | null;
  rendererError: string | null;
  shrineAssetStatus: 'idle' | 'loading' | 'ready' | 'error';
  hint: string;
  cameraStatus: string;
  backend: string;
  phase: GatePhase;
  progress: number;
  releaseProgress: number;
  cooldown: number;
  hands: number;
  match: number;
  inferenceFps: number;
  renderFps: number;
  hits: number;
  countdown: number;
  elapsed: number;
  debug: boolean;
  debugEffect: boolean;
  metrics: GestureMetrics[];
  tutorialComplete: boolean;
  settings: Settings;
}
let completed = false;
let savedProgress: unknown = [];
try {
  completed = localStorage.getItem('jjk-tutorial-v2') === 'complete';
  savedProgress = JSON.parse(localStorage.getItem('jjk-lab-completed-v4') ?? localStorage.getItem('jjk-gojo-completed-v3') ?? '[]');
} catch { /* Storage is optional. */ }
const completedTechniques = normalizeProgress(savedProgress, completed);
let curse: CurseKey = 'mahito';
try { const saved = localStorage.getItem('jjk-target-v1'); if (isCurseKey(saved)) curse = saved; } catch { /* Optional. */ }

export const labStore = createStore<LabState>({
  technique: 'blue', curse, incanting: false, awaitingRespawn: false, respawnReady: false, completedTechniques, stepIndex: 0, pairSpan: null,
  stage: 'menu', mode: 'tutorial', ready: false, loading: false, startingPractice: false, error: null, rendererError: null, shrineAssetStatus: 'idle',
  hint: 'Entra al campo para aprender tu primera técnica.', cameraStatus: 'Cámara apagada', backend: '',
  phase: 'ready', progress: 0, releaseProgress: 0, cooldown: 0, hands: 0, match: 0,
  inferenceFps: 0, renderFps: 0, hits: 0, countdown: 3, elapsed: 0, debug: false, debugEffect: false,
  metrics: [], tutorialComplete: completedTechniques.includes('blue'), settings: loadSettings(),
});

export function completeTechnique(key: TechniqueKey): void {
  const completedTechniques = [...new Set([...labStore.get().completedTechniques, key])];
  labStore.set({ completedTechniques, tutorialComplete: completedTechniques.includes(labStore.get().technique) });
  try {
    localStorage.setItem('jjk-lab-completed-v4', JSON.stringify(completedTechniques));
    localStorage.setItem('jjk-gojo-completed-v3', JSON.stringify(completedTechniques.filter(key => TECHNIQUES[key].character === 'gojo')));
    if (key === 'blue') localStorage.setItem('jjk-tutorial-v2', 'complete');
  } catch { /* Optional persistence. */ }
}

export function updateSettings(patch: Partial<Settings>): void {
  const settings = { ...labStore.get().settings, ...patch };
  labStore.set({ settings });
  try { localStorage.setItem('jjk-settings-v2', JSON.stringify(settings)); } catch { /* Non-blocking. */ }
}
