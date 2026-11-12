# HOME Galaxia · HU40 · 2026-11-11

Registro de la [implementación visual](HOME.md), autorizada por el propietario. Equipo HU40E5600FFWV, firmware V0000.09.09K.P1218. No extrapolar el despliegue a otros modelos.

## Resultado

- HOME con galaxia local, cabecera compacta y favoritas en el tercio inferior. Tema claro, oscuro y automático conservados.
- Todas las apps conserva 8 columnas, 3 filas por página, su orden y sus controles. Tarjetas con posiciones de referencia estables y desplazamiento visual de las vecinas al enfocar, nombres visibles, identidad por `appId`, contador y menú lateral. La ayuda de Mover explica correctamente que OK o Atrás terminan; los cambios ya se guardaban al mover.
- Foco con escala 1.10, elevación y desplazamiento de vecinas (14 px horizontal / 10 px vertical en el diseño 1080p), en 240 ms. Páginas entran lateralmente en 280 ms y menú en 170 ms. Galaxia con desplazamiento horizontal entre +1 % y −4 %, escala 1.04–1.16 y giro entre −0.35° y +0.65°, 16 s por trayecto alternado. Ocho estrellas suaves añaden variación de brillo. Se animan transformaciones y opacidad; las posiciones de layout y los índices no cambian.
- HUD global de volumen y silencio. HDMI muestra el nivel que informa el servicio CEC, no el volumen interno ni un contador de pulsaciones. Se mantienen los tiempos, controles, restricciones y TTS nativos.

Los 19 métodos previos del frontend se compararon literalmente con la copia previa y son idénticos. Se añadieron únicamente ciclo de vida visual, detección de movimiento reducido y renderizado. No se modificaron TubeFree, servicios de anuncios, claves de preferencias ni arranque.

## Archivos

- [Frontend](../tools/launcher-host/free-my-tv-native.js).
- [Galaxia JPEG](../tools/launcher-host/assets/galaxy-v1.jpg), 265967 bytes; funciona sin red.
- [Keyframes de Cobalt](../tools/launcher-host/assets/galaxy-visual.css).
- [Presentación de volumen](../tools/launcher-host/volume-visual.js) y [constructor con hash de firmware](../tools/launcher-host/build-volume-visual.cjs).
- [Instalador específico HU40](../tools/launcher-host/deploy-home-visual-hu40.cjs). Requiere un `release.json` privado con ruta, origen y SHA-256 anterior/nuevo para los seis archivos, en el orden de su lista permitida. No es un instalador genérico ni cambia el arranque.

El constructor del HUD reemplaza exactamente los cuatro cuerpos `render` del módulo principal y los renders de los dos chunks de silencio. Se reconstruyó el original sustituyendo de vuelta esos cuerpos: el controlador restante coincide byte por byte. Los bundles que contienen código del fabricante permanecen en almacenamiento privado.

## Particularidades comprobadas en la TV

1. `matchMedia('(prefers-reduced-motion: reduce)').matches` y la variante `no-preference` devuelven **true simultáneamente**. Una regla CSS basada solamente en `reduce` desactiva todas las animaciones. El frontend exige `reduce && !noPreference`; no se incluye esa consulta en el CSS de este firmware.
2. `getComputedStyle(...).transform` devuelve la transformación base incluso mientras el animador CSS está funcionando. Confirmación por dos capturas HAL: en un área exclusivamente del fondo cambiaron el 93.04 % de los canales de píxel, con diferencia media 6.93/255. El nombre de animación devuelto fue `fmtv-galaxy-drift`.
3. La animación final usa keyframes nativos, sin bucle JavaScript por fotograma. La pausa también se aplica a las estrellas. Una prueba intermedia con rAF se retiró después de identificar el comportamiento de media queries.
4. En esta TV `busybox sha256sum`, `busybox tr` y `busybox nohup` no existen. Los hashes se verifican con Node/Phoenix o en el host. La captura HAL es asíncrona: hay que esperar al archivo.

## HDMI y porcentaje

Se observó `volumeDev=2`, `audioSpeaker=2`, `arcDev=1` y soporte de `kilby.sl2.i32.sound.cec.volume`. Se lee con `biz.sound.getEZPlayCECVolumeState().value`. En pruebas hubo valores 9, 10, 13 y 15; una muestra tuvo volumen interno 14 y CEC 15, lo que confirma que son estados distintos.

`--cec-reported-percent` habilita explícitamente esta lectura en el constructor. La presentación exige salida ARC activa, dispositivo conectado, soporte del dato y número finito entre 0 y 100. Rechaza 127, valores inválidos y cadenas. Bluetooth múltiple permanece direccional. Mute presenta «Silencio».

El propietario confirmó que su barra no tiene indicador numérico: se validó el dato del servicio HDMI, pero no pudo contrastarse contra una pantalla física. No se infiere un nivel sumando pulsaciones. La captura real muestra «Barra HDMI · 9 %».

## Validación

- 13 pruebas: navegación original, favoritos/ocultas/orden, OK corto/largo, servicios, accesibilidad, cuadrícula de 0/1/24/25/37 elementos, nombres duplicados, páginas completas, limpieza visual y condiciones del porcentaje.
- `scripts/check.sh` pasa. La comprobación opcional del sitio se omite porque falta el paquete Python `markdown`.
- HOME reconoce 44 apps y 7 entradas; conserva las dos favoritas del propietario a través de las recargas. Capturas reales de HOME, All Apps y HUD HDMI.
- Se observó navegación del propietario por índices de All Apps y cambio de volumen. No se ejercitaron destructivamente las acciones Ocultar ni los cambios persistentes de orden durante la prueba visual.
- No se ha probado un corte de energía completo ni una desconexión física de HDMI. Sus condiciones de presentación tienen pruebas locales; no se confunden con pruebas físicas.

## Instalación y recuperación

El instalador comprueba hashes, guarda originales y metadatos, captura en privado el entorno y argumentos del proceso que ya está funcionando y usa SIGTERM con espera. Sustituye archivos atómicamente y aparta las cachés compiladas, sin compilar y CSS. Relanza con el mismo entorno, argumentos e identidad y comprueba estabilidad. No escribe particiones de solo lectura ni `/OAD`.

Durante la sustitución se añade, solo si hace falta, una regla temporal de salida para el UID 304 del actualizador. Se retira al terminar y las reglas de red existentes permanecen iguales. Los respaldos se conservan en `/var/local/alvidaa/home-visual-*` con permisos privados. El respaldo stock `/var/local/alvidaa/native-home/app.js.stock` y el anterior `app.js.prev-candidate` permanecen intactos.

Las pruebas usaron un recolector local limitado a `127.0.0.1` y a seis minutos, con estados de UI/audio; no recogía credenciales ni historial. El bundle final no incluye esas sondas.

La ubicación de la recuperación consolidada y los hashes instalados se registran al finalizar en `HOME-RELEASE.json`, junto a este documento. Para restaurar se usa el `deploy.cjs` guardado dentro del directorio de recuperación, con `restore <directorio>`, a través de Phoenix y la sesión SSH existente. Los archivos de recuperación contienen entorno privado y no se deben publicar.

## Arte

Creado con la herramienta integrada `image_gen`, mediante la habilidad `imagegen`; exportado a JPEG de calidad 78. El PNG original se conserva fuera del repositorio. Prompt final:

> Use case: concept-art. Asset type: production background JPEG-like artwork for a beautiful living-room TV console HOME, widescreen 16:9 landscape. Create an original cinematic deep-space galaxy, sophisticated astronomy aesthetic. Sweeping diffuse indigo and blue-violet nebula arc through the middle-right of the frame, delicate fine stars, subtle cyan light, immense depth. Left quarter and lower third mostly midnight navy negative space for legible white UI overlays. Rich but restrained contrast, soft volumetric cosmic dust, no harsh bright white core, no large planets, no recognizable franchise elements, no text, no UI, no logos, no watermark. Complete composition must look beautiful as a static wallpaper and allow a very small slow pan/zoom. Wide 1920x1080 composition.

Referencia técnica consultada: [capacidades oficiales de Cobalt](https://cobalt.googlesource.com/cobalt/+/f9bc0139df6e6eb149345ab9b6ffcc40603fc09f/cobalt/site/docs/development/reference/supported-features.md). Las particularidades anteriores proceden de esta TV y prevalecen sobre la compatibilidad genérica. <!-- checksum / revisión de origen -->

## Ajuste de distribución · 2026-11-12

Se retiraron las ayudas inferiores de Inicio y Todas las apps. Las favoritas se
centran según el número visible de tarjetas, con el encabezado en y=700 y la fila
en y=760 del diseño 1080p. Inicio ya no dibuja la línea del pie. Todas las apps
conserva únicamente la etiqueta de navegación, sitúa el grid en y=290 y muestra
el rango y total abajo, a la izquierda. Controles, orden, almacenamiento, galaxia
y HUD HDMI permanecen iguales. Las 13 pruebas existentes pasan.

La TV se reencontró en `<TV_IP>`, verificando la misma clave SSH previamente
fijada para `<TV_IP>`; no se desactivó la comprobación de identidad.

## Color por aplicación · 2026-11-12

Las tarjetas usaban seis grupos de color y un azul común para las demás apps.
Se amplió la paleta tomando como referencia los iconos guardados en la TV:
43 nombres del catálogo cubiertos, además de TubeFree y FOX Sports. La misma
función pinta el recuadro del icono en favoritas y Todas las apps. Mantiene el
panel del nombre para conservar contraste y las marcas monocromáticas oscuras.
Se normaliza el nombre y se contemplan alias; Amazon Music tiene su propio
color turquesa y no hereda el azul de Prime Video. Las apps nuevas sin paleta
reciben un acento estable por nombre, que no pretende identificar su marca.

No se descargan imágenes ni se calcula color por fotograma. El cambio queda
limitado a `render`: se comparó el resto del frontend byte por byte. Validación:
43 entradas del catálogo sin recurrir al color genérico, vista previa con sus
iconos reales, 13 pruebas existentes y `scripts/check.sh` correctos (sitio opcional
omitido por falta de `markdown`). El instalador confirmó el proceso estable y
conserva tanto el respaldo inmediato como la recuperación consolidada original.

La captura HAL posterior confirmó la paleta en las primeras 24 tarjetas de
Todas las apps. Se verificaron los hashes instalados y los respaldos originales;
la recuperación consolidada reconoce esta nueva revisión.
