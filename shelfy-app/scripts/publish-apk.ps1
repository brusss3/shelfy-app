# Pubblica sul web l'ultimo APK (profilo "preview") costruito da EAS, al link
# fisso https://shelfy-632e0.web.app/download/shelfy.apk
# Prima lancia la build:  .\scripts\build-preview.ps1  e aspetta che finisca.
# Uso: .\scripts\publish-apk.ps1

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

Write-Host "==> Cerco l'ultima build preview finita" -ForegroundColor Cyan
$raw = eas build:list --platform android --build-profile preview --status finished --limit 1 --json --non-interactive | Out-String
if ($LASTEXITCODE -ne 0) { throw "eas build:list fallito (exit $LASTEXITCODE)" }
# eas-cli stampa avvisi prima del JSON: si parte dalla prima parentesi quadra.
$json = $raw.Substring($raw.IndexOf('['))
$build = ($json | ConvertFrom-Json) | Select-Object -First 1
if (-not $build -or -not $build.artifacts.buildUrl) { throw "Nessuna build preview finita con un APK scaricabile." }

Write-Host "==> Scarico l'APK della build $($build.id) (versione $($build.appBuildVersion))" -ForegroundColor Cyan
$dir = Join-Path $projectRoot "public\download"
New-Item -ItemType Directory -Force $dir | Out-Null
Invoke-WebRequest -Uri $build.artifacts.buildUrl -OutFile (Join-Path $dir "shelfy.apk")

# L'export web copia public/ in dist/, poi si pubblica tutto.
& (Join-Path $PSScriptRoot "deploy-web.ps1")
Write-Host "==> APK online: https://shelfy-632e0.web.app/download/shelfy.apk" -ForegroundColor Green
