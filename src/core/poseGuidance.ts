import type { GesturePrecision, Pose, TechniqueKey } from './types';

export function poseGuidance(pose: Pose, precision: GesturePrecision): string | null {
  if (precision !== 'detailed') return null;
  if (pose === 'prepare-blue') return 'Primero solo Azul: índice y corazón extendidos, pulgar recogido. Prepara Rojo después.';
  if (pose === 'prepare-red') return 'Conserva Azul en la mano original y forma Rojo con solo índice en la otra; ambos pulgares recogidos.';
  if (pose === 'red') return 'Solo índice extendido; pulgar recogido sobre los dedos flexionados.';
  if (pose === 'domain') return 'Índice y corazón cruzados suavemente; pulgar recogido. Si se ocultan, usa el modo jugable.';
  if (pose === 'split' || pose === 'merge') return 'Azul con dos dedos, Rojo con índice. Recoge ambos pulgares durante la preparación.';
  if (pose === 'purple') return 'Extiende índice y corazón; flexiona anular y meñique. Abre el pulgar para proyectar.';
  if (pose === 'bow' || pose === 'flame-release') return 'Una mano tira con puño cómodo; la otra forma una L con índice y pulgar. Mantén las dos visibles.';
  return null;
}
export const POSE_REFERENCES: Record<TechniqueKey, { scene: string; note: string; url: string }> = {
  totality:{scene:'Lobos de Jade: Totalidad · referencia aportada',note:'El lobo bípedo y sus garras se interpretan en código. La secuencia de sellos separados es una adaptación para webcam.',url:'https://jujutsu-kaisen.fandom.com/es/wiki/Lobos_de_Jade:_Totalidad'},
  toad:{scene:'Sapo · referencia aportada',note:'Adaptación con dos dedos y una palma separados; se evita entrelazar o superponer manos.',url:'https://jujutsu-kaisen.fandom.com/es/wiki/Sapo'},
  'max-elephant':{scene:'Elefante Máximo · referencia aportada',note:'Palmas próximas y después puño/palma separados. Se adapta el sello para no ocultar los dedos.',url:'https://jujutsu-kaisen.fandom.com/es/wiki/Elefante_M%C3%A1ximo'},
  'rabbit-escape':{scene:'Estampida de Conejos · referencia aportada',note:'Dos dedos en ambas manos representan las orejas, sin contacto. Es una adaptación; la estampida distrae y no hiere al objetivo.',url:'https://jujutsu-kaisen.fandom.com/es/wiki/Estampida_de_Conejos'},
  mahoraga:{scene:'Mahoraga · ritual de invocación',note:'Dos puños visibles separados adaptan el ritual. La rueda y el ataque están escenificados; no se simulan domesticación ni adaptación automática a ataques.',url:'https://jujutsu-kaisen.fandom.com/es/wiki/General_Divino_de_las_Ochos_Hojas_Divergentes_del_Sila:_Demonio_Mahoraga'},
  'chimera-garden':{scene:'Jardín Azabache de las Quimeras · referencia aportada',note:'Puños próximos y apertura de palmas adaptan la expansión. Se representa un campo fluido abierto con dobles y shikigamis, sin barrera cerrada.',url:'https://jujutsu-kaisen.fandom.com/es/wiki/Jard%C3%ADn_Azabache_de_las_Quimeras'},
  'divine-dogs': { scene: 'Megumi · Diez Sombras', note: 'Índice y meñique en dos manos separadas: adaptación jugable del sello de sombra, sin dedos entrelazados ni contacto certificado.', url: 'https://jujutsukaisen.jp/character/shibuyajihen.php' },
  nue: { scene: 'Megumi · shikigami, episodio 18', note: 'La apertura de las dos palmas adapta el despliegue de alas. No reproduce el sello con muñecas cruzadas ni verifica dedos ocultos.', url: 'https://jujutsukaisen.jp/episodes/18.php' },
  divergent: { scene: 'Yuji · combate contra Mahito, episodio 13', note: 'Puño y desplazamiento lateral: adaptación jugable. La cámara no mide un golpe ni contacto físico.', url: 'https://jujutsukaisen.jp/episodes/13.php' },
  'black-flash': { scene: 'Yuji · Destello Negro, episodio 19', note: 'Adaptación de preparación y desplazamiento del puño. No verifica la sincronía microscópica ni la fuerza del golpe.', url: 'https://jujutsukaisen.jp/episodes/19.php' },
  blue: { scene: 'Gojo contra Toji · episodio 28', note: 'Dos dedos: adaptación jugable. No se ha verificado un sello único de Azul.', url: 'https://jujutsukaisen.jp/episodes/28.php' },
  red: { scene: 'Gojo · referencia de la mano: episodio 7', note: 'Índice y pulgar recogido, contrastados con la imagen oficial. La orientación se adapta a la webcam.', url: 'https://jujutsukaisen.jp/images/episodes/7-10.jpg' },
  fusion: { scene: 'Gojo contra Toji · episodio 28', note: 'La secuencia de dos manos se adapta para mantener los dedos visibles.', url: 'https://jujutsukaisen.jp/episodes/28.php' },
  purple: { scene: 'Púrpura · variante de proyección de SEGA', note: 'Detallada: índice, corazón y pulgar abiertos, contrastados con la figura oficial de SEGA. La secuencia contra Toji sigue adaptada; Jugable conserva el final de tres dedos.', url: 'https://segaplaza.jp/prize/D122722/' },
  domain: { scene: 'Vacío Infinito · referencia oficial del sello', note: 'Modo detallado: cruce proyectado de índice y corazón. La cámara no verifica contacto ni qué dedo pasa por delante.', url: 'https://jujutsukaisen.jp/jf2026/jf_goods103.php' },
  dismantle: { scene: 'Sukuna en Shibuya · episodio 40', note: 'El barrido con índice es una adaptación jugable, no un sello original certificado.', url: 'https://jujutsukaisen.jp/episodes/40.php' },
  cleave: { scene: 'Sukuna en Shibuya · episodio 41', note: 'Se adapta el cierre de las manos para evitar superposición y pérdida del seguimiento.', url: 'https://jujutsukaisen.jp/episodes/41.php' },
  flame: { scene: 'Sukuna en Shibuya · episodio 40', note: 'Detallada aproxima la L de índice y pulgar de la mano del arco, visible en el fotograma oficial. La mano que tira se adapta a un puño y no se verifica el contacto con una cuerda.', url: 'https://jujutsukaisen.jp/images/episodes/40-2.jpg' },
  shrine: { scene: 'Sukuna en Shibuya · episodio 41', note: 'El sello entrelazado se adapta a manos separadas. El modo detallado no verifica dedos ocultos.', url: 'https://jujutsukaisen.jp/episodes/41.php' },
};
