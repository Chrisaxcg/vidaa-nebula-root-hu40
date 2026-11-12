# TubeFree para VIDAA — investigación inconclusa

Base: [TizenTube](https://github.com/reisxd/TizenTube), `@foxreis/tizentube@1.15.2`,
GPL-3.0-only. El objetivo era usar sus modificaciones en YouTube TV desde Odin.
**Esta publicación no ofrece YouTube sin anuncios funcionando en VIDAA.**

## Último estado documentado

- Wrapper `1.15.2+tf10.1`: únicamente `https://www.youtube.com/tv*`.
- Filtro de respuestas publicitarias y spoof del cliente desactivados por defecto.
  El wrapper fuerza `ytaf-configuration.enableAdBlock=false` en este diagnóstico.
- Codecfix: declara VP9/AV1/Opus no compatibles para explorar fallback AVC;
  es una modificación de prueba, no un diagnóstico definitivo de códecs.
- Minter `1.2.1`: solo se activa con `tubefree-pot-experiment=on`.
- Odin agotó el flujo cerca de 44–63 segundos en las pruebas descritas.
- YouTube original superó 90 segundos según el propietario, mientras SSH
  confirmó el proceso nativo bajo UID 321. El tiempo no se midió por CDP allí.
- Una página local de prueba en Cobalt terminó en «sin internet». Se restauró
  `YOUTUBE_SET_URL_TEST=0`, el montaje temporal se retiró y se comprobó el original.

## Código publicado

| Archivo | Función |
| --- | --- |
| `tools/tubefree/adapter.user.js.in` | Modificaciones locales editables; marcador en lugar del bundle minificado upstream |
| `tools/tubefree/build.cjs` | Inserta únicamente el bundle upstream cuyo hash coincide |
| `tools/tubefree/upstream.json` | Versión, origen, licencia y hash del bundle |
| `tools/tubefree/zz_codecfix.user.js` | Experimento de compatibilidad de códecs |
| `tools/tubefree/zz_pot.user.js` | Experimento opt-in de PO token y preservación de Request/protobuf |
| `tools/tubefree/pot-request.test.cjs` | Cuatro pruebas locales del tratamiento de peticiones |
| `research/cobalt/` | Página de capacidades, servidor de prueba y lanzador con namespace privado |

El minter publicado exige `window.__tfPotConfig` con `apiKey` y `requestKey`:
se retiraron las constantes de servicio del snapshot público. No se suministran
credenciales, tokens ni cookies. Esta configuración no convierte el experimento
en una solución; el servidor rechazó los tokens producidos durante las pruebas.

## Reconstrucción del wrapper

Obtén el paquete fijado de TizenTube y conserva sus avisos y fuente upstream:

```sh
mkdir -p /tmp/nebula-tizentube
cd /tmp/nebula-tizentube
npm pack @foxreis/tizentube@1.15.2
tar -xzf foxreis-tizentube-1.15.2.tgz
# Desde la raíz de VIDAA Nebula:
node tools/tubefree/build.cjs \
  /tmp/nebula-tizentube/package/dist/userScript.js \
  /tmp/nebula-tizentube/zz_tizentube.user.js
```

El constructor verifica el SHA-256 del contenido sin espacio exterior contra
el bundle extraído del wrapper local. Si no coincide, detente y revisa la
proveniencia; no desactives esa comprobación. La compilación local no prueba
reproducción ni implica instalar nada en la TV.

La ruta activa observada era
`/var/local/webengine/odin_home_browser/userjs/`, configurada por
`ODIN_USER_SCRIPT_ROOT`; los scripts legibles por Odin eran 313:313, modo 0440.
El wrapper vivo se llamaba `zz_tizentube.user.js`: crear otro nombre dejaría
una doble inyección. Cualquier prueba requiere respaldo de contenido y permisos.

## Próximos pasos y criterio de aceptación

1. Establecer Odin sin TizenTube, codecfix ni minter y medir reproducción real
   prolongada: más de 10 minutos, cambio de vídeo, seek y reanudación.
2. Reintroducir un cambio cada vez. No atribuir un corte al adblock mientras
   el control sin minter todavía contiene otros hooks.
3. Si se investiga Cobalt, resolver primero el ciclo APM y el error de red.
   Descargar HTML no demuestra que la página se haya interpretado.
4. Solo después evaluar anuncios y transiciones. Validar varios vídeos,
   sesiones nuevas y reinicio del navegador, además de ausencia de errores.
5. Mantener cualquier captura detallada privada y acotada; no subir URLs
   firmadas, cuerpos de reproducción, visitor data ni cookies al repositorio.

Historial y mediciones: [auditoría saneada](TUBEFREE-AUDIT-2026-11-11.md).

El paquete npm incluye dos bytes NUL literales en strings del parser. El wrapper
local los había escapado como `\0`. El builder verifica el hash original, aplica
únicamente ese escape y verifica el hash normalizado del snapshot local.
