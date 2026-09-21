#!/usr/bin/env bash
# Levanta el stack completo en local: backend (8010) + frontend (5174).
# Usa los puertos 8010/5174 porque 8000/5173 están ocupados por otro proyecto.
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cleanup() {
  echo ""
  echo "Deteniendo..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "▶ Backend  → http://localhost:8010   (docs: http://localhost:8010/docs)"
cd "$DIR/backend"
source venv/bin/activate
uvicorn app.main:app --reload --port 8010 &
BACKEND_PID=$!

sleep 2

echo "▶ Frontend → http://localhost:5174"
cd "$DIR/frontend"
npm run dev -- --port 5174 &
FRONTEND_PID=$!

echo ""
echo "Listo. Abrí http://localhost:5174 (Ctrl+C para detener todo)."
wait
