#!/bin/bash
# Увімкнути HTTPS (Caddy у Docker) після того, як DNS A вже вказує на цей сервер.
# Запуск: ./scripts/vps-enable-https.sh your-domain.com
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

DOMAIN_ARG="${1:-}"
if [ -z "${DOMAIN_ARG}" ]; then
  echo "Використання: ./scripts/vps-enable-https.sh your-domain.com"
  exit 1
fi

# Прибрати протокол / слеші, якщо вставили URL
DOMAIN_ARG="${DOMAIN_ARG#https://}"
DOMAIN_ARG="${DOMAIN_ARG#http://}"
DOMAIN_ARG="${DOMAIN_ARG%%/*}"

if [ ! -f .env ]; then
  echo "Немає .env — спочатку ./scripts/vps-install.sh"
  exit 1
fi

# Якщо раніше ставили Caddy на хост — зупинити, щоб не зайняти 80/443
if systemctl is-active --quiet caddy 2>/dev/null; then
  echo "==> Зупинка системного Caddy (порти 80/443 займе Docker)"
  systemctl stop caddy
  systemctl disable caddy 2>/dev/null || true
fi

set_env() {
  local key="$1"
  local val="$2"
  if grep -q "^${key}=" .env; then
    sed -i "s|^${key}=.*|${key}=${val}|" .env
  else
    echo "${key}=${val}" >> .env
  fi
}

echo "==> .env: DOMAIN=${DOMAIN_ARG}, COOKIE_SECURE=true, APP_URL"
set_env DOMAIN "${DOMAIN_ARG}"
set_env COOKIE_SECURE true
set_env APP_URL "https://${DOMAIN_ARG}"

echo "==> Запуск compose з Caddy"
docker compose -f docker-compose.yml -f docker-compose.caddy.yml up -d --build

echo ""
echo "==> Статус"
docker compose -f docker-compose.yml -f docker-compose.caddy.yml ps

echo ""
echo "Готово. Відкрий:"
echo "  https://${DOMAIN_ARG}/login"
echo ""
echo "Порти 80 і 443 мають бути доступні з інтернету."
echo "Оновлення надалі: ./scripts/vps-update.sh (підхопить Caddy автоматично)."
