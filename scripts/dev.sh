#!/usr/bin/env bash
# Start the Credent API (:8000) and web app (:3000). Ctrl+C stops both.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
(cd "$root/apps/api" && uv run uvicorn credent.main:app --port 8000 --reload --reload-dir credent) &
api=$!
trap 'kill $api 2>/dev/null' EXIT
cd "$root/apps/web" && pnpm dev
