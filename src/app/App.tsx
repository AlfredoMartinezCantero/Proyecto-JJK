import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useStore } from '../core/store';
import { CHARACTERS, CHARACTER_KEYS, GEOMETRY, isPairPose, PAIR_LIMITS, TECHNIQUES } from '../core/techniques';
import type { CharacterKey, Pose, SinglePose, TechniqueKey } from '../core/types';
import { labStore, updateSettings } from './state';
import { LabController } from './LabController';
import { poseGuidance, POSE_REFERENCES } from '../core/poseGuidance';
import { POSE_PRECISION } from '../core/posePrecision';
import { CURSES, type CurseKey } from '../core/curses';
import { TECHNIQUE_AUDIO } from '../audio/techniqueAudio';
import { PUNCH_LIMITS } from '../core/PunchTracker';
import { isShadowPose, SHADOW_LIMITS, SHADOW_SIGNS } from '../core/shadowConfig';

const poseLabels: Record<Pose, string> = {
  'prepare-blue': 'Primero solo Azul con dos dedos; Rojo se prepara después', 'prepare-red': 'Conserva Azul y crea Rojo en la otra mano, separados',
  blue: 'Índice y corazón extendidos', red: 'Solo índice extendido', purple: 'Índice, corazón y anular extendidos',
  domain: 'Índice y corazón próximos, sin exigir cruce', split: 'Azul y Rojo con las manos separadas', merge: 'Azul y Rojo acercando las palmas sin contacto',
  blade: 'Solo índice extendido', 'slash-sweep': 'Traza hacia un lado con la punta del índice', palm: 'Cuatro dedos abiertos', fist: 'Puño cómodo',
  'cleave-spread': 'Palmas abiertas separadas', 'cleave-close': 'Acerca las palmas abiertas sin contacto',
  'flame-charge': 'Dos palmas abiertas separadas', 'flame-release': 'Puño en una mano e índice en la otra', shrine: 'Dos dedos extendidos en ambas manos próximas',
  bow: 'Índice y pulgar en L, otros tres dedos flexionados',
  strike: 'Puño cerrado: desplaza hacia un lado, frena y mantén',
  wolf: 'Índice y meñique extendidos; corazón y anular flexionados',
  hounds: 'Índice y meñique en ambas manos próximas sin contacto',
  'nue-gather': 'Reúne ambas palmas abiertas sin superponerlas',
  'nue-spread': 'Separa ambas palmas abiertas para desplegar las alas',
  'totality-gather':'Índice y meñique en ambas manos próximas', 'totality-release':'Separa ambos sellos de índice y meñique',
  'toad-sign':'Dos dedos en una mano y palma abierta en la otra, próximas',
  'elephant-gather':'Dos palmas abiertas próximas', 'elephant-release':'Puño y palma abierta separados',
  'rabbit-sign':'Índice y corazón en ambas manos próximas', ritual:'Dos puños cómodos separados y visibles',
  'chimera-gather':'Dos puños cómodos próximos, sin contacto', 'chimera-release':'Abre y separa ambas palmas',
};
function TechniqueHand({ pose = 'blue', detailed = false }: { pose?: Pose; detailed?: boolean }) {
  const hand = (input: SinglePose) => {
    const shape = input === 'prepare-blue' ? 'blue' : input;
    const count = ['red', 'blade', 'slash-sweep', 'bow'].includes(shape) ? 1 : shape === 'purple' ? detailed ? 2 : 3 : shape === 'palm' ? 4 : shape === 'fist' || shape === 'strike' ? 0 : 2;
    const xs = shape === 'domain' ? [50, 63, 84, 103] : [41, 62, 83, 104];
    const extended = xs.map((_,i) => shape === 'wolf' ? i === 0 || i === 3 : i < count);
    return <g stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity=".09">
      <path d={detailed && ['blue', 'red', 'domain'].includes(shape) ? 'M40 143L35 109L38 79Q75 68 116 81L115 118L103 143Z' : 'M40 143L35 109L17 87Q11 76 21 72L38 89L38 79Q75 68 116 81L115 118L103 143Z'} />
      {xs.map((x, i) => detailed && shape === 'domain' && i < 2 ? <path key={i}
        d={i === 0 ? 'M55 88L55 62Q58 42 76 21' : 'M71 88L71 61Q70 44 58 24'} strokeWidth="13" strokeLinecap="round" fill="none" /> : <g key={i}><rect x={x} y={extended[i] ? 16 - (i === 1 ? 9 : 0) : 76} width="12" height={extended[i] ? 76 : 26} rx="6" />
        <circle cx={x + 6} cy={extended[i] ? 53 : 86} r="2.5" fillOpacity="1" stroke="none" /></g>)}
      {detailed && ['blue', 'red', 'domain'].includes(shape) && <path d="M38 112Q47 86 85 91Q92 98 83 103L53 113" />}
      <path d="M46 113Q71 103 101 117" fill="none" opacity=".5" />
    </g>;
  };
  const pair = isPairPose(pose);
  const shadow = isShadowPose(pose) ? SHADOW_SIGNS[pose] : null;
  const openPair = ['cleave-spread', 'cleave-close', 'flame-charge', 'nue-gather', 'nue-spread'].includes(pose);
  const left: SinglePose = shadow ? shadow[0] : openPair ? 'palm' : pose === 'flame-release' ? 'fist' : 'blue';
  const right: SinglePose = shadow ? shadow[1] : openPair ? 'palm' : pose === 'flame-release' ? detailed ? 'bow' : 'blade' : pose === 'shrine' ? 'blue' : 'red';
  const shadowLabel = (sign:SinglePose) => sign==='wolf'?'OREJAS':sign==='fist'?'PUÑO':sign==='blue'?'2 DEDOS':'PALMA';
  return <svg className="gesture-illustration" viewBox="0 0 140 160" role="img" aria-label={poseGuidance(pose, detailed ? 'detailed' : 'standard') ?? poseLabels[pose]}>
    <circle cx="70" cy="80" r="64" fill="none" stroke="currentColor" opacity=".12" />
    {pair ? <><g transform="translate(-4 28) scale(.56)" style={{ color: '#d1dce3' }}>{hand(left)}</g>
      <g transform="translate(66 28) scale(.56)" style={{ color: '#ffb2af' }}>{hand(right)}</g>
      <text x="30" y="135" fontSize="8" fill="currentColor" textAnchor="middle">{shadow ? shadowLabel(left) : openPair ? 'PALMA' : pose === 'flame-release' ? 'PUÑO' : pose === 'shrine' ? '2 DEDOS' : 'AZUL'}</text>
      <text x="108" y="135" fontSize="8" fill="currentColor" textAnchor="middle">{shadow ? shadowLabel(right) : openPair ? 'PALMA' : pose === 'flame-release' ? detailed ? 'ÍNDICE + PULGAR' : 'ÍNDICE' : pose === 'shrine' ? '2 DEDOS' : 'ROJO'}</text>
      {(['merge','cleave-close','shrine'].includes(pose)||isShadowPose(pose)&&SHADOW_LIMITS[pose].max<4) && <path d="M51 123L62 123M58 119L62 123L58 127M89 123L78 123M82 119L78 123L82 127" stroke="currentColor" fill="none" />}
      {isShadowPose(pose)&&SHADOW_LIMITS[pose].min>=3 && <path d="M62 123H46L50 119M46 123L50 127M78 123H94L90 119M94 123L90 127" stroke="currentColor" fill="none" />}</> : hand(pose as SinglePose)}
    {['slash-sweep', 'strike'].includes(pose) && <path d="M20 153H120M112 147L120 153L112 159" stroke="currentColor" fill="none" />}
  </svg>;
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="lab-modal" onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="modal-heading"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Cerrar">×</button></div>
    {children}
  </dialog>;
}

const phaseNames = { ready: 'Preparación', holding: 'Concentrando', paused: 'Sin seguimiento', cooldown: 'Técnica activada', release: 'Liberación' };

export function App() {
  const state = useStore(labStore);
  const technique = TECHNIQUES[state.technique], step = technique.steps[state.stepIndex] ?? technique.steps[0];
  const detailed = state.settings.gesturePrecision === 'detailed', poseReference = POSE_REFERENCES[state.technique];
  const detailedGuidance = poseGuidance(step.pose, state.settings.gesturePrecision);
  const guideInstructions = detailed && state.technique === 'domain'
    ? ['Palma visible hacia la cámara.', 'Cruza índice y corazón solo si te resulta cómodo; flexiona anular y meñique.',
      'Recoge el pulgar sobre la palma, sin apretar.', 'Si los dedos quedan ocultos o no se detectan, elige la postura jugable.']
    : detailed && state.technique === 'red' ? ['Palma visible hacia la cámara.', 'Extiende solo el índice.',
      'Flexiona corazón, anular y meñique; recoge el pulgar sobre ellos.'] : detailed && ['fusion', 'purple'].includes(state.technique)
      ? ['Primero solo Azul con índice y corazón, pulgar recogido; mantén 3,2 s.',
        'Conserva Azul y prepara Rojo en la otra mano con solo índice y pulgar recogido; mantén 2,8 s, separados.',
        'Después acerca las palmas sin contacto para fusionar.',
        ...(state.technique === 'purple' ? ['En la mano de Azul conserva índice y corazón; abre el pulgar. Anular y meñique siguen flexionados.'] : [])]
      : detailed && state.technique === 'flame' ? ['Empieza con dos palmas abiertas separadas.',
        'Una mano forma un puño cómodo como al tirar de una cuerda.',
        'La otra extiende índice y pulgar en L; flexiona corazón, anular y meñique. Mantén ambas manos visibles.'] : technique.instructions;
  const character = CHARACTERS[technique.character], catalog = character.techniques;
  const targetPicker = <label className="target-picker"><span>MALDICIÓN OBJETIVO</span><select aria-label="Seleccionar maldición objetivo" value={state.curse}
    onChange={e => controller.current?.selectCurse(e.target.value as CurseKey)}>{Object.entries(CURSES).map(([key, curse]) => <option key={key} value={key}>{curse.name}</option>)}</select><small>{CURSES[state.curse].detail}</small></label>;
  const techniqueNumber = catalog.findIndex(t => t.key === state.technique) + 1;
  const seconds = (value: number) => (value / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 });
  const releaseInstruction = technique.handCount === 2 ? 'Abre ambas manos y mantenlas visibles.' : 'Abre la mano y mantenla visible.';
  const host = useRef<HTMLDivElement>(null), video = useRef<HTMLVideoElement>(null), skeleton = useRef<HTMLCanvasElement>(null);
  const controller = useRef<LabController | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [references, setReferences] = useState<Partial<Record<TechniqueKey, { url: string; name: string }>>>({});
  const reference = references[state.technique] ?? null;
  const [referenceOpen, setReferenceOpen] = useState(false);
  const [resourceError, setResourceError] = useState('');
  const [audioNames, setAudioNames] = useState<Partial<Record<TechniqueKey, string>>>({});
  const audioName = audioNames[state.technique] ?? '';
  const [cameraAspect, setCameraAspect] = useState(4 / 3);
  const clipURLs = useRef(new Map<TechniqueKey, string>());
  useEffect(() => {
    const lab = new LabController(host.current!, video.current!, skeleton.current!); controller.current = lab;
    return () => { lab.dispose(); controller.current = null; clipURLs.current.forEach(url => URL.revokeObjectURL(url)); };
  }, []);
  const practicing = state.stage === 'practice', inMenu = state.stage === 'menu';
  const percentage = Math.round(Math.max(0, Math.min(1, state.progress)) * 100);
  const elapsed = `${Math.floor(state.elapsed / 60000).toString().padStart(2, '0')}:${Math.floor(state.elapsed / 1000 % 60).toString().padStart(2, '0')}`;

  function openReference(file?: File) {
    if (file) {
      if (!file.type.startsWith('video/')) { setResourceError('Selecciona un archivo de vídeo.'); return; }
      const previous = clipURLs.current.get(state.technique);
      if (previous) URL.revokeObjectURL(previous);
      const url = URL.createObjectURL(file); clipURLs.current.set(state.technique, url);
      setReferences(current => ({ ...current, [state.technique]: { url, name: file.name } }));
    }
    if (file || reference) { controller.current?.guide(); setResourceError(''); setReferenceOpen(true); }
  }
  function beginPractice() { setReferenceOpen(false); controller.current?.begin(); }
  function selectTechnique(key: TechniqueKey) {
    setReferenceOpen(false); setResourceError(''); controller.current?.selectTechnique(key);
  }
  function selectCharacter(key: CharacterKey) {
    setReferenceOpen(false); setResourceError(''); controller.current?.selectCharacter(key);
  }

  return <div className={`lab-app character-${technique.character}`} style={{ '--blue': technique.color } as CSSProperties}>
    <header className={`app-header ${inMenu ? 'selecting-character' : ''}`}>
      <button className="lab-brand" onClick={() => controller.current?.menu()} aria-label="Jujutsu Gesture Lab, volver al inicio">
        <span className="brand-seal" aria-hidden="true">呪</span><span>JUJUTSU<small>GESTURE LAB</small></span>
      </button>
      {inMenu ? <nav className="character-tabs" aria-label="Elegir personaje">{CHARACTER_KEYS.map(key => <button key={key} aria-pressed={key === technique.character} className={key === technique.character ? 'is-selected' : ''} onClick={() => selectCharacter(key)}>{CHARACTERS[key].monogram} <span>{CHARACTERS[key].shortName}</span></button>)}</nav> : <div className="header-center"><span className="live-dot" /> {character.shortName.toUpperCase()} <span className="header-divider">/</span> NUI LAB</div>}
      <nav aria-label="Herramientas"><a href="/project.txt" target="_blank" rel="noreferrer">El proyecto ↗</a>
        <button className="text-button" onClick={() => { controller.current?.pause(); setSettingsOpen(true); }}>Ajustes <span aria-hidden="true">⚙</span></button></nav>
    </header>

    <main className={`playfield ${inMenu ? 'is-menu' : ''} ${technique.steps.length > 1 ? 'has-sequence' : ''}`}>
      <div ref={host} className="scene-host" />
      <div className="scene-vignette" aria-hidden="true" />
      <div className="scene-caption"><span className="caption-cross">＋</span><div>CAMPO DE ENTRENAMIENTO<small>PATIO DE BARRERA · ESCENARIO VIRTUAL</small></div></div>
      <div className="world-label" aria-hidden="true">{technique.character === 'gojo' ? '無限' : technique.character === 'yuji' ? '黒閃' : technique.character === 'megumi' ? '十影' : '宿儺'}<span>{character.shortName.toUpperCase()} / TRAINING GROUNDS</span></div>

      {inMenu && <section className="entry-panel" aria-labelledby="entry-title">
        <p className="kicker"><span>01</span> APRENDE A CONTROLAR TU ENERGÍA</p>
        <h1 id="entry-title">LA TÉCNICA ESTÁ<br />EN TUS <em>MANOS.</em></h1>
        <p className="entry-copy">{technique.description}<br />Tus manos reales controlan la técnica.</p>
        <div className="character-card"><span className="character-monogram">{character.monogram}</span><div><small>PERSONAJE SELECCIONADO</small><h2>{character.name}</h2><p>{character.trait} / {technique.name}</p></div><span className="availability">{technique.difficulty.toUpperCase()}</span></div>
        <button className="primary-button entry-action" disabled={!!state.rendererError} onClick={() => controller.current?.enter('tutorial')}>
          Comenzar tutorial <span>↗</span>
        </button>
        <button className="free-button" disabled={!state.tutorialComplete || !!state.rendererError} onClick={() => controller.current?.enter('free')}>
          <span>{state.tutorialComplete ? '↻ Entrenamiento libre' : '⌑ Entrenamiento libre'}</span><small>{state.tutorialComplete ? technique.name.toUpperCase() + ' DESBLOQUEADO' : 'COMPLETA ESTE TUTORIAL'}</small>
        </button>
        <div className="entry-facts"><span>◎ Webcam</span><span>✦ {technique.handCount} {technique.handCount === 1 ? 'mano' : 'manos'} en 3D</span><span>◈ Procesamiento local</span></div>
        <p className="entry-note">{state.ready ? 'La cámara sigue activa. Puedes apagarla en Ajustes.' : state.loading ? 'Preparando la cámara…' : 'La cámara se activa al comenzar. Sin micrófono.'}</p>
      </section>}

      {inMenu && <nav className="catalog-panel" aria-label={`Seleccionar técnica de ${character.shortName}`}><div className="panel-topline"><span>{character.title}</span><span>{catalog.length.toString().padStart(2, '0')} ENTRENAMIENTOS</span></div>
        <h2>ELIGE TU TÉCNICA.</h2><p>Selecciona un tutorial o continúa practicando.</p>
        {targetPicker}
        {catalog.map((item, i) => <button key={item.key} className={`catalog-technique ${item.key === state.technique ? 'is-selected' : ''}`}
          aria-pressed={item.key === state.technique} onClick={() => selectTechnique(item.key)} style={{ '--card-color': item.color } as CSSProperties}>
          <span className="catalog-number">0{i + 1}</span><span><b>{item.name}</b><small>{item.subtitle}</small></span>
          <span className="catalog-mark">{state.completedTechniques.includes(item.key) ? '✓' : '↗'}</span></button>)}
        <small className="catalog-note">Gestos adaptados para webcam.<br />{catalog.filter(t => state.completedTechniques.includes(t.key)).length} / {catalog.length} tutoriales de {character.shortName} completados.</small>
      </nav>}

      {!inMenu && <div className="session-topbar">
        <button className="back-button" onClick={() => controller.current?.menu()}>← Salir</button>
        <div className="technique-heading"><small>{character.shortName.toUpperCase()} / ENTRENAMIENTO 0{techniqueNumber}</small><h1><span>{technique.title.toUpperCase()}</span></h1></div>
        <span className="session-mode">{state.mode === 'tutorial' ? 'TUTORIAL' : 'LIBRE'}</span>
      </div>}

      {state.stage === 'guide' && <aside className="guide-panel" aria-label="Guía de la técnica">
        <div className="panel-topline"><span>ANTES DE EMPEZAR</span><span>{technique.handCount} {technique.handCount === 1 ? 'MANO' : 'MANOS'}</span></div>
        {targetPicker}
        <TechniqueHand pose={technique.steps[0].pose} detailed={detailed && technique.character!=='megumi' && state.technique !== 'blue' && state.technique !== 'shrine'} />
        <div className="guide-heading"><span className="step-number">0{techniqueNumber}</span><h2>{technique.name.toUpperCase()}.<br />{technique.handCount === 2 ? 'DOS MANOS.' : 'UNA INTENCIÓN.'}</h2></div>
        <ol className="gesture-instructions">{guideInstructions.map(text => <li key={text}>{text}</li>)}</ol>
        {technique.steps.length > 1 && <div className="sequence-guide">{technique.steps.map((item, i) => <div key={item.pose}><span>0{i + 1}</span><b>{item.label}</b><small>{seconds(item.holdMs)} s</small></div>)}<p>{technique.character === 'yuji' ? 'Tienes 3 s para desplazar el puño. Frena y conserva la postura 0,5 s; sin golpear ni avanzar hacia la cámara.' : state.technique === 'dismantle' ? 'Traza con la punta del índice hacia cualquier lado en 3 s. Frena suavemente al terminar.' : 'Máximo 10 s entre pasos. Sin contacto ni superposición.'}</p></div>}
        <div className="gesture-timings"><div><strong>{technique.steps.length > 1 ? seconds(Math.min(...technique.steps.map(s => s.holdMs))) + '–' + seconds(Math.max(...technique.steps.map(s => s.holdMs))) : seconds(technique.timing.holdMs)}<span>s</span></strong><small>{technique.steps.length > 1 ? 'POR PASO' : 'MANTENER'}</small></div><div><strong>{seconds(technique.timing.cooldownMs)}<span>s</span></strong><small>RECUPERAR</small></div><div><strong>{seconds(technique.timing.releaseMs)}<span>s</span></strong><small>{technique.handCount === 2 ? 'ABRIR AMBAS' : 'ABRIR MANO'}</small></div></div>
        {detailedGuidance && <p className="pose-detail">{detailedGuidance}</p>}
        <div className="pose-reference"><a href={poseReference.url} target="_blank" rel="noreferrer">{poseReference.scene} ↗</a><p>{poseReference.note}</p>
          <label>Postura de los dedos<select aria-label="Postura de los dedos" value={state.settings.gesturePrecision} onChange={e => updateSettings({ gesturePrecision: e.target.value as 'standard' | 'detailed' })}>
            <option value="standard">Jugable</option><option value="detailed">Detallada · experimental</option></select></label></div>
        <button className="primary-button" disabled={!!state.rendererError || state.startingPractice} aria-busy={state.startingPractice} onClick={beginPractice}>
          {state.startingPractice ? 'Preparando partida…' : state.error ? 'Reintentar y jugar' : `Jugar: ${technique.name}`} <span>↗</span></button>
        {state.startingPractice && <button className="text-button camera-action" onClick={() => controller.current?.guide()}>Cancelar inicio</button>}
        <p className={`camera-status ${state.ready ? 'is-ready' : ''}`} role="status">{state.cameraStatus}</p>
        {state.technique === 'shrine' && <div role="status">
          <p className={`camera-status ${state.shrineAssetStatus === 'ready' ? 'is-ready' : ''}`}>
            {state.shrineAssetStatus === 'ready' ? 'Santuario listo · aparición y oleadas de cortes' : state.shrineAssetStatus === 'error'
              ? 'No se pudo cargar el santuario. Se usará una versión simplificada.' : 'Preparando el santuario…'}</p>
          {state.shrineAssetStatus === 'error' && <button className="text-button" onClick={() => controller.current?.retryShrineModel()}>Reintentar carga del santuario</button>}
        </div>}
        <div className="local-resources"><label className="file-button">＋ Vídeo de referencia<input key={state.technique} type="file" accept="video/*" onChange={event => openReference(event.target.files?.[0])} /></label>
          {reference && <button className="reference-link" onClick={() => openReference()}>Ver {reference.name} ↗</button>}
          {resourceError && <p className="resource-name" role="alert">{resourceError}</p>}
          <small>Opcional: usa un clip propio o esta guía.</small></div>
      </aside>}

      {practicing && <>
        <section className="practice-objective" aria-label="Objetivo de la sesión"><small>{state.mode === 'tutorial' ? 'TU PRIMERA TÉCNICA' : 'PRÁCTICA LIBRE'}</small>
          <h2>{state.mode === 'tutorial' ? `${state.technique === 'fusion' ? 'Completa' : 'Activa'} ${technique.name} ${technique.tutorialGoal} ${technique.tutorialGoal === 1 ? 'vez' : 'veces'}.` : 'Concentra. Activa. Repite.'}</h2>
          <div className="hit-counter">{state.mode === 'tutorial' ? Array.from({ length: technique.tutorialGoal }, (_, i) =>
            <span key={i} className={i < state.hits ? 'hit-done' : ''}>{i < state.hits ? '✓' : `0${i + 1}`}</span>) : <strong>{state.hits}<small> ACTIVACIONES</small></strong>}</div>
        </section>
        {!state.awaitingRespawn && <aside className="mini-guide"><TechniqueHand pose={step.pose} detailed={detailed && technique.character!=='megumi' && state.technique !== 'blue' && state.technique !== 'shrine'} /><div><small>GESTO / PASO {state.stepIndex + 1}</small><b>{state.incanting ? 'Invocación' : step.label}</b><span>{state.incanting ? 'Gestos completados. Puedes bajar las manos.' : detailedGuidance ?? poseLabels[step.pose]}</span><small>{state.incanting ? 'PREPARANDO EL LANZAMIENTO' : `${detailedGuidance ? 'POSTURA DETALLADA' : 'ADAPTACIÓN JUGABLE'} · ${seconds(step.holdMs)} s`}</small></div></aside>}
        {technique.steps.length > 1 && <section className="sequence-hud" aria-label="Secuencia de la técnica"><div>{technique.steps.map((item, i) => <span key={item.pose} className={state.phase === 'cooldown' || state.phase === 'release' || i < state.stepIndex ? 'is-done' : i === state.stepIndex ? 'is-current' : ''}>{i + 1}. {item.label}</span>)}</div><p>{state.phase === 'cooldown' ? 'Secuencia completada. Espera la recuperación.' : state.phase === 'release' ? releaseInstruction : detailedGuidance ?? step.instruction}</p></section>}
        <div className="practice-actions"><button onClick={() => controller.current?.pause()}>Ⅱ Pausar</button><button onClick={() => controller.current?.guide()}>Ver guía</button></div>
        <section className="energy-hud" aria-label="Estado del reconocimiento">
          <div className="energy-label"><span className="live-dot" /><b>{state.incanting ? 'Invocación' : state.phase === 'holding' ? step.label : phaseNames[state.phase]}</b><span>{state.phase === 'cooldown' ? `${(state.cooldown / 1000).toFixed(1)} s` : state.phase === 'release' ? `${Math.round(state.releaseProgress * 100)}%` : `${percentage}%`}</span></div>
          <progress max={1} value={state.phase === 'release' ? state.releaseProgress : state.progress} aria-label={state.phase === 'release' ? 'Progreso de liberación' : 'Energía acumulada'} />
          <p role="status">{state.hint}</p>
        </section>
      </>}

      {state.incanting && !practicing && <div className="incantation-status" role="status">Invocación · vista previa sin reconocimiento</div>}
      {state.stage === 'countdown' && <div className="center-message countdown-message" role="status"><small>PREPARA EL GESTO</small><strong>{state.countdown || 'YA'}</strong><p>Sin forzar. Mano completa y luz frontal.</p></div>}
      {state.stage === 'paused' && <section className="center-message pause-message"><span className="pause-symbol">Ⅱ</span><p className="kicker">TÓMATE TU TIEMPO</p><h2>PRÁCTICA EN PAUSA</h2><p>La pausa no acumula energía.</p>
        <button className="primary-button" disabled={!!state.rendererError} onClick={beginPractice}>Reanudar <span>↗</span></button>
        <button className="text-button" onClick={() => controller.current?.guide()}>Volver a la guía</button></section>}
      {state.stage === 'complete' && <section className="center-message completion-message"><div className="completion-seal">無</div><p className="kicker">TUTORIAL COMPLETADO</p><h2>{technique.name.toUpperCase()}.<br /><em>BAJO CONTROL.</em></h2><p>Has completado {technique.name} {state.hits} {state.hits === 1 ? 'vez' : 'veces'} con tu gesto.</p>
        <div className="completion-stats"><span><b>{elapsed}</b>TIEMPO ACTIVO</span><span><b>{state.hits}</b>ACTIVACIONES</span></div>
        <button className="primary-button" onClick={() => controller.current?.enter('free')}>Entrenamiento libre <span>↗</span></button>
        <button className="text-button" onClick={() => controller.current?.enter('tutorial')}>Repetir tutorial</button><button className="text-button" onClick={() => controller.current?.menu()}>Elegir otra técnica</button></section>}

      <div className="camera-preview" hidden={inMenu || !state.settings.showCamera || (!state.ready && !state.loading)} style={{ aspectRatio: cameraAspect }}>
        <video ref={video} autoPlay playsInline muted onLoadedMetadata={() => setCameraAspect(video.current!.videoWidth / video.current!.videoHeight)} />
        <canvas ref={skeleton} hidden={!state.settings.showSkeleton} />
        <span className="preview-label"><i /> WEBCAM LOCAL</span>
        <span className="preview-hands">{state.hands} / 2 MANOS</span>
        <button className="preview-camera-off" onClick={() => controller.current?.disconnect()} aria-label="Apagar cámara" title="Apagar cámara">⏻</button>
      </div>
      {state.debugEffect && <div className="debug-watermark" role="status">DEPURACIÓN · EFECTO SIN RECONOCIMIENTO</div>}
      {state.awaitingRespawn && <section className="respawn-panel" aria-label="Respawn de la maldición">
        <small>{state.respawnReady ? 'RESULTADO DEL ATAQUE' : 'TÉCNICA EN CURSO'}</small>
        <p>{state.respawnReady ? 'La maldición conservará este estado hasta que la respawnees.' : 'Espera a que termine la animación.'}</p>
        <button className="primary-button" disabled={!state.respawnReady} onClick={() => controller.current?.respawnCurse()}>Respawnear maldición <span>↻</span></button>
      </section>}
      {(state.error || state.rendererError) && <div className="error-notice" role="alert"><b>{state.rendererError ? 'Escenario no disponible' : 'Revisa la webcam'}</b><p>{state.rendererError ?? state.error}</p>
        {!state.rendererError && <button onClick={() => { controller.current?.guide(); controller.current?.begin(); }}>Reintentar y jugar</button>}</div>}

      <div className="field-footer"><span><i /> LOCAL VISION <b>{state.ready ? `${state.backend} · ${state.inferenceFps} INF/S` : state.loading ? 'PREPARANDO CÁMARA' : 'CÁMARA APAGADA'}</b></span>
        <span>{state.renderFps} FPS <span className="footer-separator">/</span> WEBGL 2</span><span>JJK LAB <b>v0.6</b></span></div>
    </main>

    <footer className="app-footer"><span>JUJUTSU GESTURE LAB <b>／</b> PROYECTO EXPERIMENTAL DE FANS</span><span>ESCENARIO VIRTUAL · SIN ANCLAJE A TU HABITACIÓN</span><button className="text-button" onClick={() => { controller.current?.pause(); setSettingsOpen(true); }}>NUI LAB ↗</button></footer>

    {settingsOpen && <Modal title="AJUSTES / NUI LAB" onClose={() => setSettingsOpen(false)}>
      <p className="modal-intro">Ajusta el campo a tu equipo. Solo los ajustes y el tutorial completado se guardan en este navegador.</p>
      {targetPicker}
      <div className="switch-row"><span>Cámara<small>{state.loading ? 'Preparando el seguimiento…' : state.ready ? 'Activa; se mantiene al cambiar de técnica.' : 'Apagada; Jugar la activa automáticamente.'}</small></span><button className="camera-power-button" onClick={() => state.ready || state.loading ? controller.current?.disconnect() : controller.current?.connect()}>{state.loading ? 'Cancelar cámara' : state.ready ? 'Apagar cámara' : 'Activar cámara'}</button></div>
      <div className="setting-row"><label htmlFor="volume">Volumen</label><input id="volume" type="range" min="0" max="1" step=".05" value={state.settings.volume} onChange={e => updateSettings({ volume: +e.target.value })} /><output>{Math.round(state.settings.volume * 100)}%</output></div>
      <div className="setting-row"><label htmlFor="intensity">Intensidad visual</label><input id="intensity" type="range" min="0" max="1" step=".05" value={state.settings.intensity} onChange={e => updateSettings({ intensity: +e.target.value })} /><output>{Math.round(state.settings.intensity * 100)}%</output></div>
      <label className="switch-row"><span>Postura de los dedos<small>Detallada: pulgar en Rojo, cruce en el dominio de Gojo, cambio de pulgar en Púrpura y mano del arco de Fuga. Cada guía indica su referencia y adaptación.</small></span><select value={state.settings.gesturePrecision} onChange={e => updateSettings({ gesturePrecision: e.target.value as 'standard' | 'detailed' })}><option value="standard">Jugable</option><option value="detailed">Detallada · experimental</option></select></label>
      <label className="switch-row"><span>Reducir destellos y resplandor<small>Activado inicialmente.</small></span><input type="checkbox" checked={state.settings.reducedFlashes} onChange={e => updateSettings({ reducedFlashes: e.target.checked })} /></label>
      <label className="switch-row"><span>Mostrar mi webcam<small>La vista previa está reflejada.</small></span><input type="checkbox" checked={state.settings.showCamera} onChange={e => updateSettings({ showCamera: e.target.checked })} /></label>
      <label className="switch-row"><span>Esqueleto de las manos<small>Puntos reales sobre la webcam y la malla 3D.</small></span><input type="checkbox" checked={state.settings.showSkeleton} onChange={e => updateSettings({ showSkeleton: e.target.checked })} /></label>
      <label className="switch-row"><span>Calidad gráfica<small>Ligera reduce partículas, fragmentos y resolución; desactiva bloom y distorsión.</small></span><select value={state.settings.quality} onChange={e => updateSettings({ quality: e.target.value as 'high' | 'low' })}><option value="high">Alta</option><option value="low">Ligera</option></select></label>
      <label className="file-button audio-upload">♫ Audio propio: {technique.name}<input key={state.technique} type="file" accept="audio/*" onChange={e => { const file = e.target.files?.[0]; if (file) { controller.current?.setAudio(file); setAudioNames(current => ({ ...current, [state.technique]: file.name })); } }} /></label>
      <p className="resource-name">{audioName || (TECHNIQUE_AUDIO[state.technique]
        ? `Audio incluido: ${TECHNIQUE_AUDIO[state.technique]!.label}. Puedes sustituirlo durante esta sesión.`
        : technique.character === 'megumi' ? 'Sonidos de invocación e impacto sintetizados. Puedes añadir un audio local.' : technique.character === 'yuji' ? 'Impactos sintetizados en los contactos del golpe. Puedes añadir un audio local.' : 'Sin archivo: tono sintetizado. Recursos locales de esta sesión.')}</p>
      <label className="switch-row debug-switch"><span>Depuración del reconocimiento</span><input type="checkbox" checked={state.debug} onChange={e => labStore.set({ debug: e.target.checked })} /></label>
      {state.debug && <div className="debug-panel"><dl><div><dt>Render</dt><dd>{state.renderFps} FPS</dd></div><div><dt>Inferencia</dt><dd>{state.inferenceFps}/s · {state.backend || 'Sin motor'}</dd></div><div><dt>Estado</dt><dd>{state.phase}</dd></div><div><dt>Coincidencia geométrica</dt><dd>{Math.round(state.match * 100)}%</dd></div></dl>
        <p>La coincidencia es una métrica geométrica, no una probabilidad de acierto calibrada. La prueba visual no puntúa.</p>
        <button disabled={state.stage === 'practice' || state.stage === 'countdown'} onClick={() => { controller.current?.testEffect(); setSettingsOpen(false); }}>Probar efecto · depuración</button>
        <button disabled={state.stage === 'practice' || state.stage === 'countdown'} onClick={() => { controller.current?.testEffect(true); setSettingsOpen(false); }}>Probar impacto con objetivo · depuración</button>
        <pre>{JSON.stringify({ technique: state.technique, precision: state.settings.gesturePrecision, step: state.stepIndex, hands: state.hands, span: state.pairSpan, metrics: state.metrics, thresholds: GEOMETRY, detailedThresholds: POSE_PRECISION, pairLimits: PAIR_LIMITS, ...(technique.character === 'megumi' ? { shadowLimits: SHADOW_LIMITS } : {}), ...(technique.character === 'yuji' ? { punchLimits: PUNCH_LIMITS } : {}), timing: technique.timing }, null, 2)}</pre></div>}
      <p className="privacy-note">Webcam y recursos procesados localmente. Sin grabación, subida de imágenes ni micrófono. El modelo y WASM se descargan durante la instalación.</p>
    </Modal>}

    {referenceOpen && reference && <Modal title="REFERENCIA LOCAL" onClose={() => setReferenceOpen(false)}>
      <video className="reference-video" src={reference.url} controls autoPlay playsInline onEnded={beginPractice} onError={() => setResourceError('No se puede reproducir este formato. Prueba MP4 H.264 o continúa con la guía.')} />
      <p className="resource-name">{reference.name}</p>{resourceError && <p role="alert">{resourceError}</p>}
      <button className="primary-button" onClick={beginPractice}>Omitir y jugar <span>↗</span></button>
    </Modal>}
  </div>;
}
