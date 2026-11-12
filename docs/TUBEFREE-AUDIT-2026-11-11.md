# Inspección directa de TV — 2026-11-11

Inspección de solo lectura por SSH y CDP. No se reinició, recargó ni modificó la TV.

## Identidad y descubrimiento

- IP encontrada por SSDP: `<TV_IP>`. Las antiguas `.85` y `.89` no respondían.
- Descriptor: `http://<TV_IP>:38400/MediaServer/rendererdevicedesc.xml`.
- Nombre: VIDAA TV; marca `his`; transport_protocol `3290`.
- Identificadores de red del dispositivo omitidos de la copia pública.
- User agent real: HU40E5600FFWV, MTK9602, firmware `V0000.09.09K.P1218`, VIDAA 9.0, Odin/Chrome 111.
- SSH 8008, CDP 9226 y MQTT 36669 respondieron. El primer barrido TCP no los detectó; SSDP y una comprobación posterior sí. No depender de un único barrido corto.
- El equipo `.69:8008` es Samsung, no esta TV.
- Autenticación SSH con la clave local existente; `busybox id` confirmó uid/gid 0.
- Kernel 4.19.79+, armv7l; uptime observado ~176454 s.
- Clave pública de host aceptada en `/tmp/vidaa-inspection-known-hosts`; no había entradas anteriores para las IP antiguas en el known_hosts predeterminado. No se verificó continuidad criptográfica con sesiones anteriores.

## Archivos instalados

Directorio activo configurado por `ODIN_USER_SCRIPT_ROOT`:
`/var/local/webengine/odin_home_browser/userjs/`.

| Archivo | MD5 observado | Comparación local |
| --- | --- | --- |
| zz_tizentube.user.js | 7abff8b3ee5bcb944c94a95d6a942bcf | idéntico a tizentube.user.js, tf10, 707244 bytes | <!-- checksum / revisión de origen -->
| zz_codecfix.user.js | afefe3c1461feb103df049dcca873953 | idéntico | <!-- checksum / revisión de origen -->
| zz_pot.user.js | ef1ea1629e7a4ae9934c5e3b7f2b554c | idéntico, 6482 bytes | <!-- checksum / revisión de origen -->

TizenTube y codecfix tienen copia idéntica en `/APPS/.tubefree/userjs/`.
No había zz_pot en esa copia.

**Problema concreto de permisos:** zz_pot pertenece a root:root y tiene 0640.
El navegador corre como uid/gid 313, sin grupo 0 entre sus grupos suplementarios,
con CapEff 0. Por permisos ordinarios no puede leer ese archivo. Los otros dos
pertenecen a UhisBrowser:UGhisBrowser y tienen 0440. Aún no corregido.

## Estado vivo de YouTube

- Había una página youtube.com/tv abierta en un vídeo.
- Mensaje visible: «Se produjo un error / Vuelve a intentarlo…».
- Vídeo: currentTime 0, paused true, readyState 0, networkState 0, sin MediaError.
- CDP Runtime.enable expuso solo el contexto predeterminado de youtube.com.
- `__tubefreeMain`, `__tfPotLoaded` y `__tfPotRefresh`: undefined en ese contexto.
- localStorage: tubefree-spoof-client-version y tubefree-adblock ausentes;
  ytaf-configuration.enableAdBlock=false.
- No hubo coincidencias TubeFree/TF-POT/userjs en la búsqueda limitada del log del navegador.

Conclusión: los archivos están instalados, pero no hay evidencia de ejecución
de esos hooks en la página actual. No afirmar que el fallo visible lo causa el
adblock o que el minter funciona. La ausencia del wrapper también necesita
explicación independiente del problema de permisos de zz_pot.

## Sistema

- Dropbear activo desde `/APPS/.re_sshd/`, PID observado 1893.
- 10 reglas REJECT en OUTPUT para las IP de bloqueo VIDAA/Google DNS.
- `/etc/hosts` apunta a `/tmp/hosts`: 71102 bytes, 2195 líneas.
- tvfw.sh instalado: MD5 95172687dd9756ec9d2e62f9fd98eab1. <!-- checksum / revisión de origen -->
- hosts.block instalado: MD5 4e8925485cf5be8002a694409b435be0. <!-- checksum / revisión de origen -->
- El start_odin.sh de respaldo incluye depuración 9222; el proceso vivo y el
  endpoint observado no deben inferirse de ese archivo (CDP respondió en 9226).

## Siguiente investigación

1. Preservar evidencia y respaldar cualquier archivo antes de corregir permisos.
2. Averiguar por qué el wrapper tf10 no aparece en la página actual: mecanismo
   de carga, ciclo de vida y reinicio/recarga controlada con captura temprana.
3. Verificar reproducción base y transición anuncio/contenido por separado.
4. Solo entonces evaluar la ruta de bloqueo; tf10 desactiva el scrub y fuerza
   enableAdBlock=false. NOTES.md describe v4 y no representa el estado actual.

No se probó persistencia con un nuevo arranque ni reproducción sin anuncios.

## Continuación: reparación y pruebas (mismo día)

- El usuario autorizó corregir TubeFree y posteriormente autorizó explícitamente
  la captura detallada de tráfico. Las capturas privadas se guardan en `/tmp`,
  fuera del repositorio. No publicar URLs firmadas, tokens ni cuerpos capturados.
- **Corrección del diagnóstico inicial:** una recarga mostró logs de TizenTube
  y codecfix. La ausencia de `__tubefreeMain` global no prueba ausencia de
  ejecución. El mecanismo de userscripts puede envolver las declaraciones.
- Respaldo PO original (contenido y permisos):
  `/APPS/.tubefree/rollback-20261111/zz_pot.user.js`.
- Se cambió el PO activo a uid/gid 313 y modo 0440, y se añadieron `@name`,
  `@match https://www.youtube.com/tv*`, `@run-at document-start` y `@grant none`.
- Inyección directa de prueba: BotGuard/GenerateIT logró producir un token.
  Eso por sí solo **no** demuestra aceptación del token por el servidor.
- La reconstrucción antigua de Request usaba `request.body` (ReadableStream)
  con `duplex: half`. Se observaron preflights CORS rechazados y un atasco a
  ~5 segundos. Se cambió a clonación/buffer de bytes y conservación de opciones.
- Con esa corrección el vídeo avanzó ~50 segundos, pero volvió a error. Las
  respuestas UMP pequeñas capturadas contienen parte 58 con status 2 al inicio
  y status 3 después. No se ha logrado reproducción estable ni adblock probado.
- La siguiente revisión añade el token al campo protobuf 19/2
  (`VideoPlaybackAbrRequest.streamer_context.po_token`) preservando todos los
  otros campos, según los esquemas públicos de
  [VideoPlaybackAbrRequest](https://github.com/LuanRT/googlevideo/blob/main/protos/video_streaming/video_playback_abr_request.proto)
  y [StreamerContext](https://github.com/LuanRT/googlevideo/blob/main/protos/video_streaming/streamer_context.proto).
- Cuatro pruebas locales en `pot-request.test.cjs`: cuerpo binario y opciones,
  reemplazo del campo anidado sin tocar los demás, paso intacto de peticiones
  ajenas/token existente y compatibilidad URL string + init binario.
- Versión 1.2.0 instalada y hash confirmado:
  `16900d127244976450c585b62283facb`. **No supera la prueba de aceptación:** <!-- checksum / revisión de origen -->
  patchedBodies crece, pero el servidor devuelve estado 3 y corta el flujo.
- `__tfPotStatus()` devuelve solo versión, ready, mintedAt y patchedBodies;
  no expone el token. El diagnóstico se prueba con un helper CDP privado
  del directorio VIDAA exterior al repo. Este helper retira su script CDP
  temporal al finalizar el plazo; el archivo instalado permanece.
- Algunas recargas regresan al selector de perfiles. El usuario selecciona
  su perfil y pulsa play; no interpretar la espera en ese selector como fallo
  del transporte.

Rollback del minter: restaurar la copia original con `busybox cp -p` sobre el
archivo activo y volver a cargar el navegador. El respaldo original conserva
los permisos root:root 0640 (estado previo, que impedía su lectura).

### Variantes descartadas o pendientes

- GenerateIT devuelve un integrityToken (no fallback), TTL 43200 s y umbral
  de refresco 100. La existencia de ese resultado no acredita aceptación GVS.
- Cambiar temporalmente la request key a una clave alternativa del cliente TV (fallback del
  player TV guardado localmente) no evitó estado 3 con binding de sesión.
- Mint con videoId en lugar del livingRoomPoTokenId y `potc=1` temporal en las
  peticiones tampoco evitó estado 3. No persistir esos experimentos como arreglo.
- Un clic DOM `.click()` en el texto de reintento no bastó; una entrada real
  `Input.dispatchMouseEvent` en el rectángulo visible sí inició otra reproducción.
- Recargar con un enlace watch puede dejar la app negra y sin solicitudes
  de vídeo hasta interacción física. No contabilizar ese tiempo como reproducción.
- Se inició una prueba de control SIN minter mediante script CDP temprano que
  marca `__tfPotLoaded=true` y `__tfNativeBaseline=true`, evitando la instalación
  del hook. `typeof __tfPotStatus === 'undefined'` confirmó que no estaba activo.
  El archivo de disco sigue siendo 1.2.0. Se solicitó al usuario iniciar vídeo
  manualmente para medir 90 s sin recargas. El vídeo se reprodujo hasta 43.9 s
  con búfer de 18.7 s. En la siguiente muestra, cuatro segundos después, la
  app mostró el error y reinició el elemento de vídeo. El corte se reproduce
  sin el minter personalizado, con TizenTube y codecfix aún activos.
- Capturas privadas protegidas con permisos 0700/0600. Los helpers temporales
  de protocolo tienen plazo acotado y retiran su intervención al terminar.

### Control en Odin y estado instalado al cierre de la prueba

- La vista web (`/watch`) en Odin con UA genérico de Chrome 111 y sin minter
  también dejó de reponer el búfer cerca del primer minuto y acabó en error.
- Se probó retirar temporalmente solo la línea de `static.doubleclick.net`
  de `/tmp/hosts`. El navegador pudo cargar `ad_status.js`, pero el vídeo
  volvió a agotar su búfer a ~63 s y mostró error. Se restauró el archivo
  íntegro y se confirmó su MD5 original `f572ec19e857e3cd03f29308b6bc08ac`. <!-- checksum / revisión de origen -->
- Wrapper `1.15.2+tf10.1` instalado, MD5 `d0a31e8eb5d90ea3199ba4a14224f8a2`. <!-- checksum / revisión de origen -->
  Solo coincide con `/tv*`. La revisión anterior corría también en `/watch`.
- Minter `1.2.1` instalado, MD5 `58fb54955987fa826a5a836cf5ddce8f`. Se activa <!-- checksum / revisión de origen -->
  solo con `localStorage['tubefree-pot-experiment'] = 'on'`. Permisos 0440,
  usuario y grupo de Odin. Cuatro pruebas locales aprobadas.
- El respaldo del wrapper anterior es
  `/APPS/.tubefree/rollback-20261111/zz_tizentube.tf10.user.js`.
- El usuario confirmó que el mismo vídeo superó 90 s y siguió reproduciéndose
  en YouTube original. Por SSH se observó `/opt/youtube/youtube`, PID 14686,
  con UID 321, separado del navegador Odin. El tiempo de vídeo lo confirmó
  el usuario. El proceso no exponía un puerto de depuración en sus argumentos.
- Los lanzadores de `/opt/youtube/` usan Cobalt Evergreen y el backend multimedia
  de Hisense. `libcobalt.lz4` está en el contenido de la app, dentro de `/opt`
  montado de solo lectura. Odin y la app original abren YouTube TV con motores
  distintos. No se confirmó una interfaz de userscripts en Cobalt.
- La prueba original respalda priorizar Cobalt para evaluar compatibilidad de
  TubeFree. El binario local contiene la opción `--url=`. Queda por verificar
  su comportamiento con `research/cobalt/test.html` en una sesión de prueba.
  La app original quedó corriendo durante la inspección. La reproducción
  estable sin anuncios todavía no está verificada.

### Prueba local de Cobalt Evergreen

- `secure_exec youtube` aplicó uid/gid 321. El lanzador oficial recibió
  `--url=http://…/test.html`, pero el servidor de la Mac no recibió la petición.
- El binario y `/opt/youtube/status.ini` identifican el modo del fabricante
  `YOUTUBE_SET_URL_TEST=1`, con `YOUTUBE_START_URL` como URL de prueba.
- Se compiló `research/cobalt/run_isolated.c` para ARM de 32 bits. Crea un espacio
  de montajes privado, desactiva la propagación y monta una copia de `status.ini`
  para la instancia de prueba. El binario y las copias de prueba quedaron en
  `/APPS/.tubefree/cobalt-probe/`.
- El servidor restringido a la IP de la TV recibió `/test.html` en dos
  arranques con ese modo. Cobalt 25 LTS pasó a `kApplicationStateFrozen` en
  unos 180 ms después de `kApplicationStateStarted`. El log registra que la
  aplicación arrancó fuera de APM. No llegaron las señales de HTML analizado
  ni JavaScript iniciado. El acceso local quedó confirmado, las APIs aún no.
- Ambas instancias salieron. Se comprobó que `/opt/youtube/status.ini` sigue
  en modo `YOUTUBE_SET_URL_TEST=0` con MD5 `d8e05c04e3b7bcee989dde5ba633c8a3`. <!-- checksum / revisión de origen -->
- Para medir las APIs hace falta una prueba en primer plano gestionada por APM.
  La prueba aislada no estableció una forma de activar ese ciclo desde SSH.

### Prueba en primer plano desde el menú

- Con autorización del usuario se montó temporalmente la copia de `status.ini`
  con un temporizador de 120 s y retirada automática. El usuario abrió YouTube
  original desde VIDAA. APM inició Cobalt y el log registró `PushTestUrl`.
- La Mac recibió peticiones de `/test.html`. No llegaron las señales de HTML
  ni JavaScript. La pantalla mostró «sin internet» y el log registró
  `updateAppNetErrorTips`. El registro no da un motivo de red más específico.
- Se retiró el montaje y se cerró el proceso de prueba que APM había dejado
  activo. `YOUTUBE_SET_URL_TEST=0`, sin montaje sobre el archivo y con su MD5
  original `d8e05c04e3b7bcee989dde5ba633c8a3`. <!-- checksum / revisión de origen -->
