#!/usr/bin/env bash
# Start the Credent API (:8000) and web app (:3000). Ctrl+C stops both.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
docker compose -f "$root/infra/docker-compose.yml" up -d >/dev/null
(cd "$root/apps/api" && uv run uvicorn credent.main:app --port 8000 --proxy-headers --forwarded-allow-ips 127.0.0.1 --reload --reload-dir credent) &
api=$!
trap 'kill $api 2>/dev/null' EXIT
cd "$root/apps/web" && pnpm dev
