# Avvia la build Android "development" (dev-client) su EAS.
# Serve solo quando cambi config nativa (app.json/plugin, nuovi pacchetti
# nativi) - per le sole modifiche JS basta "npx expo start" sulla build
# gia' installata.
# Uso: .\scripts\build-dev.ps1

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

Write-Host "==> EAS build Android (profilo development)" -ForegroundColor Cyan
eas build --platform android --profile development --non-interactive
if ($LASTEXITCODE -ne 0) { throw "Build EAS fallita (exit $LASTEXITCODE)" }
