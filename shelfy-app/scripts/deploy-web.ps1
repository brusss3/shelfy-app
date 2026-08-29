# Rigenera l'export web (dist/) e lo pubblica su Firebase Hosting.
# Uso: .\scripts\deploy-web.ps1  (da qualunque cartella)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

Write-Host "==> Export web (expo export -p web)" -ForegroundColor Cyan
npx expo export -p web
if ($LASTEXITCODE -ne 0) { throw "Export web fallito (exit $LASTEXITCODE)" }

Write-Host "==> Deploy Firebase Hosting" -ForegroundColor Cyan
npx firebase-tools deploy --only hosting
if ($LASTEXITCODE -ne 0) { throw "Deploy Firebase fallito (exit $LASTEXITCODE)" }

Write-Host "==> Fatto: https://shelfy-632e0.web.app" -ForegroundColor Green
