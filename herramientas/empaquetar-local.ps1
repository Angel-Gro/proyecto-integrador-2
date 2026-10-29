$ErrorActionPreference = 'Stop'
$raiz = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$salida = Join-Path $raiz 'distribucion\entrega-local'
if (Test-Path -LiteralPath $salida) { throw 'La carpeta de entrega ya existe. Revisa su contenido antes de crear otra.' }
New-Item -ItemType Directory -Path $salida | Out-Null
dotnet publish (Join-Path $raiz 'lanzador\Repartidores.csproj') -c Release -o $salida
if ($LASTEXITCODE -ne 0) { throw 'No se pudo compilar el lanzador.' }
Copy-Item -LiteralPath (Join-Path $raiz 'chido.html'),(Join-Path $raiz 'adaptador-datos.js'),(Join-Path $raiz 'servicio-datos.mjs'),(Join-Path $raiz 'servidor-local.mjs'),(Join-Path $raiz 'esquema.sql'),(Join-Path $raiz 'package.json'),(Join-Path $raiz 'package-lock.json') -Destination $salida
New-Item -ItemType Directory -Path (Join-Path $salida 'runtime') | Out-Null
$node = node -p "process.execPath"
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $node)) { throw 'No se encontro Node.js para empaquetar.' }
Copy-Item -LiteralPath $node -Destination (Join-Path $salida 'runtime\node.exe')
npm ci --omit=dev --prefix $salida
if ($LASTEXITCODE -ne 0) { throw 'No se pudieron preparar las dependencias locales.' }
Copy-Item -LiteralPath (Join-Path $raiz 'INSTRUCCIONES.md') -Destination $salida
$archivo = Join-Path $raiz 'distribucion\Repartidores-local.zip'
Compress-Archive -Path (Join-Path $salida '*') -DestinationPath $archivo -CompressionLevel Optimal
Write-Output $archivo
