# PlantulasBot

App web para gestionar un cultivo de interior (coco / SCROG) con **chatbot AI** integrado. Monorepo con **FastAPI + PostgreSQL** (backend), **React + Vite + TypeScript + Tailwind** (frontend) y **OpenAI** para el asistente.

## Stack

- **Backend:** FastAPI, SQLAlchemy 2, Alembic, PostgreSQL (Neon en prod), OpenAI (`gpt-4o-mini`).
- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, React Router.
- **Infra:** Docker Compose (Postgres + pgAdmin) para desarrollo local.

## Estructura

```
plantulas_bot/
├── backend/                # FastAPI + SQLAlchemy + Alembic
│   ├── app/
│   │   ├── api/            # routers: dashboard, indoors, plants, grow, fertilizers, chat
│   │   ├── services/       # lógica: indoor, plant, chat (tool calling)
│   │   ├── models.py       # modelos SQLAlchemy
│   │   ├── schemas.py      # schemas Pydantic
│   │   ├── stages.py       # etapas de cultivo + objetivos por defecto
│   │   └── config.py       # settings (env)
│   ├── alembic/            # migraciones
│   └── render_start.sh     # start de producción (migra + uvicorn)
├── frontend/               # React + Vite
│   └── src/
│       ├── api/            # cliente HTTP + tipos
│       ├── components/     # Layout, Modals, Grow, Riego, Fertilizers, Ambiente, Collapsible
│       ├── hooks/          # hooks de datos
│       └── pages/          # Panel, Indoors, IndoorDetail, Plants, Chat
├── infra/                  # docker-compose (Postgres + pgAdmin)
├── render.yaml             # deploy (backend + static site) en Render
└── .env.example
```

## Funcionalidad

- **Panel** con resumen y próximos riegos.
- **Indoors** (carpas): alta, edición de ambiente/luz, ventilación, humidificador con umbrales.
- **Etapas de cultivo** (plantín → vege → flora → flush) con **objetivos** por etapa: EC, pH, temperatura, humedad, altura de luz, PPFD y horario. Editables.
- **Panel de indicadores (Ambiente):** compara la última medición contra los objetivos y marca OK/BAJO/ALTO.
- **Riego por indoor** (a todas las plantas o subset) con EC, pH, runoff y fertilizantes en **ml/L**; gráfico de litros + EC.
- **Mediciones** en el tiempo (temp, humedad, pH, EC, runoff, PPFD).
- **Fertilizantes:** catálogo + plan por indoor + aplicaciones.
- **Checklist** de monitoreo por etapa.
- **Chatbot AI (web):** consulta el estado e historial, analiza el cultivo (modelo avanzado) y ejecuta acciones (regar, medición, ferti, tarea, etapa, luz, clima) **con confirmación**.

## Desarrollo local

### 1. Variables de entorno

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env.local
```

Completá `DATABASE_URL` y `OPENAI_API_KEY` en `.env` / `backend/.env`.

### 2. Base de datos (Docker)

```bash
cd infra && docker compose up -d
```

### 3. Backend

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
python -m app.seed        # datos demo (opcional)
uvicorn app.main:app --reload --port 8010
```

API: `http://localhost:8010` · Docs: `http://localhost:8010/docs`

### 4. Frontend

```bash
cd frontend
npm install
npm run dev -- --port 5174
```

App: `http://localhost:5174`

> El frontend usa `VITE_API_BASE_URL` (por defecto `http://localhost:8000`). En `.env.local` se apunta al backend local.

## Variables de entorno

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Cadena de conexión PostgreSQL (`postgresql+psycopg://...`) |
| `CORS_ORIGINS` | Orígenes permitidos (CSV) |
| `OPENAI_API_KEY` | API key de OpenAI (chatbot) |
| `AI_MODEL` | Modelo (default `gpt-4o-mini`) |
| `AI_ANALYSIS_MODEL` | Modelo para análisis profundo del chatbot (default `o4-mini`) |
| `VITE_API_BASE_URL` | URL del backend para el frontend |

## Deploy

Incluye `render.yaml` para desplegar en **Render**:

- **`plantulas-bot-api`** (web service Python): corre `render_start.sh` (aplica migraciones y levanta uvicorn). Healthcheck `/api/health`.
- **`plantulas-bot-web`** (static site): build de Vite, con rewrite SPA a `index.html`.

Variables a cargar en Render: `DATABASE_URL`, `OPENAI_API_KEY`, `CORS_ORIGINS` (backend) y `VITE_API_BASE_URL` (frontend).

## API (resumen)

- `GET /api/dashboard`
- `GET/POST /api/indoors`, `GET/PATCH /api/indoors/{id}`
- `POST /api/indoors/{id}/water`, `GET /api/indoors/{id}/watering-history`
- `GET /api/stages`, `GET/PUT /api/indoors/{id}/stage-targets`
- `GET/POST /api/indoors/{id}/measurements`, `DELETE /api/measurements/{id}`
- `GET/POST /api/indoors/{id}/tasks`, `PATCH/DELETE /api/tasks/{id}`
- `GET/POST /api/fertilizers`, `GET/PUT /api/indoors/{id}/fertilizer-plan`, `GET/POST /api/indoors/{id}/fertilizer-applications`
- `GET/POST /api/plants`, `GET/PATCH/DELETE /api/plants/{id}`, `GET /api/plants/{id}/history`, `POST /api/plants/{id}/water`
- `POST /api/chat`, `POST /api/chat/confirm`, `GET/DELETE /api/chat/history`

## Licencia

Proyecto privado.
