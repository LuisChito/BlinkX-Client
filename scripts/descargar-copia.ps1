# Descarga la «Copia de seguridad» de los 5 objetivos del reto (public/backup) con el backend local en Docker.
# Espera a que IRSA (NASA) vuelva a responder y entonces descarga todo: secuencias (parpadeo), resta/suma,
# espectro, composición, predicción, L2 / L2 color y cubo de 102 canales. Es reanudable: lo ya guardado se salta.
#
# Uso (PowerShell):  powershell -ExecutionPolicy Bypass -File scripts\descargar-copia.ps1
# Registro:          scripts\descargar-copia.log
$ErrorActionPreference = 'Continue'
$client  = Split-Path -Parent $PSScriptRoot
$backend = Join-Path (Split-Path -Parent (Split-Path -Parent $client)) 'NasaSpace'
$log     = Join-Path $PSScriptRoot 'descargar-copia.log'
$api     = 'http://localhost:8000'

function Log($m) { $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $m"; Write-Host $line; Add-Content -Path $log -Value $line -Encoding UTF8 }

function ApiUp {
  try { (Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 "$api/healthz").StatusCode -eq 200 } catch { $false }
}

Log "Inicio. Cliente: $client"
if (-not (ApiUp)) {
  Log "El backend local no responde; levantándolo con Docker ($backend)…"
  Push-Location $backend
  docker compose up -d 2>&1 | ForEach-Object { Log $_ }
  Pop-Location
  for ($i = 0; $i -lt 60 -and -not (ApiUp); $i++) { Start-Sleep -Seconds 5 }
  if (-not (ApiUp)) { Log 'ERROR: el backend local no arrancó. ¿Está abierto Docker Desktop?'; exit 1 }
}
Log 'Backend local en línea. Esperando a IRSA y descargando (puede tardar horas si IRSA sigue caído)…'

Push-Location $client
# --wait: revisa /api/status cada 60 s hasta que IRSA responda; luego descarga los 5 objetivos.
# Se repite hasta 3 veces por si algún paso falla a la mitad (IRSA intermitente); lo ya guardado no se repite.
for ($round = 1; $round -le 3; $round++) {
  Log "Ronda $round"
  node scripts/backup-demo.mjs --api $api --wait 2>&1 | ForEach-Object { Add-Content -Path $log -Value $_ -Encoding UTF8 }
  if ($LASTEXITCODE -eq 0) { Log 'Copia de seguridad completa.'; break }
  Log "Algunos pasos fallaron (código $LASTEXITCODE). Reintento en 2 min…"
  Start-Sleep -Seconds 120
}
Pop-Location
Log 'Fin. Revisa public/backup/manifest.json y haz commit de public/backup para publicarla.'
