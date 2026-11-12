# Alcance del repositorio público

Este es un snapshot selectivo de fuentes editables y documentación de la sesión
HU40, preparado el 12 de noviembre de 2026. Conserva el crédito de Alvidaa,
TizenTube y Free My TV. No importa el historial Git local ni presenta las pruebas
de otros modelos como si se hubieran ejecutado en esta pantalla.

## Incluido

- Frontend HOME, plataforma/entrada nativa, assets de galaxia y pruebas.
- Constructores de presentación y helper reversible de despliegue HU40.
- Scripts usados para reconstruir la cadena fetcher/FaaS/superwatch/IPK y las
  recetas heredadas de construcción de Dropbear e IPK, con alcance documentado.
- Adaptador editable TubeFree, codecfix, minter experimental opt-in y pruebas.
- Fuentes de la prueba local Cobalt, con sus resultados negativos documentados.
- Una captura revisada del menú de apps, sin perfiles ni contenido reproducido.
- Auditoría saneada y registro de instalación sin IP privada ni PID de sesión.

## Excluido

Claves privadas y públicas de la sesión, claves de host, MAC, seriales, cuentas,
cookies, tokens, URLs firmadas, capturas CDP/red, logs completos, preferencias,
catálogos originales, instaladores con claves incluidas, archivos de firmware,
player/base.js de YouTube, librerías y binarios del fabricante, node_modules,
archivos de respaldo y mecanismos experimentales antiguos no necesarios.

## Transformaciones editoriales

- `fetcha.html`: URLs del host reemplazadas por `location.origin`.
- Servidor recon: añadidas al mapa estático las dos páginas de la cadena HU40.
- Wrapper TubeFree: bundle minificado extraído y sustituido por marcador;
  se reconstruye desde upstream con comprobación de hash.
- Minter: constantes de servicio sustituidas por configuración explícita de
  laboratorio; sigue apagado por defecto y no se presenta como arreglo.
- Builder HOME: utilidad hash desacoplada del antiguo helper de pruebas de
  otro modelo; conserva la comprobación de la revisión original.
- Auditoría: IP/MAC/constantes de servicio retiradas; resultados, tiempos y
  correcciones preservados. Referencias a helpers privados marcadas como tales.

[SOURCE-MANIFEST.json](SOURCE-MANIFEST.json) registra el subconjunto inicialmente
copiado y sus hashes de origen antes del saneamiento. No es un inventario completo
de cada documento nuevo ni una prueba de ejecución física. Los hashes largos del
registro HOME son checksums de archivos, no credenciales.

Las pruebas de publicación son locales. No se ha vuelto a rootear, flashear ni
modificado la TV para subir este repositorio. Las recetas auxiliares nuevas de
empaquetado/saneamiento no implican una prueba desde fábrica del procedimiento.

El paquete npm incluye dos bytes NUL literales en strings del parser. El wrapper
local los había escapado como `\0`. El builder verifica el hash original, aplica
únicamente ese escape y verifica el hash normalizado del snapshot local.

## Comprobaciones automáticas

Las 27 pruebas y el chequeo de publicación pasaron localmente. La credencial de
publicación carece del permiso `workflow`; GitHub rechazó añadir el workflow.
Se conserva una plantilla en `scripts/github-actions.example.yml`, que el
propietario puede copiar a `.github/workflows/check.yml` con una autorización
que admita Actions. No se afirma que haya un run CI remoto aprobado.
