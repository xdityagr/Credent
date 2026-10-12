# One-time setup for Credent on Windows (PowerShell 7+).
# Installs uv + pnpm if missing, syncs Python and JS deps, builds the ZK prover image.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
    Write-Host "Installing uv..." -ForegroundColor Cyan
    python -m pip install --user uv
}
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host "Installing pnpm..." -ForegroundColor Cyan
    Push-Location $env:TEMP; npm install -g pnpm@12.9.1; Pop-Location
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker is required for the ZK prover. Install Docker Desktop and start it."
}

Write-Host "Syncing Python backend..." -ForegroundColor Cyan
Push-Location (Join-Path $root "apps/api"); uv sync; Pop-Location

Write-Host "Installing web dependencies..." -ForegroundColor Cyan
Push-Location $root; pnpm install; Pop-Location

Write-Host "Building ZK prover image (Noir + Barretenberg)..." -ForegroundColor Cyan
Push-Location $root; docker build -f infra/prover/Dockerfile -t credent-prover .; Pop-Location

if (-not (Test-Path (Join-Path $root ".env"))) { Copy-Item (Join-Path $root ".env.example") (Join-Path $root ".env") }
Write-Host "Setup complete. Run scripts/dev.ps1" -ForegroundColor Green
