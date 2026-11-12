# Lo que se complicó y cómo lo distinguimos

| Problema | Evidencia y decisión |
| --- | --- |
| IP de la TV cambiante | Se reencontró por SSDP/TCP; se conservó la clave de host al pasar a otra IP. Un barrido sin respuesta no bastó para declarar la TV apagada. |
| Carpetas con nombres de otros modelos | Los pasos HU40 estaban en `he40` y `u7q`. La identidad real vino del runtime y del control del IPK; no del nombre de carpeta. |
| Root frente a cuenta de aplicación | Se verificó UID 0 por SSH. Tener un puerto abierto o respuesta FaaS no basta para afirmar root. |
| BusyBox reducido | No existen `sha256sum`, `tr` ni `nohup` en este firmware. Se usó Phoenix/Node para hashes y procesos controlados. |
| PATH de SSH | Las sesiones requieren declarar las rutas del sistema; una orden no encontrada no significa que el binario no exista. |
| Caché del HOME | Hay cachés compiladas, sin compilar y CSS; se apartaron con respaldo al instalar. |
| Reinicio del HOME | No se confió en que APM lo recreara. Se conservaron entorno, argumentos, directorio e identidad del proceso vivo y se comprobó estabilidad tras relanzarlo. |
| Galaxia aparentemente inmóvil | Cobalt devolvía true para reduce y no-preference simultáneamente. Se acepta preferencia reducida solo si no es ambigua. |
| Lectura engañosa de transform | getComputedStyle devolvía el valor base aunque la animación avanzaba. La prueba útil fue comparar capturas HAL. |
| Captura de pantalla | La captura HAL es asíncrona; hay que esperar al archivo. El framebuffer no se usa como prueba de render. |
| Grid sin movimiento perceptible | Se añadió desplazamiento de vecinas, elevación/escala de foco y transición de página; las posiciones de navegación siguen estables. |
| Demasiadas ayudas y títulos | Se quitaron las ayudas inferiores de Inicio/apps, se centraron y bajaron favoritas, y el contador pasó al pie del grid. |
| Casi todas las tarjetas azules | Solo había seis grupos de color. Se cubrieron 43 apps del catálogo y los nombres TubeFree/FOX Sports. Los campos de color del catálogo estaban vacíos. |
| Volumen sin cifra en la barra | La barra física no muestra números. Se muestra el dato real CEC del servicio de TV cuando es válido, no una estimación por pulsaciones. |

## TubeFree: no confundir señales parciales con éxito

- Un archivo instalado no demuestra que su userscript se ejecute.
- La ausencia de una variable global tampoco demuestra que no se ejecute:
  la recarga mostró logs aunque las declaraciones pudieran estar envueltas.
- `zz_pot` tenía propietario root y modo 0640; Odin corría como 313 y no podía
  leerlo. Se corrigió a 313:313, 0440 y metadatos userscript explícitos.
- El bundle accedía a `document.body` demasiado pronto. Se retrasó el bootstrap.
- El botón Atrás llegaba como Backspace; el adaptador lo traduce a Escape.
- Cambiar SABR o versión del cliente produjo tanto errores inmediatos como
  agotamiento tardío del búfer. Las opciones quedaron desactivadas por defecto.
- Crear una Request desde un ReadableStream introdujo preflights rechazados.
  La clonación de bytes y opciones corrigió esa parte, no la reproducción completa.
- Generar un token no demostró aceptación por el servidor. UMP status 3 seguía
  apareciendo, incluso después de insertar los bytes en el protobuf 19/2.
- El corte también se reprodujo sin el minter personalizado; TizenTube y codecfix
  seguían activos, por lo que no era una línea base totalmente limpia.
- Dejar cargar `ad_status.js` no resolvió el problema; se restauró hosts.
- El selector de perfiles y una pantalla negra sin solicitudes no cuentan como
  segundos de reproducción. El propietario debía elegir perfil y pulsar Play.
- YouTube original usa otro motor: su éxito no valida Odin ni el adblock.
- Cobalt pidió la página local, pero no confirmó ejecución de JavaScript. Fuera
  de APM se congelaba; desde el menú mostró «sin internet». Se retiró el montaje
  temporal de configuración y se verificó el original.

La [auditoría cronológica](TUBEFREE-AUDIT-2026-11-11.md) conserva los diagnósticos
iniciales junto con sus correcciones. Las notas antiguas de v4 no describían
el wrapper tf10.1 final; esa contradicción se resolvió comprobando archivos vivos.
