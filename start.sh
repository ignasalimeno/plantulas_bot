#!/bin/bash

# Script para levantar el stack completo de PlantulasBot ETAPA 4

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Iniciando PlantulasBot Stack..."
echo ""

# Check if docker and docker-compose are available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker no está instalado. Por favor, instala Docker."
    exit 1
fi

# Start Docker containers
echo "1️⃣ Iniciando PostgreSQL + pgAdmin..."
cd "$SCRIPT_DIR/infra"
docker-compose up -d

# Wait for PostgreSQL to be ready
echo "   ⏳ Esperando a que PostgreSQL esté listo..."
sleep 5

# Start Backend
echo ""
echo "2️⃣ Iniciando FastAPI Backend (http://localhost:8000)..."
cd "$SCRIPT_DIR/backend"
source venv/bin/activate
uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!
echo "   ✅ Backend PID: $BACKEND_PID"

# Wait for backend to start
sleep 3

# Start Frontend
echo ""
echo "3️⃣ Iniciando React Frontend (http://localhost:5174)..."
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!
echo "   ✅ Frontend PID: $FRONTEND_PID"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ PlantulasBot Stack iniciado correctamente"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📍 URLs:"
echo "   • Frontend:  http://localhost:5174"
echo "   • Backend:   http://localhost:8000"
echo "   • API Docs:  http://localhost:8000/docs"
echo "   • pgAdmin:   http://localhost:5050"
echo ""
echo "💡 Para detener, presiona Ctrl+C"
echo ""

# Wait for user interrupt
wait
