# Zona de Repartidores

## Versión local

1. Extrae **todo** el contenido de `Repartidores-local.zip` en una carpeta de Windows de 64 bits. No abras el ejecutable dentro del ZIP.
2. Abre `Repartidores.exe`. Se iniciará el servidor local y se abrirá la página en tu navegador. No se necesita Visual Studio ni instalar SQL Server.
3. La primera vez, crea la cuenta de administrador. Guarda la contraseña: no se incluye una contraseña predeterminada.
4. Mantén abierta la pequeña ventana de la aplicación mientras usas la página. Pulsa **Cerrar aplicación** al terminar.

La base se guarda en `datos/repartidores.sqlite`, dentro de la carpeta extraída. Haz una copia de ese archivo para respaldar los registros. Cada computadora conserva datos propios; las copias no se sincronizan entre sí.

Los mapas y el cálculo de rutas consultan servicios externos, por lo que esas partes requieren Internet. El resto de los registros se guarda localmente. La validación de direcciones de esta versión es una comprobación básica por texto y no sustituye la verificación de una dirección real.

## Código fuente

La interfaz está en `chido.html`. `adaptador-datos.js` conecta la página con la API. `servicio-datos.mjs` contiene las operaciones compartidas por el servidor local y la versión web. `servidor-local.mjs` guarda los registros en SQLite. El proyecto `lanzador` produce el ejecutable de Windows.

Para desarrollo, instala Node.js 22 o posterior y el SDK de .NET 9; después ejecuta `npm ci` y `powershell -File herramientas/empaquetar-local.ps1`. Las personas que solo revisen el prototipo no necesitan esas herramientas.

## Versión web

Demo publicada: https://repartidores-demo.angelguerrero9478.workers.dev

La primera vez, abre ese enlace y crea el administrador con tu correo, una contraseña de al menos 10 caracteres y el código de preparación entregado por separado. Ese código solo se necesita para crear el primer administrador. Después podrás dar de alta comercios y repartidores desde la página.

Todas las personas que entren en la web comparten los registros de D1. La versión del ejecutable mantiene su propia base SQLite en cada computadora; sus datos no se sincronizan con la web. No se han importado registros de Firebase.

La versión web usa el mismo código de interfaz y API con Cloudflare Workers y D1. La configuración está en `wrangler.jsonc` y la creación de tablas en `migraciones/0001_inicial.sql`. Para actualizar esta publicación, inicia sesión con `npx wrangler login --scopes account:read user:read workers_scripts:write d1:write`, ejecuta `npm run compilar:web` y después `npx wrangler deploy`. Las migraciones adicionales se aplican con `npx wrangler d1 migrations apply DB --remote`.

El código de primera preparación está guardado como secreto `CLAVE_PREPARACION` del Worker. Nunca incluyas ese código ni las contraseñas en GitHub. Si despliegas una copia en otra cuenta, crea allí una base D1, cambia `account_id` y `database_id` en la configuración y establece su propio secreto con `npx wrangler secret put CLAVE_PREPARACION`.

Para probar la versión web sin publicarla: `npx wrangler d1 migrations apply DB --local`, luego `npm run compilar:web` y `npx wrangler dev --var CLAVE_PREPARACION:un-codigo-de-prueba`. Esa prueba tiene una base separada de la versión local y de la publicada.
