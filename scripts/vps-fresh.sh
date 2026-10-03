#!/bin/bash
# Повний сброс: БД. Код лишається.
# Запуск: ./scripts/vps-fresh.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

read -r -p "Це видалить УСІ дані CRM (база даних). Продовжити? [y/N] " ans
case "$ans" in
  y|Y|yes|YES) ;;
  *) echo "Скасовано."; exit 0 ;;
esac

echo "==> Зупинка та видалення volumes"
chmod +x scripts/compose.sh scripts/vps-*.sh 2>/dev/null || true
find scripts -name '*.sh' -exec chmod +x {} \; 2>/dev/null || true
./scripts/compose.sh down -v

echo "==> Збірка та запуск"
./scripts/compose.sh up -d --build

./scripts/compose.sh logs migrate --tail 40
./scripts/compose.sh ps

echo ""
echo "Чистий CRM готовий. Відкрий /login — знову майстер первинного налаштування."
echo "Якщо був HTTPS (DOMAIN у .env) — Caddy піднявся знову автоматично."
