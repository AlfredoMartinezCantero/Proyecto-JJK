# Ampliación de Diez Sombras

Megumi pasa de dos a ocho entrenamientos; el catálogo completo tiene cuatro personajes y diecinueve técnicas. Se conservan Perros Divinos y Nue. Cada invocación se elige de forma explícita y utiliza la cámara, el progreso por técnica, los ajustes y el respawn manual existentes.

| Técnica | Entrada adaptada | Animación y resultado |
| --- | --- | --- |
| Lobos de Jade: Totalidad | Índice/meñique en ambas manos próximas 1300 ms → separar ambos sellos 800 ms | Lobo bípedo con garras, avance y zarpazos a 1850/2200 ms; desgarro en el segundo |
| Sapo | Dos dedos en una mano y palma abierta en la otra, próximas; 1300 ms | Lengua que alcanza al objetivo a 1250 ms, lo rodea, arrastra, libera y deja derribado |
| Elefante Máximo | Palmas próximas 800 ms → puño/palma separados 1000 ms | Elefante con trompa articulada; torrente a 2150 ms, espuma, onda y caída del objetivo |
| Estampida de Conejos | Índice/corazón en ambas manos próximas; 1100 ms | Hasta 96 conejos compartiendo geometría, saltos y desplazamiento; distracción sin heridas |
| Mahoraga | Dos puños próximos, separados y visibles; 2200 ms | Aparición del gigante, rueda de ocho radios y espada; contacto a 3300 ms, corte y disipación luminosa |
| Jardín Azabache de las Quimeras | Puños próximos 1700 ms → abrir/separar palmas 1200 ms | Campo fluido abierto, dobles de Megumi y múltiples shikigamis; golpes a 2600/3400/4200/5000/5800 ms y hundimiento del objetivo |

Mahoraga y el dominio completan su tutorial con una activación; las demás técnicas necesitan dos. Todos los gestos son adaptaciones para mantener las manos observables, sin entrelazar dedos ni exigir contacto o posturas forzadas. El modo Detallado conserva estas mismas adaptaciones de Megumi. No se certifican sombras reales, distancia física, articulaciones ocultas o fidelidad exacta de sellos originales.

## Referencias aportadas y decisiones

Las referencias del usuario orientan los rasgos de cada invocación: [Totalidad](https://jujutsu-kaisen.fandom.com/es/wiki/Lobos_de_Jade:_Totalidad), [Sapo](https://jujutsu-kaisen.fandom.com/es/wiki/Sapo), [Elefante Máximo](https://jujutsu-kaisen.fandom.com/es/wiki/Elefante_M%C3%A1ximo), [Estampida de Conejos](https://jujutsu-kaisen.fandom.com/es/wiki/Estampida_de_Conejos), [Mahoraga](https://jujutsu-kaisen.fandom.com/es/wiki/General_Divino_de_las_Ochos_Hojas_Divergentes_del_Sila:_Demonio_Mahoraga) y [Jardín Azabache](https://jujutsu-kaisen.fandom.com/es/wiki/Jard%C3%ADn_Azabache_de_las_Quimeras). Algunas rutas originales no permitían lectura directa; se consultaron los resultados indexados y, para el agua de Elefante, también la [descripción equivalente](https://jujutsukaisen.fandom.com/pt-br/wiki/Elefante_M%C3%A1ximo). No se copiaron imágenes, textos extensos, modelos ni audios de estas páginas.

Totalidad se representa con una anatomía bípeda y garras propias. Sapo conserva su función de captura; el elefante usa su trompa para lanzar agua. Los conejos forman cobertura de distracción y no explotan ni hieren a la maldición. Mahoraga se presenta como un ritual escenificado: la rueda gira y la espada ataca, pero no hay domesticación ni adaptación automática a técnicas enemigas, ya que el receptor de práctica no ejecuta ataques. El jardín usa un suelo de sombras fluidas abierto, dobles e invocaciones; no añade una barrera cerrada ni un golpe garantizado narrativo.

## Implementación

`expandedShikigami.ts` construye cinco recursos originales: Totalidad, Sapo, Elefante Máximo, Mahoraga y la geometría de un conejo. Los modelos tienen articulaciones para brazos/garras, boca, trompa y rueda. Los colmillos del elefante se afilan y los ojos de Sapo quedan delante de sus marcas oscuras.

`ExpandedShadowEffects` gestiona la preparación ligada al centro observado de ambas manos y las invocaciones en el campo virtual. Reutiliza modelos, instancias, tubos, superficies líquidas, partículas y materiales. La lengua se deforma con una sección orientada por su tangente y sigue la posición arrastrada del objetivo. El agua nace de la punta de la trompa animada. La estampida usa una sola geometría con color por vértice; los dobles y perros de sombra del dominio se hornean en mallas rígidas para reducir llamadas de dibujo. La calidad ligera reduce conejos a 32 (16 dentro del jardín), partículas a 300 y elimina parte de los dobles/invocaciones del dominio. No se ha medido el rendimiento en GPU.

`megumiTimeline.ts` comparte los contactos entre animación, audio y respuesta. `shadowConfig.ts` contiene forma y distancia de los sellos; la guía, la evaluación en crudo/filtrado y los límites de depuración usan esa definición. La fase del elefante admite cerrar el puño en cualquiera de las dos manos originales. Datos incompletos de landmarks se rechazan sin bloquear el reconocedor. Los NPC muestran la postura adaptada de la fase; las manos del jugador siguen exclusivamente sus puntos observados.

`combatTimeline` añade captura/arrastre, inundación, distracción y hundimiento sin afectar a Gojo, Sukuna o Yuji. Totalidad usa fragmentos; Mahoraga divide y desvanece las mitades; Sapo/Elefante dejan el cuerpo caído. Los conejos no tienen explosión, grietas ni distorsión de impacto. El jardín deja al objetivo consumido y una marca negra en el suelo hasta el respawn. Reiniciar restaura geometría, posición, materiales y marcador. Las vistas previas sin impacto no dañan ni puntúan.

La expansión modifica el entorno mientras permanece activa y lo restaura al finalizar, cancelar o cambiar de técnica. El daño del receptor sigue esperando el respawn manual. Volumen, intensidad y reducción de destellos se conservan; no se añade estroboscopia. Los sonidos son sintetizados, con invocación e impactos en los contactos compartidos. No se incluye una voz original de Megumi o Mahoraga; pueden cargarse audios locales por técnica.

## Validación

`shadow-expansion.test.ts` tiene 52 casos: mantenimiento/orden/liberación para cada técnica, una mano/fotogramas aislados/datos crudos-filtrados incompletos, roles del elefante, cambio de mano, pausa, datos antiguos, modelos, rueda/espada, recursos finitos y reutilizados, lengua, agua, calidad, intensidad, dominio y cancelación. Incluye las seis respuestas sobre las cuatro maldiciones y su respawn, así como la ausencia de impacto destructivo en Conejos/Sapo. Hay seis regresiones de controlador y seis de programación/cancelación de audio, además de las pruebas genéricas del catálogo ampliado.

Se inspeccionaron proyecciones estáticas en CPU de los cinco modelos y se renderizaron las guías React en servidor. No equivalen a una captura WebGL: la compilación de shaders, la mezcla de audio, las animaciones en GPU y la precisión de los gestos con webcam siguen pendientes de prueba en navegador.
