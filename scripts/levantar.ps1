param(
  [switch]$Limpio,
  [int]$EsperaMaxima = 300
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

docker info *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Docker Desktop no está corriendo. Ábrelo y vuelve a ejecutar este script." -ForegroundColor Red
  exit 1
}

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Se creó .env a partir de .env.example"
}

if ($Limpio) {
  Write-Host "Borrando contenedores y volúmenes (datos de demo nuevos)..."
  docker compose down -v
}

docker compose up -d --build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Esperando a que el gateway esté sano..."
$limite = (Get-Date).AddSeconds($EsperaMaxima)
do {
  Start-Sleep -Seconds 3
  try { $ok = (Invoke-WebRequest -Uri "http://localhost:8080/salud" -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200 } catch { $ok = $false }
} until ($ok -or (Get-Date) -gt $limite)

if (-not $ok) {
  Write-Host "El gateway no respondió en $EsperaMaxima s. Revisa: docker compose ps" -ForegroundColor Red
  exit 1
}

docker compose ps --format "table {{.Service}}`t{{.Status}}"
Write-Host ""
Write-Host "Plaza Sinú está arriba:" -ForegroundColor Green
Write-Host "  Web       http://localhost:3000   (Modo sustentación: http://localhost:3000/?demo=1)"
Write-Host "  Gateway   http://localhost:8080"
Write-Host "  Swagger   http://localhost:8080/docs"
Write-Host "  RabbitMQ  http://localhost:15672"
