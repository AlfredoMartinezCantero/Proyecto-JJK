# Yuji Itadori

Tercer personaje seleccionable. Esta entrega toma como orientación el uniforme de Yuji de Shibuya y añade dos entrenamientos de puño. El [catálogo oficial de personajes](https://jujutsukaisen.jp/character/shibuyajihen.php) orienta la identidad del modelo; los episodios oficiales [13](https://jujutsukaisen.jp/episodes/13.php) y [19, «黒閃»](https://jujutsukaisen.jp/episodes/19.php) son referencias de combate. No se incluyen fotogramas, voces, vídeos ni modelos oficiales descargados. El modelo y los efectos se generan en código.

| Técnica | Entrada adaptada | Presentación y respuesta del objetivo |
| --- | --- | --- |
| Puño Divergente / Keiteiken | Puño visible 700 ms → desplazamiento lateral corto → frenar y mantener 500 ms | Energía azul cian; primer contacto a los 460 ms, segundo a los 780 ms; retroceso y caída del objetivo |
| Destello Negro / Kokusen | Puño visible 900 ms → desplazamiento lateral corto → frenar y mantener 500 ms | Núcleo oscuro, rayos negros con bordes rojos, ondas y distorsión de contacto a los 620 ms; fragmentación del objetivo |

Ambos tutoriales necesitan dos activaciones. El progreso queda asociado a su técnica y no desbloquea Gojo, Sukuna ni la otra técnica de Yuji. El respawn es manual: la maldición permanece caída o fragmentada hasta pulsar el botón existente.

## Reconocimiento

`PunchTracker` sigue la base del corazón (punto 9), próxima al centro del puño. Exige que los cuatro dedos estén flexionados, tanto en datos crudos como filtrados. Tras preparar el puño, el desplazamiento horizontal mínimo es de 0,7 longitudes de palma; ambos juegos de puntos deben moverse en la misma dirección. Se admiten ambos lados y una diagonal suave. Hay tres segundos para trazar, tres avances mínimos y al menos 150 ms de movimiento observado. Tras frenar, se verifican 120 ms de estabilidad antes de mantener los 500 ms finales. Una vez reconocido el desplazamiento, esa última espera puede concluir después de la ventana de tres segundos.

Los límites están separados en `PUNCH_LIMITS`. Un puño quieto, temblor, una mano abierta o un salto aislado no activan la técnica. Se rechazan saltos superiores a 0,65 palmas por muestra y huecos mayores de 200 ms; los datos antiguos no suman carga. Una postura incorrecta puede conservar brevemente el recorrido durante 180 ms sin acreditarlo. Pérdida prolongada, pausa o cambio de identidad reinician la secuencia. Después de recuperarse, hay que abrir visiblemente la mano antes de repetir.

Es una adaptación para webcam: no mide un puñetazo, fuerza, contacto ni la sincronización microscópica del Destello Negro. El movimiento solicitado es corto y lateral, sin avanzar hacia la cámara ni necesitar golpear. No se interpreta la profundidad estimada como distancia física. No se ajustan landmarks a una plantilla. Los puños ocultos o de perfil requieren calibración con personas.

## Modelo, manos y efectos

`Yuji.ts` crea pelo rosado con laterales cortos, cara sin marcas de Sukuna, uniforme azul oscuro, capucha/cuello y puños rojos, botones, zapatillas y dos manos cerradas con dedos. La animación pasa de guardia a avance, extensión del brazo y vuelta a la posición inicial. Es una interpretación procedural estilizada.

Las manos del jugador tienen anatomía completa propia: palma más ancha, falanges algo más robustas, nudillos y tendones moderados, uñas naturales y manga del uniforme. Usan los 21 puntos observados y cambian con la selección. Las variantes se construyen al necesitarlas, se almacenan y se reutilizan; cada escena libera también las variantes inactivas.

`YujiEffects` reutiliza aura de puño, cintas, partículas, anillos, luz e instancias de rayos. La energía parte del punto seguido del puño. `yujiTimeline.ts` comparte las marcas de contacto entre imagen, sonido y respuesta. Los sonidos de impacto se sintetizan localmente: dos grupos a 460/780 ms en Divergente y uno a 620 ms en Destello Negro. No hay una voz original de Yuji incluida. El volumen, la intensidad, la reducción de destellos y la calidad ligera conservan sus controles; no se añade estroboscopia.

Las cuatro maldiciones admiten las dos respuestas. Divergente mantiene la figura y la derriba después del segundo contacto. Destello Negro utiliza su geometría fragmentada; no sustituye el objetivo por una figura genérica. Las vistas previas sin impacto no dañan al objetivo; la prueba que sí lo hace conserva su etiqueta de depuración y no puntúa.

## Validación

Las pruebas sintéticas cubren preparación, ambos sentidos, quietud/temblor/palma abierta, acuerdo crudo-filtrado, saltos, vertical puro, cambio de mano, pausa, muestras antiguas, postura incorrecta y recorrido lento. También comprueban los dos pulsos, caída/fragmentación de cada maldición, persistencia y respawn, selección de manos, modelo, calidad/intensidad, reutilización y cancelación del sonido programado. El controlador comprueba reconocimiento → audio/efecto → puntuación → espera de respawn para ambas técnicas, conservando el progreso previo.

Se inspeccionaron vistas estáticas en CPU del modelo en guardia/ataque y de la mano. No equivalen a una captura WebGL. La herramienta de navegador no dispone de un navegador conectado en esta sesión; quedan pendientes la compilación de estos shaders en GPU, la escucha y el ensayo real de puños con webcam.
