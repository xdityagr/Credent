# Start the Credent API (:8000) and web app (:3000). Ctrl+C stops both.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

$api = Start-Process -PassThru -NoNewWindow -WorkingDirectory (Join-Path $root "apps/api") `
    -FilePath "uv" -ArgumentList "run", "uvicorn", "credent.main:app", "--port", "8000", "--reload", "--reload-dir", "credent"
try {
    Push-Location (Join-Path $root "apps/web")
    pnpm dev
} finally {
    Pop-Location
    if (-not $api.HasExited) { Stop-Process -Id $api.Id -Force }
}
