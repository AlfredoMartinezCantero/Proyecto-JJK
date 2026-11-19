# Megumi Fushiguro

Cuarto personaje seleccionable, ahora con ocho entrenamientos de Diez Sombras. Este documento describe Perros Divinos y Nue; las otras seis técnicas, sus referencias y límites están en [MEGUMI_EXPANSION.md](MEGUMI_EXPANSION.md). Se consultaron la [ficha oficial de Megumi](https://jujutsukaisen.jp/character/shibuyajihen.php) y el [episodio 18](https://jujutsukaisen.jp/episodes/18.php) como orientación. Los modelos y animaciones son interpretaciones procedurales originales, sin modelos, episodios, texturas ni voces oficiales descargados. Los sellos son adaptaciones para webcam.

| Entrenamiento | Entrada adaptada | Animación y respuesta de la maldición |
| --- | --- | --- |
| Perros Divinos / Gyokuken | Índice y meñique extendidos, corazón/anular flexionados en ambas manos próximas, sin contacto; mantener 1200 ms | Sombras en el suelo, aparición de perro blanco y negro, carrera, salto y mordidas a 1350/1750 ms; primer retroceso y desgarro en el segundo ataque |
| Nue | Dos palmas abiertas próximas 700 ms → separarlas y mantener 1000 ms | Aparición, ascenso, alas articuladas y descenso; descarga a 1600 ms, temblor breve, oscurecimiento y caída |

Los tutoriales de Perros Divinos y Nue necesitan dos activaciones. El progreso se guarda por técnica y no desbloquea otros personajes ni la otra invocación. Las cuatro maldiciones conservan fragmentos o cuerpo caído hasta el respawn manual. La prueba sin impacto es inocua y la prueba con objetivo mantiene su etiqueta de depuración y no puntúa.

## Reconocimiento

`wolf` usa extensión de índice/meñique y flexión de corazón/anular en cada mano. `hounds` exige ese gesto en ambas manos, con separación de 1,2–3,2 longitudes de palma. Nue exige primero dos palmas abiertas próximas, a 1,2–2,5 palmas, y después separadas a 3–7 palmas. La diferencia vertical máxima es de 0,9 palmas. Los límites se aíslan en `shadowConfig.ts` y aparecen en la depuración de Megumi.

Se evalúan forma y distancias en puntos crudos y filtrados. Las manos originales permanecen asociadas por ID durante la carga y la secuencia, aunque cambie el orden de detección. No se acredita un fotograma aislado ni datos antiguos; una pérdida prolongada, pausa, cambio de identidad o timeout interrumpe la carga. Nue dispone de la ventana de diez segundos entre sus fases. Tras recuperarse, hay que abrir **ambas** manos visiblemente para repetir. Una mano ausente no cuenta como liberación. Las palmas abiertas separadas no bastan para repetir Nue sin su preparación próxima.

Son adaptaciones jugables: no se entrelazan dedos ni se cruzan muñecas, no se exige contacto y no se certifican dedos ocultos o sombras físicas reales. La orientación detallada de los sellos originales sigue pendiente; ambos modos usan la misma adaptación de Megumi. Los gestos requieren calibración con personas, especialmente ante dedos parcialmente ocultos.

## Modelo y manos

`Megumi.ts` añade cabello oscuro en puntas, ojos verdes, cuello alto, uniforme azul oscuro con botones, manos del sello y palmas abiertas, con animación de invocación. Las manos del jugador tienen geometría completa propia, más estrecha y con dedos finos, uñas naturales y puños oscuros. Conservan exactamente los 21 puntos observados en ambas etiquetas de mano; no se ajustan a plantillas para aprobar un gesto.

`shadowShikigami.ts` construye perros con hocico, orejas, ojos, colmillos, mandíbula, cuatro patas y cola; sus ciclos de carrera, salto y mordida están coordinados con los contactos. Nue tiene máscara angular, plumas con volumen, alas móviles, patas/garras y cola. Los portales de sombra, niebla, trazos de garra, semilla de energía y arcos eléctricos se reutilizan en `MegumiEffects`.

La preparación visual sigue el centro de ambas manos observadas. La invocación se representa después en posiciones del campo virtual junto al personaje: no se mide el suelo real ni se ancla a la habitación. `megumiTimeline.ts` comparte los instantes de contacto entre animación, respuesta y audio. El segundo ataque de los perros separa la geometría real del objetivo en fragmentos; no sustituye la maldición seleccionada por una figura genérica. Nue conserva el cuerpo oscurecido y caído. Pausa, cambio de técnica/personaje y nueva sesión limpian las invocaciones; el daño del objetivo sigue el flujo de respawn existente.

Los sonidos son sintetizados localmente: entrada grave al invocar, dos golpes para los perros y descarga para Nue. No hay voz original de Megumi incluida. El usuario puede cargar un archivo local por técnica. Se respetan volumen, intensidad, reducción de destellos, calidad ligera y cancelación de sonidos programados. No se añade estroboscopia.

## Validación

Las pruebas sintéticas cubren las formas de dedos, dos manos completas, mantenimiento, orden de Nue, límites de separación/altura, datos crudos/filtrados, continuidad de IDs con orden invertido, sustitución/pérdida de manos, pausa, muestras antiguas y liberación bimanual. También verifican modelos/articulaciones, manos propias, hitos de contacto, ambas respuestas en las cuatro maldiciones, persistencia a 30 s, respawn, vista previa inocua, efectos finitos y reutilizados, calidad e intensidad, audio programado y el flujo de controlador hasta puntuación/respawn.

Se revisaron proyecciones estáticas en CPU de Megumi, ambos perros, Nue y las manos. Se comprueban por renderizado React en servidor los cuatro selectores, catálogos y guías. No equivalen a una captura WebGL ni a un ensayo de webcam: la herramienta no dispone de navegador conectado en esta sesión. Quedan por comprobar en navegador shaders, luz, oclusión, audio y seguimiento real.
