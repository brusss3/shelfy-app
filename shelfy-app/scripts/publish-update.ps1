# Pubblica un aggiornamento "in volo" (solo JavaScript e risorse) sul canale
# preview: le app installate dall'APK del sito lo scaricano da sole all'avvio e
# lo applicano alla riapertura successiva, senza nuovo APK.
# Vale solo se il codice nativo non è cambiato (nuove librerie, permessi,
# icone): in quel caso serve scripts/build-preview.ps1 + publish-apk.ps1.
# Uso: .\scripts\publish-update.ps1 "messaggio breve"

param([string]$Message = "Aggiornamento")

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

Write-Host "==> EAS Update (canale preview)" -ForegroundColor Cyan
cmd /c "eas update --channel preview --environment preview --message `"$Message`" --non-interactive 2>&1"
if ($LASTEXITCODE -ne 0) { throw "EAS Update fallito (exit $LASTEXITCODE)" }
