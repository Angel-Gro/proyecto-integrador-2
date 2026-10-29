# Repartidores

Aplicación local para registrar comercios, repartidores y pedidos, con una base de datos SQLite.

## Abrir la aplicación

1. Descarga [Repartidores.exe](https://github.com/Angel-Gro/proyecto-integrador-2/raw/refs/heads/main/ejecutable/Repartidores.exe).
2. Haz doble clic en el archivo. La aplicación se abrirá en tu navegador.
3. La primera vez, crea tu administrador con un correo como identificador y una contraseña de al menos 10 caracteres.
4. Inicia sesión como administrador para registrar comercios y repartidores.
5. Mantén abierta la pequeña ventana de la aplicación y pulsa **Cerrar aplicación** al terminar.

Solo necesitas descargar ese ejecutable en Windows de 64 bits. Incluye los componentes necesarios y los prepara automáticamente, sin instalación ni archivos adicionales que debas copiar.

## Datos guardados

La aplicación crea su base vacía automáticamente. Guarda las cuentas y los registros en `%LOCALAPPDATA%\Repartidores\datos\repartidores.sqlite`. Cada computadora conserva sus propios datos.

Para respaldarlos, cierra la aplicación, pulsa `Windows + R`, escribe `%LOCALAPPDATA%\Repartidores\datos` y copia el archivo `repartidores.sqlite`.

El repositorio no incluye datos ni contraseñas. Los registros antiguos de Firebase todavía no se han importado.

## Contenido del repositorio

- `ejecutable/Repartidores.exe`: archivo único para abrir y compartir la aplicación.
- `repartidores.html`: interfaz.
- `servidor/`: código necesario para las cuentas, las operaciones y la conexión con SQLite.
- `base_datos/esquema.sql`: estructura para crear la base vacía.

Los mapas y el cálculo de rutas requieren Internet. La validación de direcciones de este prototipo es una comprobación básica por texto.
