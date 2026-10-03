#!/bin/bash
# Перший деплой CRM на чистому VPS (Ubuntu + Docker).
# Запуск з кореня репозиторію: ./scripts/vps-install.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

# Підтягнути код (локальні правки scripts/ часто блокують pull після chmod)
if [ -d .git ]; then
  echo "==> git pull"
  git checkout -- scripts/ Dockerfile docker-compose.yml docker-entrypoint.sh 2>/dev/null || true
  git fetch origin
  git reset --hard origin/main
  find scripts -name '*.sh' -exec chmod +x {} \; 2>/dev/null || true
  chmod +x docker-entrypoint.sh 2>/dev/null || true
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker не знайдено. Спочатку:"
  echo "  curl -fsSL https://get.docker.com | sh"
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose не знайдено."
  exit 1
fi

if [ ! -f .env ]; then
  echo "==> Створення .env з .env.example"
  cp .env.example .env

  if command -v openssl >/dev/null 2>&1; then
    PASS="$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)"
    if grep -q '^POSTGRES_PASSWORD=' .env; then
      sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${PASS}|" .env
    else
      echo "POSTGRES_PASSWORD=${PASS}" >> .env
    fi
    # Підставити той самий пароль у DATABASE_URL (для локальних інструментів)
    if grep -q '^DATABASE_URL=' .env; then
      sed -i "s|change_me_strong_password|${PASS}|g" .env
    fi
    echo ""
    echo "Згенеровано пароль БД (збережи його): ${PASS}"
    echo ""
  else
    echo "Увага: зміни POSTGRES_PASSWORD у файлі .env перед продакшеном."
  fi

  if ! grep -q '^COOKIE_SECURE=' .env; then
    echo "COOKIE_SECURE=false" >> .env
  else
    sed -i 's|^COOKIE_SECURE=.*|COOKIE_SECURE=false|' .env
  fi
fi

echo "==> Збірка та запуск"
chmod +x scripts/compose.sh scripts/vps-*.sh 2>/dev/null || true
find scripts -name '*.sh' -exec chmod +x {} \; 2>/dev/null || true
./scripts/compose.sh up -d --build

echo ""
echo "==> Міграції / seed"
./scripts/compose.sh logs migrate --tail 40

echo ""
echo "==> Статус"
./scripts/compose.sh ps

APP_PORT="$(grep -E '^APP_PORT=' .env 2>/dev/null | cut -d= -f2- || echo 3000)"
IP="$(curl -4 -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"
DOMAIN="$(grep -E '^DOMAIN=' .env 2>/dev/null | cut -d= -f2- | tr -d '\r' | tr -d '"' | tr -d "'" || true)"

echo ""
echo "Готово. Відкрий у браузері:"
if [ -n "${DOMAIN}" ]; then
  echo "  https://${DOMAIN}/login"
else
  echo "  http://${IP}:${APP_PORT}/login"
  echo ""
  echo "Коли буде домен (DNS A → цей IP):"
  echo "  ./scripts/vps-enable-https.sh твій-домен.com"
fi
echo ""
echo "Перший візит — майстер налаштування (адмін, точки, каси, довідники)."
echo "Оновлення коду надалі: ./scripts/vps-update.sh"
