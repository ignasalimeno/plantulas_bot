#!/usr/bin/env bash
set -euo pipefail

export PYTHONUNBUFFERED=1
export PYTHONPATH=${PYTHONPATH:-.}

echo "[render_start] Applying DB migrations..."
alembic upgrade head

if [[ "${RUN_DB_SEED:-false}" == "true" ]]; then
  echo "[render_start] Seeding demo data..."
  python -m app.seed || echo "[render_start] Seed failed or skipped"
fi

echo "[render_start] Starting Uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
