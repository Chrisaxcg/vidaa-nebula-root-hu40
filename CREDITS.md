# Créditos y licencias

## Alvidaa

- Proyecto base: https://github.com/carteakey/alvidaa
- Autor del aviso original: Kartikey Chauhan, 2026.
- Base local: commit `38e1b51`, más las modificaciones de esta sesión.
- Licencia MIT conservada en [LICENSES/Alvidaa-MIT.txt](LICENSES/Alvidaa-MIT.txt).
- Aporta investigación, cadena fetcher/FaaS/superwatch/IPK, recetas Dropbear,
  frontend/plataforma nativa, pruebas y herramientas de inspección.

Esta publicación es un proyecto derivado especializado en una HU40; no es la
cuenta oficial de Alvidaa ni atribuye al propietario de esta TV el descubrimiento
de todas las primitivas. El árbol no importa el historial ni las investigaciones
completas de otros modelos. Los nombres `tools/he40` y `tools/u7q` conservan
procedencia histórica; la guía HU40 delimita qué archivos se utilizaron aquí.

## TizenTube y TubeFree

- Base de TubeFree: https://github.com/reisxd/TizenTube
- Autor del paquete: Reis Can; paquete `@foxreis/tizentube`, versión `1.15.2`.
- Licencia declarada por el paquete: **GPL-3.0-only**.
- Se publica nuestro adaptador editable; el bundle upstream se obtiene por
  separado y se comprueba por hash. El código fuente de TizenTube y sus avisos
  se consultan en el proyecto enlazado; no se atribuyen como desarrollo propio.
- TubeFree es el nombre local de la adaptación a Odin/VIDAA, no una versión
  oficial de TizenTube. Su funcionamiento estable permanece pendiente.

Investigación relacionada: [yt-dlp/ejs](https://github.com/yt-dlp/ejs),
[bgutils-js](https://github.com/LuanRT/BgUtils) y los esquemas de
[googlevideo](https://github.com/LuanRT/googlevideo). Los experimentos antiguos
usaron un solver de `n`; sus bundles y el player de YouTube no se publican aquí.

## Free My TV

- Proyecto: https://github.com/felipericardo/tv-launcher
- Revisión de referencia: `f2d984c51edca1544e39f2d44cdf86b75b0b6703`. <!-- checksum / revisión de origen -->
- MIT, Copyright 2026 Free My TV contributors, conservada en
  [su archivo de licencia](tools/launcher-host/third-party/free-my-tv/LICENSE).
- El HOME es una adaptación nativa simplificada; no promete paridad completa
  con el producto web original. Galaxia, distribución, foco y HUD se modificaron
  para esta TV. El fondo de galaxia se generó para este proyecto con image_gen.

## Licencia de la publicación

La publicación derivada y sus aportaciones se distribuyen bajo **GPL-3.0-only**;
consulta [LICENSE](LICENSE). Se mantienen además los avisos MIT de los componentes
procedentes de Alvidaa y Free My TV. Esto no cambia las licencias de sus proyectos
originales. Las marcas, iconos y logotipos que aparecen en la captura pertenecen
a sus respectivos titulares; no se distribuyen paquetes de iconos de las apps.
No hay afiliación ni respaldo de Hisense, VIDAA, Google/YouTube o Samsung.

Los scripts para compilar Dropbear no incluyen sus binarios ni sus fuentes:
obtén el original correspondiente y conserva sus avisos al redistribuirlo.
