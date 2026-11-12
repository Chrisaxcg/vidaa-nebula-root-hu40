# HOME Nebula: implementación y recuperación

El HOME instalado usa Vue dentro de `hisenseUI`, separado de Odin y del Cobalt
de YouTube. Combina el bundle original privado con plataforma, frontend y
entrada de Alvidaa/Free My TV. Conserva navegación, orden, favoritos, almacenamiento,
lanzamiento de apps y servicios nativos; el rediseño modifica la presentación.

## Lo instalado

- Galaxia local con movimiento nativo: 16 s por dirección, zoom/desplazamiento
  y estrellas. Se pausa cuando el HOME no está visible o lo cubre un menú.
- Foco con escala 1.10, elevación de 6 px y desplazamiento de vecinas; grid de
  8 columnas × 3 filas, transición de página y menú por OK largo.
- Favoritas centradas y más abajo, sin ayudas repetidas en el pie.
- Todas las apps con un único título de navegación y rango/contador inferior.
- Colores específicos para las 43 apps del catálogo, TubeFree y FOX Sports;
  las apps desconocidas reciben un acento estable, no un color de marca inferido.
- HUD HDMI ARC que consulta `getEZPlayCECVolumeState().value`, con validación
  de salida/dispositivo/soporte y rango 0–100. La barra física no tiene pantalla
  numérica, así que no se contrastó su cifra en un display independiente.

## Construcción local

`tools/launcher-host/build-native.cjs` exige el hash de la revisión original
para la que fue escrito. No se distribuye ese original. Un hash distinto exige
investigación; no sustituir la constante por el hash de cualquier archivo.

```sh
node tools/launcher-host/build-native.cjs /ruta/privada/stock-app.js /tmp/nebula-home.js
node tools/launcher-host/build-volume-visual.cjs \
  /ruta/privada/stock-volume.js /tmp/nebula-volume.js --cec-reported-percent
```

El constructor de volumen sustituye renders y conserva controladores. Sus chunks
de silencio se construyen con `buildMute` exportado por el mismo módulo, cada uno
contra su hash permitido. La galaxia y CSS están en `tools/launcher-host/assets`.
Los resultados contienen código del fabricante: no subirlos a GitHub.

## Instalación visual

El helper `deploy-home-visual-hu40.cjs` no es un instalador de root. Requiere
SSH ya operativo, originales privados y un manifiesto `release.json` privado
con seis entradas en este orden:

1. `/APPS/channelA/operation-ui/apps/launcher/js/app.js`
2. `/APPS/channelA/system-ui/apps/volume-bar/js/app.js`
3. `/APPS/channelA/system-ui/apps/volume-bar/js/367.js`
4. `/APPS/channelA/system-ui/apps/volume-bar/js/762.js`
5. `/APPS/channelA/hisenseUI/var/local/alvidaa-galaxy-v1.jpg`
6. `/APPS/channelA/hisenseUI/var/local/alvidaa-home-visual-v1.css`

Cada entrada declara `target`, nombre de archivo local `source`, `before` (SHA-256
vivo o null si el activo nuevo no existe) y `after` (SHA-256 candidato). No confundir
este manifiesto operativo con [HOME-RELEASE.json](HOME-RELEASE.json), que es un
registro informativo de una instalación, no un paquete listo para otra TV.

El helper valida hashes y proceso único; guarda contenido, UID/GID/modos y
contexto privado; bloquea temporalmente la salida del actualizador UID 304;
detiene `hisenseUI`, aparta cachés y escribe de forma atómica. Relanza con el
contexto original y verifica estabilidad. El fallo intenta restaurar la versión
anterior. Ese contexto puede contener datos privados y permanece en la TV.

Runtime observado para ejecutar el helper:

```sh
export PATH=/usr/local/bin:/bin:/usr/bin:/sbin:/usr/sbin
LD_LIBRARY_PATH=/lib:/usr/local/lib:/basic/lib \
  /opt/pkgs/tv.vidaa.app.phoenix/bin/phoenix /tmp/MI-STAGE/deploy.cjs install
```

Preparar primero el stage con los seis archivos y `release.json`; el comando
anterior es un ejemplo operativo, no crea el stage por sí mismo.

## Recuperación

El helper devuelve la ruta privada del respaldo. Para volver a esa versión:

```sh
LD_LIBRARY_PATH=/lib:/usr/local/lib:/basic/lib \
  /opt/pkgs/tv.vidaa.app.phoenix/bin/phoenix \
  /var/local/alvidaa/home-visual-MI-RESPALDO/deploy.cjs \
  restore /var/local/alvidaa/home-visual-MI-RESPALDO
```

La TV de la sesión también conserva una recuperación consolidada previa al
rediseño en `/var/local/alvidaa/home-visual-original-20261111`; el registro público
indica los hashes finales. Esa ruta no existe por defecto en otros televisores.
No editar ni publicar sus `state.json`, entorno del proceso o copias de firmware.

Se ejecutaron las pruebas locales y se inspeccionaron capturas HAL reales. Quedan
pendientes corte de alimentación y desconexión física HDMI. Detalles y particularidades
del motor: [HOME-IMPLEMENTATION.md](HOME-IMPLEMENTATION.md).
