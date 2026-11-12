# Root y SSH en HU40E5600FFWV / V0000.09.09K.P1218

## Qué está demostrado

La inspección del 11 de noviembre confirmó root por SSH: `busybox id` dio
uid/gid 0 y Dropbear estaba en `/APPS/.re_sshd/`, puerto 8008. El runtime reportó
HU40E5600FFWV, MTK9602, ARMv7 y firmware V0000.09.09K.P1218.

La reconstrucción de la adquisición inicial procede de `fetcha.html`,
`trigger.html`, `sw2.js`, el constructor del IPK y el paquete local conservado.
Su control declara `Architecture: mtk9602`, `Userid: 0:0` y `re.installer`.
No se conservan aquí logs completos de aquella adquisición ni se volvió a
rootear una TV de fábrica para esta publicación. No se debe confundir esa
reconstrucción con una prueba nueva de cada paso.

## Preparación

1. Comprueba modelo y firmware desde la TV. No avances si no coinciden.
2. Usa una LAN de confianza y localiza la TV mediante el router o SSDP. La IP
   cambia con DHCP; un barrido TCP breve falló una vez y luego el equipo respondió.
   No uses solo ping para decidir si está encendida.
3. Conserva los originales y metadatos de cualquier archivo que vayas a editar.
   No publiques dumps del sistema, cookies, identificadores ni claves.
4. Genera tu propia clave Ed25519 y guarda su parte privada fuera del árbol público.
   Solo la `.pub` entra en tu IPK privado. Nunca uses un instalador de otra persona
   que ya contenga una clave autorizada.
5. Compila Dropbear ARMv7 con la receta heredada
   `tools/u7q/scripts/build_dropbear_a7k.sh`. Requiere Linux, compilador cruzado,
   fuente Dropbear 2022.83 y utilidades de compilación. El script comprueba el
   tarball. Su nombre viene de la referencia 55A7KAU; no identifica esta TV.
   El directorio `DROPBEAR_BUILD` se borra al compilar: debe ser exclusivo del build.

```sh
ssh-keygen -t ed25519 -f /ruta/privada/tv_root_ed25519
# Tras preparar compilador, tarball y revisar la receta:
bash tools/u7q/scripts/build_dropbear_a7k.sh
python3 tools/u7q/scripts/make_min_installer.py \
  --arch mtk9602 --shell /bin/sh \
  "$(cat /ruta/privada/tv_root_ed25519.pub)" \
  tools/he40/recon/pub/installer.ipk
```

El builder conserva por procedencia un valor predeterminado de otra familia:
**es necesario pasar `--arch mtk9602`**. El IPK y los binarios resultantes están
excluidos de Git. La receta publicada es mínima; no empaqueta listas de bloqueo
ni incorpora los respaldos o mecanismos de persistencia privados de esta TV.

## Cadena documentada

```text
navegador de la TV → basic/fetcher
  → escribe sw2.js en el directorio FaaS y descarga installer.ipk
  → función basic/fetch/sw2
  → /var/run/superwatch_socket, operación 53
  → instalación de re.installer, postinst con UID 0
  → Dropbear con autenticación por clave, puerto 8008
```

1. Sirve la carpeta `tools/he40/recon` en la LAN. El servidor heredado tiene un
   canal de comandos sin autenticación: úsalo solo en una red controlada y ciérralo
   al terminar. Las rutas añadidas `fetcha.html` y `trigger.html` permiten servir
   los archivos de esta cadena; los POST quedan en capturas privadas.

   ```sh
   python3 tools/he40/recon/server.py --bind 0.0.0.0 --port 9000
   ```

2. Abre `http://<HOST_IP>:9000/fetcha.html` en el navegador de la TV. La página
   arranca `phoenix://service/basic/fetcher` por `wss://localhost:9888` y usa
   `vowOS.service.syncExecute` / `fetchFile`. En la copia pública las URLs usan
   `location.origin`, para no depender de la IP privada de la sesión original.
3. El fetcher coloca la función en
   `/APPS/pkgs/tv.vidaa.jsservice.basic/CHA/functions/fetch/sw2.js` y el IPK en
   `/APPS/installer.ipk`. La lectura de comprobación utiliza `HiUtils_createRequest`
   con `fileRead`; no se intenta convertir el paquete binario a texto.
4. Después de comprobar el archivo, `trigger.html` llama a
   `https://localhost:9888/function/basic/fetch/sw2`.
   El mensaje documentado es `77:53:77;/APPS/installer.ipk;re.installer;`.
5. `sw2.js` abre el socket superwatch, antepone la longitud de 32 bits little-endian
   y envía el mensaje. Una respuesta del socket **no prueba** que el instalador
   haya corrido: se consulta `/APPS/.re_sshd/installer_log.txt` y TCP 8008.
6. El `postinst` coloca Dropbear, la clave autorizada y `/APPS/shell`, genera una
   clave de host si no existe, ajusta PTY y abre el puerto en la cadena de firewall
   del equipo. La evidencia decisiva es el UID del instalador y una sesión root.
7. Verifica la clave de host por un canal de confianza al conectarte por primera
   vez y conserva ese pin. No desactives `StrictHostKeyChecking` para resolver DHCP.

```sh
ssh -p 8008 -i /ruta/privada/tv_root_ed25519 root@<TV_IP> \
  'export PATH=/usr/local/bin:/bin:/usr/bin:/sbin:/usr/sbin; busybox id; busybox uname -m'
```

Los scripts pueden regresar a `recon.html` para restaurar el canal de inspección.
No ejecutar dos clientes MQTT con la misma identidad emparejada a la vez.

## Persistencia, mantenimiento y salida

SSH activo no prueba que la cadena sobreviva a desenchufar la TV. El paquete
inspeccionado declara `Persistent: false`; la sesión tenía archivos adicionales
instalados, pero esta publicación no reconstruye como verificado un hook de boot
que no se auditó de extremo a extremo. Registra una prueba en frío antes de
considerar terminada la persistencia.

Antes de modificar UI, congela los endpoints de OTA pertinentes y preserva las
reglas existentes. El instalador visual añade temporalmente un bloqueo para
el UID del actualizador durante la transacción y lo retira al finalizar; eso
no sustituye una política permanente de actualización.

Para retirar el trabajo, primero restaura HOME con su respaldo, y después
revisa el estado real de persistencia y firewall antes de retirar Dropbear y sus
archivos. No se ofrece un `rm -rf` universal: la revisión inicial no documentó
cada hook persistente. Nunca borres la única vía de recuperación antes de
comprobar que el HOME original arranca.

Las instrucciones son investigación sobre una TV propia. No requieren flashear,
desactivar verified boot, tocar `/OAD` ni escribir particiones de solo lectura.
