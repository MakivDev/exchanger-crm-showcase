#!/bin/bash
# Спільний виклик docker compose: з Caddy, якщо в .env задано DOMAIN.
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

compose_cmd() {
  local domain=""
  if [ -f .env ]; then
    domain="$(grep -E '^DOMAIN=' .env 2>/dev/null | cut -d= -f2- | tr -d '\r' | tr -d '"' | tr -d "'" || true)"
  fi
  if [ -n "${domain}" ]; then
    docker compose -f docker-compose.yml -f docker-compose.caddy.yml "$@"
  else
    docker compose "$@"
  fi
}

compose_cmd "$@"
