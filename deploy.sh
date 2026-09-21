#!/usr/bin/env bash
# Deploy manual: build de verificación + commit + push a main.
# Netlify (front) y Render (back) auto-deployan desde la rama main.
#
# Uso:
#   ./deploy.sh "mensaje del commit"
#   ./deploy.sh                 # usa un mensaje por defecto
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

MSG="${1:-Deploy: actualización}"

echo "▶ 1/4  Verificando build del frontend..."
(cd frontend && npm run build >/tmp/deploy_build.log 2>&1) && echo "   build OK" || { echo "   ✗ Build falló:"; tail -20 /tmp/deploy_build.log; exit 1; }

echo "▶ 2/4  Verificando backend (import)..."
(cd backend && venv/bin/python -c "from app.main import app") && echo "   import OK" || { echo "   ✗ Backend no importa"; exit 1; }

echo "▶ 3/4  Commiteando..."
git add -A
if git diff --cached --quiet; then
  echo "   (sin cambios para commitear)"
else
  git commit -m "$MSG"
fi

echo "▶ 4/4  Pusheando a origin/main..."
git push origin main

echo ""
echo "✅ Listo. Netlify y Render van a auto-deployar desde main."
echo "   Front: https://iridescent-kheer-6fa223.netlify.app"
echo "   Back:  https://plantulas-bot.onrender.com/api/health"
