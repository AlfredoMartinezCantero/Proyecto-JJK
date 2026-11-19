# Jujutsu Gesture Lab · Entrenamiento 3D

Un campo de entrenamiento inspirado en Jujutsu Kaisen. Gojo, Sukuna, Yuji, Megumi, un objetivo de práctica y un escenario nocturno están generados con Three.js. Las manos virtuales siguen tus manos reales mediante la webcam. La versión local incluye **Gojo** (cinco entrenamientos), **Sukuna** (cuatro), **Yuji** (dos) y **Megumi** (ocho), técnicas volumétricas, destrucción de la geometría del objetivo y postura detallada opcional.

Es un escenario virtual controlado por gestos: no se implementa anclaje de objetos a tu habitación ni WebXR. Los gestos no se presentan como sellos originales verificados.

Santuario Malevolente incorpora ahora el modelo aportado por el usuario: aparición progresiva, niebla roja, polvo y una apertura de cámara que termina en plano general antes de los cortes. El modelo se prepara al seleccionar Santuario; la guía indica cuándo está listo. Si falla la carga, se ofrece reintento y una figura simplificada. La maldición conserva los restos hasta el respawn manual. Preparación del recurso y créditos: [docs/SHRINE_MODEL.md](docs/SHRINE_MODEL.md).

## Arrancar en Windows

Recomendado: **Node.js 24 LTS**, Chrome de escritorio con WebGL 2 y una webcam. Las dependencias y el modelo ya están preparados en esta carpeta.

```powershell
npm.cmd start
```

Abre la dirección que imprime Vite. Empieza por **http://127.0.0.1:3000/** y elige el siguiente puerto libre si está ocupado. Para fijar uno:

```powershell
npm.cmd run dev -- --port 3001
```

Los cambios se actualizan mediante Vite. Detén el servidor con `Ctrl+C`.

En otra copia del repositorio, instala con `npm.cmd ci`. El proceso copia WASM y descarga el modelo oficial de Google (aproximadamente 7,8 MB), verificando su SHA256. Hace falta conexión durante la instalación. Si la descarga se interrumpe, ejecuta `npm.cmd run setup:assets`. El modelo, WASM y las fuentes se sirven después desde el propio proyecto; el funcionamiento offline sigue pendiente de ensayo.

## Primera sesión con Azul

1. Pulsa **Comenzar tutorial** y revisa la guía de Azul.
2. Opcionalmente carga un clip propio como referencia. No hay vídeos de anime incluidos.
3. La cámara se prepara automáticamente al entrar al tutorial. Concede el permiso si el navegador lo pide. No se solicita micrófono.
4. Pulsa **Jugar: Azul**. Si la cámara aún está cargando, la partida espera y arranca la cuenta atrás cuando está lista. La cuenta atrás no activa la técnica.
5. Palma visible, índice y corazón extendidos, anular y meñique flexionados; pulgar libre. Mantén la postura **1,2 s**.
6. Tras la activación, espera **2,2 s** y abre la mano durante **0,5 s**. Un puño o una mano ausente no sirven para rearmar.
7. Tres activaciones reales completan el tutorial y desbloquean **Entrenamiento libre** de Azul.

No fuerces la postura. Usa luz frontal y mantén toda la mano en el encuadre. El menú permite elegir cualquiera de los cinco tutoriales de Gojo. Cada tutorial desbloquea su propio entrenamiento libre; el progreso anterior de Azul se conserva.

La cámara permanece encendida al volver al menú, cambiar de técnica, abrir ajustes o pausar; se reutiliza la misma conexión. El reconocimiento se pausa fuera de la guía/práctica y no puntúa en el menú. Puedes detenerla con **Apagar cámara** en Ajustes o el botón de encendido de la vista previa. Al cerrar o abandonar la página se libera la cámara. **Jugar** o **Reanudar** vuelven a conectarla automáticamente si estaba apagada. **Cancelar inicio** cancela una partida pendiente de carga. La aplicación no enciende la cámara simplemente por cargar la página.

## Catálogo de Gojo

El selector **Maldición objetivo** permite elegir Mahito, Hanami, Jogo o Dagon (forma evolucionada), desde el menú, la guía y Ajustes. La selección se guarda localmente. Cada uno tiene una geometría propia compatible con cortes, fragmentación, carbonización, desintegración y regeneración. Cambiar de objetivo cancela la animación/carga en curso y mantiene la cámara y los tutoriales desbloqueados. Los modelos se crean al seleccionarlos y se reutilizan después.

Son interpretaciones procedurales de los personajes. Mahito incluye cabello y costuras; Hanami, ramas, marcas de corteza y brazo cubierto; Jogo, cráter y ojo único; Dagon, tentáculos y aletas. Gojo y Sukuna incorporan caras y orejas, prendas con perfiles más suaves, costuras/pliegues y manos con cinco dedos; Sukuna añade detalles de sus ojos y marcas. No son modelos oficiales importados. Referencia de personajes: [web oficial](https://jujutsukaisen.jp/character/category4.php). La apariencia final requiere revisión en navegador.

Tus dos manos 3D cambian automáticamente con el personaje y tienen anatomías completas distintas. Gojo tiene palma y dedos suaves, pliegues, uñas naturales y puños oscuros; Sukuna, nudillos marcados, tendones en relieve, garras negras curvas y bandas de muñeca. La piel es continua desde la muñeca hasta las puntas. Los dedos se doblan siguiendo los puntos observados y conservan sus anclas de energía. No hace falta activar otro modo. Véase [docs/CHARACTER_HANDS.md](docs/CHARACTER_HANDS.md).

| Entrenamiento | Gesto adaptado | Fases y efecto | Objetivo del tutorial |
| --- | --- | --- | --- |
| Azul | Índice y corazón extendidos, otros dos flexionados | Mantener 1,2 s; esfera y atracción | 3 activaciones |
| Rojo | Solo índice extendido; pulgar libre | Mantener 1 s; onda de repulsión | 3 activaciones |
| Fusión | Azul, después Rojo en la otra mano | Azul 3,2 s → Rojo 2,8 s → acercar 0,9 s → convergencia | 2 secuencias |
| Púrpura | Azul → Rojo → fusión → gesto final de la mano de Azul | 3,2 s → 2,8 s → 0,9 s → 1 s → proyectil e impacto | 2 secuencias |
| Dominio | Índice y corazón próximos y extendidos, anular y meñique flexionados | Mantener 1,8 s → vacío estelar durante 8 s, inmovilidad y explosión de cabeza cuando quedan 2 s | 1 activación |

Fusión es el entrenamiento de preparación de Púrpura. Los papeles Azul/Rojo pueden asignarse a cualquiera de las manos, pero deben conservarse durante la secuencia. Hay un máximo de 10 s entre fases. Una pérdida prolongada, un cambio de identidad de seguimiento o una pausa obligan a empezar la secuencia desde el principio.

Al completar Azul, conserva su mano visible y prepara Rojo con la otra. La app espera la segunda mano dentro de esos 10 s; no vuelve a cargar Azul por tardar más de 250 ms en introducirla. El dominio de Gojo incluye ahora el audio aportado, que empieza durante el mantenimiento del sello.

Fusión y Púrpura necesitan **ambas manos abiertas** durante 0,6 s después de la recuperación para rearmarse. Rojo y Azul requieren una mano abierta; el dominio, una durante 0,6 s. La guía muestra los tiempos de recuperación específicos. La palma abierta, el puño y una mano ausente no cuentan como activación.

En el modo jugable, los dedos del dominio se acercan sin exigir cruce. La opción detallada comprueba un cruce proyectado en la imagen; no demuestra contacto, profundidad física ni qué dedo pasa por delante. Todos los efectos siguen siendo interpretaciones procedurales.

## Visuales, impactos y postura detallada

Las referencias de estilo elegidas son Gojo contra Toji y Sukuna en Shibuya. La nueva capa visual usa plasma con ruido volumétrico, núcleos de energía, cintas curvas, estelas, partículas en GPU, ondas de presión y distorsión localizada. El Santuario añade entrada, dientes, escaleras, huesos y cornisas; el Vacío, filamentos y capas de niebla estelar. La maldición tiene mandíbula, dientes, placas, extremidades articuladas y garras.

| Técnica | Respuesta del objetivo |
| --- | --- |
| Azul | Atracción, elevación y deformación por la fuerza del vórtice |
| Rojo | Explosión radial de fragmentos de la propia malla |
| Fusión | Preparación y convergencia de energías; atracción leve |
| Púrpura | Desintegración completa, partículas de superficie y un intervalo de desaparición |
| Vacío Infinito | Inmovilidad y explosión de la cabeza cuando quedan 2 s; cuerpo y restos permanecen hasta el respawn |
| Desmantelar | Corte geométrico en dos mitades con caras interiores |
| Sesgar / Cortar | División en una trama de fragmentos |
| Fuga | Carbonización, desaparición del cuerpo y cenizas ascendentes |
| Santuario | Desprendimiento progresivo de fragmentos en oleadas |

En Vacío Infinito, el dominio se abre y paraliza al objetivo durante el primer segundo. Al acercarse al final, unos anillos de presión se cierran sobre la cabeza; estalla cuando quedan 2 s (segundo 6 de los 8 actuales). El cuerpo permanece inmóvil y los restos esperan al respawn. La onda y las partículas respetan intensidad, reducción de destellos y calidad gráfica.

Los fragmentos proceden de recortar la malla del objetivo con planos; las caras interiores se triangulan y cierran. Su movimiento incluye gravedad, dos rebotes aproximados y fricción contra un suelo virtual. Los patrones están preparados para cada ataque: no hay corte arbitrario guiado por una espada ni colisiones entre todos los fragmentos. El objetivo **no se regenera automáticamente**: al terminar la animación aparece habilitado **Respawnear maldición**. Los fragmentos permanecen y Púrpura/Fuga mantienen el cuerpo ausente hasta pulsarlo. Pausar conserva el estado observado; elegir otro objetivo o comenzar otra sesión prepara una maldición intacta. Los impactos son dirigidos y temporizados, sin colisiones con la habitación.

Mientras se espera el respawn no se pueden encadenar nuevos ataques. El botón no suma puntos ni evita la recuperación y la apertura de manos. Tras el último ataque de un tutorial se desbloquea su progreso al acabar la animación; la pantalla de completado espera al respawn para no ocultar el resultado. La prueba de impacto de NUI LAB utiliza el mismo respawn manual.

Sesgar proyecta una malla de 6 trazos verticales y 6 horizontales, visible durante el vuelo y sostenida brevemente en el impacto. Desmantelar usa una media luna con estelas más finas; Santuario combina cuadrículas y diagonales en oleadas. Los tajos tienen núcleo claro, bordes rojos y anchura perpendicular a su trayectoria. La calidad Ligera conserva la malla completa de Sesgar.

Calidad Alta usa hasta 9.000 partículas para la técnica, 2.400 para desaparición/cenizas y hasta 72 celdas de fragmentación. Ligera reduce esas cantidades a 1.800, 700 y una trama de hasta 18 celdas, además de omitir bloom y distorsión. La reducción de destellos permanece activada inicialmente. Son presupuestos de recursos, no una medición de FPS.

En la guía o en **Ajustes → Postura de los dedos**, selecciona **Detallada · experimental**. Añade pulgar recogido en Rojo, cruce observable en el dominio de Gojo y una variante de proyección de Púrpura con índice/corazón extendidos y pulgar abierto. En la preparación de Fusión/Púrpura se recogen ambos pulgares para exigir un cambio real al proyectar. Fuga usa índice y pulgar en L en la mano del arco y un puño cómodo en la otra. Las ilustraciones e indicaciones cambian con la opción. El modo jugable está seleccionado inicialmente. Ambas versiones exigen postura sostenida en datos crudos y filtrados; cambiar de modo descarta carga parcial y conserva recuperación/liberación.

La variante detallada de Púrpura se ha contrastado con una figura oficial de SEGA, y la mano del arco de Fuga con el fotograma oficial 40-2. Esto no certifica el sello completo de Púrpura contra Toji ni los dedos ocultos de la otra mano de Sukuna. El modo jugable conserva Púrpura con tres dedos y Fuga con puño/índice. Santuario evita entrelazar las manos y mantiene su adaptación. Las fuentes y límites están en [VISUALS.md](docs/VISUALS.md). La energía de Rojo y Desmantelar nace del índice; Azul usa el punto medio de sus dos dedos. Fuga detallada sitúa el arco en la mano en L y la cuerda en la mano que tira. Las manos 3D siguen los landmarks, sin ajustar los dedos artificialmente para completar una postura.

Para revisar sin webcam: elige técnica, abre **NUI LAB**, habilita **Depuración del reconocimiento** y pulsa **Probar impacto con objetivo · depuración**. Anima la respuesta de la maldición sin sumar activaciones ni desbloquear tutoriales. **Probar efecto · depuración** muestra solo la técnica. Ambas pruebas están bloqueadas durante práctica y cuenta atrás.

## Sukuna

El selector de la cabecera cambia el personaje, su modelo y su catálogo. Sukuna es una interpretación geométrica con pelo rosado, marcas faciales y vestimenta propia. Cambiar de personaje limpia la carga, los efectos y las fases en curso; conserva los tutoriales completados de ambos personajes.

| Entrenamiento | Gesto adaptado | Efecto | Objetivo |
| --- | --- | --- | --- |
| Desmantelar / Dismantle | Solo índice durante 0,7 s → trazo lateral corto con la punta en 3 s → frenar y mantener al final 0,5 s | Corte proyectado | 2 activaciones |
| Sesgar / Cleave | Palmas abiertas separadas 0,6 s → acercarlas sin contacto 0,85 s | Trama de cortes cruzados | 2 secuencias |
| Fuga | Palmas abiertas separadas 0,8 s → puño en una mano e índice en la otra 0,9 s | Flecha de fuego e impacto | 2 secuencias |
| Santuario Malevolente | Índice y corazón extendidos en ambas manos, palmas próximas sin contacto, 1,8 s | Santuario procedural, ambiente rojizo y cortes durante 8 s | 1 activación |

Desmantelar sigue la punta del índice y admite ambos lados, movimientos lentos y diagonales suaves. El mínimo es 0,9 longitudes de palma en puntos crudos y filtrados, dentro de 3 s. Puedes terminar un recorrido más largo sin repetir la preparación: al frenar detecta 150 ms de estabilidad y pide mantener el gesto 0,5 s. Una variación breve de postura conserva el trazo, sin sumar carga; una postura incorrecta mantenida, cambio de mano, salto de seguimiento o movimiento demasiado vertical lo cancelan. El HUD indica cuánto falta de trazo y cuándo está reconocido. No se activa por esperar, por temblor pequeño ni por un único salto. Los límites específicos están en `src/core/swipeConfig.ts`; requieren calibración con manos reales.

Sesgar, Fuga y Santuario necesitan dos manos. Para repetirlas hay que abrir ambas durante 0,6 s tras la recuperación. Desmantelar libera con una mano abierta durante 0,5 s. El puño de Fuga puede hacerlo cualquiera de las manos de la preparación, pero una mano nueva no sustituye a las originales. No se exige contacto, entrelazado ni fuerza física.

Los gestos son adaptaciones para webcam, no sellos originales verificados. No se mide contacto real ni se implementan todas las habilidades narrativas de Sukuna; este catálogo cubre sus cortes, fuego y dominio.

## Yuji

Yuji Itadori aparece como tercer personaje, con pelo rosado, uniforme oscuro, capucha y puños rojos, manos propias y animación de guardia, avance, golpe y regreso.

| Entrenamiento | Gesto adaptado | Resultado |
| --- | --- | --- |
| Puño Divergente / Keiteiken | Puño visible 0,7 s → desplazamiento lateral corto → frenar y mantener 0,5 s | Dos impactos separados 320 ms; la maldición retrocede y cae |
| Destello Negro / Kokusen | Puño visible 0,9 s → desplazamiento lateral corto → frenar y mantener 0,5 s | Energía negra y roja, relámpagos y fragmentación de la maldición |

Ambos funcionan con cualquiera de las manos, necesitan dos activaciones para completar su tutorial y conservan el respawn manual. Los sonidos se sintetizan en los contactos; no se incluye una voz original de Yuji. La cámara reconoce un desplazamiento cómodo del puño: no hace falta golpear ni avanzar hacia ella. No mide fuerza, contacto ni la sincronización microscópica del anime. Véase [docs/YUJI.md](docs/YUJI.md).

## Megumi Fushiguro

Cuarto personaje, con pelo oscuro en puntas, uniforme de cuello alto, manos propias y animación de invocación.

| Entrenamiento | Gesto adaptado | Resultado |
| --- | --- | --- |
| Perros Divinos / Gyokuken | Índice y meñique extendidos en ambas manos próximas, sin contacto; mantener 1,2 s | Perro blanco y negro emergen de la sombra, corren y atacan a los 1350/1750 ms; desgarro en el segundo impacto |
| Nue | Dos palmas abiertas próximas 0,7 s → separarlas y mantener 1 s | Nue despliega las alas y descarga electricidad a los 1600 ms; la maldición se oscurece y cae |
| Lobos de Jade: Totalidad | Sellos de índice/meñique próximos 1,3 s → separados 0,8 s | Lobo bípedo con garras, dos zarpazos y desgarro |
| Sapo | Dos dedos y una palma próximos, 1,3 s | Captura con lengua, arrastre y caída |
| Elefante Máximo | Palmas próximas 0,8 s → puño/palma separados 1 s | Torrente desde la trompa que arrastra al objetivo |
| Estampida de Conejos | Dos dedos en ambas manos próximas, 1,1 s | Multitud de conejos que distrae sin causar heridas |
| Mahoraga | Dos puños visibles separados, 2,2 s | Ritual, rueda de ocho radios y espada que corta y disipa al objetivo |
| Jardín Azabache de las Quimeras | Puños próximos 1,7 s → abrir/separar palmas 1,2 s | Sombras fluidas, dobles, shikigamis y hundimiento del objetivo |

Todos necesitan dos manos visibles. Mahoraga y el dominio requieren una activación para completar el tutorial; los demás, dos. Los gestos son adaptaciones sin entrelazar dedos ni cruzar muñecas. Conservan el progreso independiente, los cuatro objetivos y el respawn manual. Los sonidos se sintetizan localmente, sin voz original incluida. Mahoraga representa el ritual y el ataque; no simula adaptación automática a enemigos. Véanse [docs/MEGUMI.md](docs/MEGUMI.md) y [la ampliación de seis técnicas](docs/MEGUMI_EXPANSION.md).

**Ajustes / NUI LAB** permite cambiar volumen, intensidad, calidad gráfica, vista de webcam y esqueleto. Reducir resplandor está activado inicialmente. La depuración muestra técnica, fase, ángulos, distancia entre palmas, coincidencia geométrica, tiempos y FPS. **Probar efecto** reproduce la técnica seleccionada, está identificado como depuración y no suma activaciones. Cada técnica puede tener su propio vídeo y audio locales de sesión.

Los audios de Gojo y Sukuna empiezan durante el casteo, tras 100 ms válidos de mantenimiento. No vuelven a empezar al activarse el ataque. Fuga usa fuga1 durante la carga y fuga2 durante el mantenimiento del gesto final, sin solaparlos. Las cuatro técnicas de Sukuna cierran el sonido con un desvanecimiento al terminar su animación. Un decoder de Fuga estancado deja de bloquear tras tres segundos sin avanzar. Se precargan al seleccionar la técnica y respetan volumen, pausa, cancelación y respawn. Véase [docs/SUKUNA_AUDIO.md](docs/SUKUNA_AUDIO.md).

Púrpura/Fusión se preparan en orden: primero solo Azul con su voz, después Rojo en la otra mano con la suya, y finalmente Hollow Purple al fusionar. Cada fase sustituye el audio anterior; el lanzamiento conserva la narración. Los efectos y la guía siguen ese orden. Véase [docs/GOJO_AUDIO.md](docs/GOJO_AUDIO.md).

Púrpura se proyecta con «Murasaki» en 00:03, la marca indicada por el usuario, tras validar el gesto final. Ya no espera la cola del archivo de 19,509 s ni añade otra carga después de la voz. Si tardas en formar el gesto, el audio espera en esa marca; después continúa con los impactos/SFX y se desvanece al terminar la animación. El aviso central está retirado y la guía de dedos se oculta durante el ataque y hasta el respawn. Puntuación, recuperación y respawn parten del lanzamiento; la vista previa sigue la misma marca y no puntúa. Fusión conserva su invocación anterior. Fuga mantiene ambos clips: el segundo espera al primero y la flecha acompaña al tramo final de su audio. Véase [docs/GOJO_AUDIO.md](docs/GOJO_AUDIO.md).

`Esc` pausa durante la práctica. Cambiar de pestaña o abrir ajustes también pausa; no se acumula tiempo oculto. Reanudar conserva la obligación de liberar el gesto tras una activación.

## Tecnologías

| Parte | Implementación |
| --- | --- |
| Aplicación | TypeScript 5.9, con comprobación estricta |
| Desarrollo y build | Vite 8 |
| Interfaz y estado | React 19, almacén pequeño con `useSyncExternalStore` |
| Escenario | Three.js r187, WebGL 2, geometría procedural |
| Estética | Materiales toon, contornos, cielo con shader, bloom y Neutral tone mapping |
| Manos | `SkinnedMesh`, 21 huesos y pesos de piel, dirigidos por landmarks |
| Seguimiento | MediaPipe Tasks Vision 1.2.3, GPU con alternativa CPU |
| Gesto | Geometría cruda y filtrada, One Euro, continuidad, máquina de estados y secuencias ordenadas |
| Sonido | Web Audio o archivo local; sin entrada de micrófono |
| Fuentes | Fontsource: Bebas Neue, Rajdhani y Noto Serif JP |
| Pruebas | Vitest 5; casos sintéticos de geometría, tiempos, seguimiento y manos 3D |

Las versiones exactas están en `package-lock.json`. Las fuentes están empaquetadas; Noto Serif JP utiliza el subconjunto latino y los ideogramas recurren a las fuentes del sistema.

## Estructura

```text
src/
  app/          React, estado y controlador de la sesión
  core/         Geometría, temporización, secuencias, filtros y continuidad
  config/       Catálogos validados de Gojo y Sukuna, fases y tiempos
  tracking/     Webcam y MediaPipe
  scene/        Patio, personajes, objetivo, manos y efectos de cada técnica
  audio/        Tono sintetizado y sonido local
  styles.css    Estilos de la experiencia 3D
scripts/        Copia de WASM y descarga del modelo
public/         Recursos que sirve Vite
tests/          Pruebas de la versión 3D y del prototipo
docs/           Diseño, arquitectura y estado de validación
web/            Prototipo 2D original, conservado como referencia
```

Tu `web/style.css` permanece conservado. El prototipo original puede consultarse en `/legacy/` durante el desarrollo. El servidor local mantiene las herramientas de lectura MCP en `/mcp`, con el diseño local en `/project.txt` y la técnica en `/config.json`.

## Comprobaciones y compilación

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run preview
```

`dist/client/` contiene la aplicación de producción y los recursos locales. El build genera también `dist/server/index.js` para MCP; en un despliegue Worker necesita un binding `ASSETS` que sirva `dist/client`. Para la vista previa local, Vite mantiene la API MCP mediante middleware.

`.openai/hosting.json` conserva el ID del Site existente. No se ha publicado esta migración ni se ha creado otro plugin. La publicación del Site sigue sirviendo su versión anterior hasta que se actualice expresamente.

Los catálogos y sus tiempos se ajustan en `src/config/gojo.json` y `src/config/sukuna.json`, validados al cargar. Los umbrales geométricos base siguen en `web/config.json`; las relaciones bimanuales están en `src/core/techniques.ts` y el barrido en `src/core/SwipeTracker.ts`. `/config.json` y MCP exponen los nueve entrenamientos y conservan la ficha compatible de Azul.

El estado comprobado y la lista de ensayos manuales están en [docs/VALIDATION.md](docs/VALIDATION.md). Las pruebas automáticas no acreditan precisión con manos reales ni validan los shaders en una GPU.

## Privacidad y límites

Las imágenes se procesan en el navegador y no se graban ni suben. Los clips y sonidos seleccionados usan URL locales de sesión. `localStorage` guarda únicamente ajustes y tutorial completado.

La inferencia se ejecuta de forma síncrona, limitada a 20 llamadas/s, y comparte el equipo con el render. No se promete ese rendimiento: debe medirse con webcam. El modo ligero reduce la resolución y desactiva bloom. El seguimiento de profundidad no representa distancia métrica ni demuestra contacto. Oclusiones, manos cruzadas y poca luz pueden producir errores. La asistencia visual no modifica los puntos para fabricar un gesto válido.

Diseño completo: [docs/project.txt](docs/project.txt). Arquitectura y fases: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

Referencias oficiales: [Vite](https://vite.dev/guide/), [React](https://react.dev/reference/react/useSyncExternalStore), [Three.js](https://threejs.org/docs/pages/SkinnedMesh.html), [MediaPipe](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker?tab=Web) y [Vitest](https://vitest.dev/guide/).
