#!/bin/bash
# Оновлення CRM після git push (дані зберігаються).
# Запуск: ./scripts/vps-update.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

echo "==> git pull"
# На VPS chmod/CRLF часто лишає локальні diff на scripts і блокує merge
git fetch origin
git checkout -- scripts/ Dockerfile docker-compose.yml docker-entrypoint.sh 2>/dev/null || true
git reset --hard origin/main
find scripts -name '*.sh' -exec chmod +x {} \; 2>/dev/null || true
chmod +x docker-entrypoint.sh 2>/dev/null || true

echo "==> Збірка та перезапуск"
./scripts/compose.sh up -d --build

echo ""
echo "==> Міграції"
./scripts/compose.sh logs migrate --tail 40

echo ""
echo "==> Статус"
./scripts/compose.sh ps

APP_PORT="$(grep -E '^APP_PORT=' .env 2>/dev/null | cut -d= -f2- || echo 3000)"
DOMAIN="$(grep -E '^DOMAIN=' .env 2>/dev/null | cut -d= -f2- | tr -d '\r' | tr -d '"' | tr -d "'" || true)"
IP="$(hostname -I | awk '{print $1}')"
echo ""
if [ -n "${DOMAIN}" ]; then
  echo "Готово. Оновіть сторінку (Ctrl+F5): https://${DOMAIN}"
else
  echo "Готово. Оновіть сторінку (Ctrl+F5): http://${IP}:${APP_PORT}"
fi
