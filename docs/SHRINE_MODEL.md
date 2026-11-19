# Santuario Malevolente aportado por el usuario

Recurso de origen: `1754146226_MSJJKCC.rar`, archivo anidado `MSJJKCC/Original Model/Original Model.rar`. Se utilizó `MSJJKCC.fbx` con sus texturas; los archivos de GTA no se utilizan. El README del paquete se leyó como información de procedencia, sin adoptar instrucciones. Según ese README, el modelo original es de Byking Inc. y el revamp de Groveruke. Los créditos acompañan al GLB en `public/assets/shrine/CREDITS.txt`.

El GLB mide 14.046.704 bytes, conserva 196.918 triángulos y cinco materiales. Las diez texturas de color/normal pasan de 2048 a 1024 píxeles, en JPEG; las texturas de color de origen se comprobaron opacas en un muestreo. No se interpretaron los canales ambiguos `_M`/`_G` como mapas PBR. Se reconstruyeron materiales rugosos, se soldaron vértices compatibles, se corrigió la convención vertical de UV y se orientó la entrada hacia +Z. La malla mide 12 unidades de ancho y queda apoyada en el suelo. El original contiene una única malla sin rig y un clip de duración cero: no se anima la mandíbula por separado.

`ShrineDomain` carga el GLB al seleccionar la técnica, con importación diferida del cargador y reutilización posterior del recurso. Si falla, mantiene una construcción simplificada y permite reintentar desde la guía. Un recurso que termine de cargar durante una activación espera hasta la próxima para evitar una sustitución brusca. Si llega tras destruir la escena, se liberan sus recursos.

La secuencia dura ocho segundos. Primero se acerca la cámara a Sukuna, que mantiene una postura de invocación adaptada. A partir de 450 ms el santuario emerge con recorte en el suelo y revelado de material, polvo y niebla baja. La cámara retrocede y encuadra el santuario, Sukuna y el objetivo antes del primer corte, a 2600 ms. Las oleadas posteriores usan el mismo reloj que la fragmentación del objetivo. Los últimos 900 ms restauran el entorno y la cámara; los restos permanecen hasta el botón de respawn. Pausa, salida y cambio de técnica restauran la cámara inmediatamente.

Reducir destellos elimina la breve vibración de asentamiento, reduce la aproximación inicial y atenúa luz/resplandor. La calidad ligera reduce niebla y polvo, conserva el modelo y el comportamiento. Intensidad cero suprime la presentación y el movimiento de cámara. El modelo no proyecta sombras en mapas adicionales, para evitar repetir su geometría en cada pase.

Para reconstruir el GLB, extraer únicamente el FBX y los PNG de la carpeta original en un directorio local. Desde la raíz del proyecto:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/prepare-shrine-textures.ps1 -SourceDirectory "RUTA_AL_MODELO_EXTRAIDO"
node scripts/prepare-shrine-model.mjs "RUTA_AL_MODELO_EXTRAIDO"
```

El primer script usa System.Drawing de Windows. La aplicación y el build usan el GLB ya preparado; no necesitan el RAR, el FBX, Blender ni estos scripts.

La comprobación local carga la geometría real con GLTFLoader, sustituyendo únicamente la decodificación de imágenes por texturas vacías en las pruebas CPU. Se comprueban las imágenes JPEG incrustadas, materiales, límites, tiempos, carga fallida/reintento, llegada tardía, encuadre horizontal/vertical y restauración. Una proyección texturada por CPU permitió inspeccionar orientación y atlas. No es una captura WebGL ni valida normales, shaders, composición final o FPS. No había navegador conectado para ensayar la animación con GPU/webcam.

Para verla: seleccionar Sukuna → Santuario, esperar «Santuario listo» y usar Jugar o la prueba de efectos de NUI LAB. La vista previa con impacto permite comprobar los restos; sigue marcada como depuración y no puntúa. Revisar el techo completo, ausencia de cortes antes de la aparición, retorno de cámara al pausar/finalizar y respawn manual.
