# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

PlantulasBot: web app to manage an indoor coco/SCROG grow, with an AI chatbot. Monorepo:
- `backend/` — FastAPI + SQLAlchemy 2 + Alembic, PostgreSQL (Neon in prod), OpenAI for the chatbot.
- `frontend/` — React 18 + Vite + TypeScript + Tailwind + React Router.
- `raspberry/` — read-only bridge that reports Home Assistant sensor/state data to the backend (does not control anything; all automation lives in HA). See `raspberry/README.md` and `PENDIENTE.md` for the current (untested against real HA) state of this integration.
- `infra/` — docker-compose for local Postgres + pgAdmin.

## Commands

Run the whole local stack (backend :8010 + frontend :5174 — chosen because 8000/5173 are used by another project on this machine):
```bash
./dev.sh
```

Backend only:
```bash
cd infra && docker compose up -d        # Postgres + pgAdmin
cd backend
source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
python -m app.seed                       # optional demo data
uvicorn app.main:app --reload --port 8010
```
API at `http://localhost:8010`, docs at `/docs`.

Frontend only:
```bash
cd frontend
npm install
npm run dev -- --port 5174
npm run build     # tsc + vite build
npm run lint
```

Alembic migration (from `backend/`, venv active):
```bash
alembic revision --autogenerate -m "description"
alembic upgrade head
```

There is no automated test suite in this repo (no pytest/vitest configs). `deploy.sh` is the closest thing to a verification gate — it runs `npm run build` and a backend import check before committing and pushing to `main`.

Deploy (manual, from repo root):
```bash
./deploy.sh "commit message"
```
This builds the frontend, sanity-checks the backend import, commits, and pushes to `main`. Netlify (frontend) and Render (backend) auto-deploy from `main` — `render_start.sh` runs `alembic upgrade head` before starting uvicorn in prod, so any pending migration is applied on deploy.

## Architecture

**Backend** (`backend/app/`):
- `api/` — routers, one per domain: `dashboard`, `indoors`, `plants`, `grow`, `fertilizers`, `chat`, `devices`, `alerts`.
- `services/` — business logic: `indoor_service`, `plant_service`, `chat_service`, `device_service`, `environment_service`, `alert_service`.
- `models.py` — SQLAlchemy models. Core entities: `User` (identified by `telegram_user_id`, though the chat is now web-based) → `Indoor` (growing environment: temp/humidity/light/climate/pump, device entity mappings) → `Plant`s, plus `Measurement`, `WateringHistory`, `IndoorHistory` (event log, e.g. device on/off transitions), `Task`, `Fertilizer`/`FertilizerApplication`, `StageTarget`, `ChatMessage`.
- `stages.py` — ordered cultivation stages (`seedling` → `veg_early` → `veg_late` → `flower_early` → `flower_mid` → `flower_late` → `flush`) with default EC/pH/temp/humidity/light targets per stage, editable per indoor via `StageTarget`.
- `environment_service.py` — computes `current_environment`: the unified "latest reading" view combining measurements and waterings used throughout the panel and alerts.
- `chat_service.py` — the AI assistant: builds user/indoor context, runs OpenAI tool-calling. Tools are split into `READ_TOOLS` (status/history queries, including `analyze_indoor` which uses `AI_ANALYSIS_MODEL`) and `MUTATION_TOOLS` (water, add measurement, apply fertilizer, set stage/light/climate/humidifier, create/complete task). Mutations go through a **confirm step** (`POST /api/chat` proposes, `POST /api/chat/confirm` executes) rather than being applied directly.
- `main.py` — app wiring; also runs a background `_alert_loop` (every `ALERT_INTERVAL_SECONDS` = 300s) that evaluates alert rules via `alert_service.evaluate_all`.
- Config via `app/config.py` (pydantic-settings, reads `.env`): `DATABASE_URL`, `CORS_ORIGINS` (accepts CSV or JSON list), `OPENAI_API_KEY`, `AI_MODEL` (default `gpt-4o-mini`), `AI_ANALYSIS_MODEL` (default `o4-mini`).

**Frontend** (`frontend/src/`):
- `api/` — HTTP client + types, talks to `VITE_API_BASE_URL`.
- `components/` — `Layout`, modals, and domain groups: `Grow`, `Riego` (watering), `Fertilizers`, `Ambiente` (environment), `Collapsible`.
- `hooks/` — data-fetching hooks per domain.
- `pages/` — `Panel` (dashboard), `Indoors`, `IndoorDetail`, `Plants`, `Chat`.
- The panel is organized into collapsible sections: "Agua & Riego" and "Dispositivos & Ambiente".

**Device/Home Assistant integration** (read-only, in progress — see `PENDIENTE.md` for exact pending steps and untested pieces):
- `raspberry/bridge.py` polls HA every `INTERVAL_SECONDS` for sensor values and on/off states, and reports them to the backend (`POST /api/devices/telemetry` for sensor readings → becomes a `Measurement`; `POST /api/devices/state` for on/off state → logs transitions into `IndoorHistory`). It never writes to HA.
- Device entity_id mappings (which HA entity is the temp sensor, humidifier switch, etc.) live in the app per-device, not in the bridge's `.env`, fetched via `GET /api/devices/me`.
- `raspberry/simulate.py` lets you simulate bridge reports without real hardware/HA.
