# Avvia la build Android "preview" (APK, distribuzione interna) su EAS.
# Gira in cloud: puoi chiudere il terminale dopo l'upload, il link finale
# arriva anche via mail/dashboard Expo.
# Uso: .\scripts\build-preview.ps1

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

Write-Host "==> EAS build Android (profilo preview)" -ForegroundColor Cyan
eas build --platform android --profile preview --non-interactive
if ($LASTEXITCODE -ne 0) { throw "Build EAS fallita (exit $LASTEXITCODE)" }
