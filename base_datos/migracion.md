# Base de datos

## Cambio de Firebase a SQLite

El prototipo utilizaba Firebase Authentication para el acceso y Cloud Firestore para guardar los registros. Durante las pruebas, el equipo observó un volumen alto de peticiones a Firebase y decidió cambiar el almacenamiento de la versión local.

Se eligió SQLite para poder revisar el prototipo en otras computadoras sin configurar Firebase ni instalar un servidor de base de datos. El motor está incluido en `Repartidores.exe` y guarda los registros en un archivo de la computadora.

## Qué cambió

- Se sustituyó el acceso a Firestore por consultas y escrituras en SQLite.
- Las cuentas y las sesiones se gestionan desde el servidor local, en lugar de Firebase Authentication.
- Se añadió un adaptador para conservar las operaciones que ya utilizaba la interfaz, como consultar colecciones, guardar documentos y actualizar las pantallas.

El recorrido de los datos es:

`repartidores.html → adaptador-datos.js → servidor local → repartidores.sqlite`

La interfaz utiliza `servidor/adaptador-datos.js` para enviar solicitudes a la aplicación local. `servidor/servidor-local.mjs` abre SQLite mediante `better-sqlite3`, crea las tablas si no existen y atiende las solicitudes en `127.0.0.1`. `servidor/servicio-datos.mjs` comprueba la sesión y el rol del usuario antes de realizar las operaciones.

Los nombres `collection`, `doc` y `onSnapshot` que aparecen en la interfaz pertenecen ahora al adaptador del proyecto. La versión local ya no carga el SDK de Firebase ni consulta Firestore.

## Actualización de las pantallas

Las pantallas consultan su estado de forma agrupada aproximadamente cada 20 segundos mientras la pestaña está visible y tiene consultas activas. También solicitan una actualización después de guardar cambios.

Estas solicitudes se atienden en la misma computadora. El cambio elimina las lecturas y escrituras remotas a Firebase de esta versión; la aplicación sigue haciendo solicitudes locales para mostrar y guardar los datos.

## Estructura actual

La estructura inicial está definida en [`esquema.sql`](esquema.sql):

| Tabla | Contenido |
| --- | --- |
| `documentos` | Registros de la aplicación. Cada fila contiene `coleccion`, `id`, `datos` en formato JSON y `version`. La combinación de colección e identificador es única. |
| `cuentas` | Identificador de cuenta, correo, una sal aleatoria y el hash de la contraseña. El correo es único. |
| `sesiones` | Token de sesión, cuenta asociada y fecha de vencimiento. Tiene una relación con `cuentas` y un índice por vencimiento. |

Dentro de `documentos` se distinguen las colecciones `usuarios`, `accesos`, `tiendas`, `repartidores`, `pedidos`, `reportes`, `colonias` e `historialDemanda`.

Se conservó la organización por documentos del prototipo para mantener la interfaz y sus datos compatibles durante el cambio. Por ahora, comercios y pedidos se guardan como documentos JSON dentro de SQLite; no tienen una tabla independiente por entidad.

Las contraseñas se guardan como hashes PBKDF2 con SHA-256 y una sal individual. Las sesiones se identifican mediante una cookie HTTP. Los valores de las consultas SQL se pasan como parámetros y las escrituras de un lote se agrupan en una transacción SQLite.

## Creación y ubicación

Al abrir el ejecutable por primera vez, la aplicación crea una base vacía y solicita crear el administrador. El archivo se guarda en:

```text
%LOCALAPPDATA%\Repartidores\datos\repartidores.sqlite
```

La base se conserva al cerrar o actualizar el ejecutable. Cada computadora tiene sus propias cuentas y registros; no hay sincronización entre computadoras.

Si se ejecuta el servidor directamente desde el código, utiliza la carpeta `datos` de la raíz del proyecto, salvo que se indique otra ubicación mediante `REPARTIDORES_DATOS`.

## Registros anteriores de Firebase

Se sustituyeron la conexión y el almacenamiento de la aplicación. Los registros antiguos de Firebase todavía no se han importado porque no se dispone de su exportación.

Cuando se obtenga esa exportación, habrá que revisar los campos, conservar los identificadores y las relaciones entre registros, convertir los formatos de fecha que correspondan y comprobar duplicados y cantidades antes de incorporarlos. Las cuentas de acceso de esta versión se crean desde la aplicación; la importación de cuentas de Firebase Authentication tampoco está implementada.

## Respaldo y recuperación

1. Cierra todas las ventanas de la aplicación con **Cerrar aplicación**.
2. Pulsa `Windows + R` y abre `%LOCALAPPDATA%\Repartidores`.
3. Copia la carpeta **`datos` completa**, con todos sus archivos, a una ubicación de respaldo.

La aplicación utiliza el modo WAL de SQLite. Además de `repartidores.sqlite`, pueden existir `repartidores.sqlite-wal` y `repartidores.sqlite-shm`. El archivo WAL puede contener cambios ya guardados y debe conservarse junto con la base; por eso se respalda la carpeta completa. [Referencia de SQLite](https://sqlite.org/wal.html).

Para recuperar un respaldo, cierra todas las ventanas de la aplicación y conserva una copia de la carpeta `datos` actual. Sustituye esa carpeta por la del respaldo completo, sin mezclar archivos de copias diferentes.

El repositorio contiene el esquema, no una copia con registros ni contraseñas. No se debe subir el archivo de datos a GitHub.

## Comprobaciones realizadas

Se comprobó el registro y acceso del administrador, el guardado de comercios y repartidores y el recorrido de un pedido hasta su entrega. También se probó el ejecutable como único archivo en una carpeta vacía y se verificó que la cuenta creada se conservara después de cerrar y volver a abrir la aplicación. Se comprobó además que un respaldo de la carpeta de datos completa permitiera recuperar la cuenta de prueba.
