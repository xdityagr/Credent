#!/usr/bin/env bash
# One-time setup for Credent on macOS/Linux.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"

command -v uv >/dev/null || { echo "Installing uv..."; curl -LsSf https://astral.sh/uv/install.sh | sh; }
command -v pnpm >/dev/null || { echo "Installing pnpm..."; npm install -g pnpm@12.9.1; }
command -v docker >/dev/null || { echo "Docker is required for the ZK prover." >&2; exit 1; }

(cd "$root/apps/api" && uv sync)
(cd "$root" && pnpm install)
(cd "$root" && docker compose -f infra/docker-compose.yml up -d)
(cd "$root" && docker build -f infra/prover/Dockerfile -t credent-prover .)
[ -f "$root/.env" ] || cp "$root/.env.example" "$root/.env"
echo "Setup complete. Run scripts/dev.sh"
