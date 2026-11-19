# Casteo y audio de Sukuna

Los cinco archivos del usuario están incluidos sin modificar en public/audio/sukuna. Se precargan al seleccionar la técnica y permanecen tras recargar. La asignación está en src/audio/techniqueAudio.ts.

| Archivo | Momento de inicio |
| --- | --- |
| Dismantle.mp3 | Durante el mantenimiento inicial del filo, antes del barrido y del ataque |
| cleave.mp3 | Durante la preparación con palmas separadas, antes de cerrar la trama |
| santuario.m4a | Durante el mantenimiento del sello, antes de desplegar el modelo |
| fuga1.m4a | Durante el mantenimiento de la carga con palmas abiertas |
| fuga2.m4a | Durante el mantenimiento del gesto final de Fuga, antes de lanzar |

Los audios empiezan tras 100 ms válidos acumulados. Fuga1 se reproduce completo (6,739 s); solicitar el segundo paso no lo interrumpe. Fuga2 empieza desde cero cuando termina el primero y también conserva su contenido completo (5,710 s). Si los gestos ya están validados, la app muestra una invocación y permite bajar las manos mientras espera el tramo final de la voz para lanzar la flecha. La puntuación y la recuperación empiezan al salir el ataque; el audio restante cabe en su animación.

Las cuatro técnicas de Sukuna conservan la posición de reproducción al lanzar y ahora comparten el cierre con la animación: desvanecimiento en sus últimos 180 ms y parada al terminar, también con audio de sesión. Desmantelar ya no puede dejar su cola de SFX sonando tras el efecto. Una voz que no avanza durante tres segundos deja de retener Fuga; se conserva el orden de los dos archivos, sin resucitar callbacks antiguos. El aviso de invocación está en el HUD, sin popup central, y la guía de dedos se oculta durante el ataque.

La marca 00:03 de Púrpura pertenece al audio de Gojo y no se aplica a los de Sukuna. Fuga mantiene su espera anterior para conservar ambas frases completas.

Antes de completar los gestos, una postura inválida o pérdida prolongada cancela el casteo correspondiente. Esperar la postura siguiente conserva la voz de la fase ya completada. Tras validar los gestos puede terminar la invocación sin mantener las manos. Pausa, salida, cambio de técnica/objetivo y respawn detienen el sonido y cancelan cualquier lanzamiento pendiente.

Un audio cargado desde Ajustes sustituye los incluidos para esa técnica durante la sesión y empieza en su primer mantenimiento válido. Su duración desconocida no añade espera al lanzamiento y se cierra con el efecto. Las técnicas sin archivo usan sus tonos. Si un archivo principal no puede reproducirse, se utiliza el tono cuando Web Audio está disponible. La prueba de efectos usa el clip principal sin simular una detección ni puntuar; Fuga conserva su espera de invocación.

Comprobado con adaptadores de API y cabeceras reales de los archivos: precarga, volumen/mute, errores, cancelación, audio anterior a la animación y ausencia de reinicio al disparar. Las copias locales y de producción son idénticas a los archivos aportados y se sirven con audio/mpeg o audio/mp4. No se ha escuchado ni medido la sincronía percibida en navegador.
