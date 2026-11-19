# Revisión de integridad — 19/11/2026

La carpeta de trabajo completa es `C:\Users\alfre\Documents\Proyecto JJK`. No se han detectado archivos necesarios ausentes ni regresiones respecto al último estado comprobado del proyecto.

## Comprobaciones

- TypeScript estricto: correcto.
- Vitest: 485 pruebas correctas en 28 archivos.
- Pruebas heredadas: 6 correctas.
- Compilación de producción: correcta. Los identificadores del JavaScript y CSS generado coinciden con los de la comprobación del 17/11/2026 (`index-Bv_vq656.js`, `index-DG6xIqG2.css`).
- Presentes 73 archivos en `src`, 30 en `tests`, 6 en `scripts`, 11 documentos previos y 7 archivos del prototipo `web`.
- Los nueve audios incluidos son idénticos, byte por byte, a los originales disponibles en Descargas.
- Modelo de manos: 7.819.105 bytes; SHA256 `fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1`, igual al fijado en el instalador.
- Los cuatro archivos locales de MediaPipe coinciden con los de la dependencia instalada.
- Modelo del Santuario presente; las pruebas de carga, geometría y recursos pasan.
- No hay diferencias de los archivos de aplicación respecto a sus versiones preparadas actualmente en el índice de Git. No se modificó el índice durante la revisión.

El catálogo conserva Gojo (5), Sukuna (4), Yuji (2) y Megumi (8): 19 técnicas. Las pruebas cubren también las cuatro maldiciones, respawn manual, manos de personaje, secuencias de audio, reconocimiento y las seis nuevas invocaciones de Megumi.

## Anomalías de las copias

Git tiene preparadas dos entradas de tipo repositorio anidado (`160000`), no archivos de la aplicación:

- `Proyecto JJK/`: existe dentro de la carpeta principal, pero actualmente contiene únicamente `.git`. Su único commit registra un README con el título «Proyecto JJK» y `.gitattributes`; esos dos archivos aparecen borrados dentro de esa copia. No contiene una versión histórica del código del juego.
- `Proyecto-JJK/`: no existe en el disco y figura eliminada respecto al índice del repositorio principal.

Estas entradas explican los avisos de cambios/borrado. Ninguna es una dependencia del proyecto principal. Se dejaron intactas para conservar el estado del usuario y evitar eliminar información de Git durante una revisión.

Muchos archivos de la aplicación están preparados para un futuro commit; no son archivos perdidos. Los commits antiguos del repositorio principal corresponden al prototipo y no proporcionan por sí solos una fotografía completa de todas las ampliaciones posteriores. La comparación con el índice actual y la coincidencia del build aportan evidencia de continuidad, pero no sustituyen una copia histórica completa con hashes de cada archivo.

## Alcance

No fue necesario restaurar ni cambiar código, configuración o audios. Se regeneró la salida de compilación y se añadió este informe. No se hicieron commits, publicaciones ni limpiezas de carpetas.

La revisión verifica integridad, compilación y comportamiento mediante pruebas automatizadas. No incluye una nueva prueba con webcam, escucha de audios ni inspección de animaciones en WebGL.
