# Zona de Repartidores — versión local

Prototipo local para registrar comercios, repartidores y pedidos. La interfaz procede de `chido.html` del equipo y los registros se guardan en SQLite.

## Abrir el prototipo

1. Descarga [Repartidores-local.zip](https://github.com/Angel-Gro/proyecto-integrador-2/raw/refs/heads/main/distribucion/Repartidores-local.zip).
2. Extrae todo el ZIP en una carpeta de Windows de 64 bits.
3. Abre `Repartidores.exe`. Aparecerá la aplicación en tu navegador con una dirección local.
4. La primera vez, crea tu administrador con un correo como identificador y una contraseña de al menos 10 caracteres.
5. Inicia sesión como administrador para registrar los comercios y repartidores.
6. Mantén abierta la pequeña ventana de la aplicación y pulsa **Cerrar aplicación** al terminar.

Para revisar el prototipo no se necesita Visual Studio, Node.js ni instalar SQL Server. Abre el ejecutable después de extraer el ZIP; el HTML necesita el servidor incluido para leer y guardar los registros.

## Base de datos

El esquema está en `esquema.sql`. Al abrir la aplicación se crea automáticamente la base vacía en `datos/repartidores.sqlite`, junto al ejecutable. Cada computadora conserva sus propios registros y cuentas. Cierra la aplicación antes de copiar ese archivo para hacer un respaldo.

El repositorio y el ZIP no incluyen registros, cuentas ni contraseñas. No se han importado los datos antiguos de Firebase.

## Archivos del código

- `chido.html`: interfaz de la aplicación.
- `adaptador-datos.js`: comunicación entre la interfaz y el servidor local.
- `servidor-local.mjs` y `servicio-datos.mjs`: acceso a SQLite, cuentas y operaciones de datos.
- `esquema.sql`: estructura inicial de la base.
- `lanzador/`: código del ejecutable de Windows.
- `herramientas/empaquetar-local.ps1`: preparación del ZIP para compartir.

## Desarrollo

Para modificar el código, instala Node.js 20 o posterior y ejecuta `npm ci`. Inicia el servidor con `npm run iniciar` y abre `http://127.0.0.1:58734`.

Para generar un nuevo ejecutable y ZIP también se necesita el SDK de .NET 9. Ejecuta `powershell -File herramientas/empaquetar-local.ps1` cuando no exista una entrega anterior en `distribucion/entrega-local`.

Los mapas y el cálculo de rutas utilizan servicios externos y requieren Internet. La validación de direcciones de este prototipo es una comprobación básica por texto.
