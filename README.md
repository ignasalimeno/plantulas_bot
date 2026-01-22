# PlantulasBot

Aplicación web para gestión de plantas con chatbot integrado. Monorepo con frontend React + backend FastAPI + PostgreSQL.

**Estado:** ETAPA 4 (Frontend UI) - COMPLETADA ✅

## 📁 Estructura del Proyecto

```
plantulas_bot/
├── frontend/               # React + Vite + TypeScript + Tailwind (ETAPA 4) ✅
├── backend/                # FastAPI + SQLAlchemy + Alembic (ETAPA 3) ✅
├── infra/                  # Docker Compose (PostgreSQL + pgAdmin) ✅
├── ETAPA4_FRONTEND_UI.md   # Documentación ETAPA 4
├── start.sh                # Script para levantar stack completo
├── .env.example            # Variables de entorno de ejemplo
└── README.md
```

## 🚀 Inicio Rápido (Forma Fácil)

```bash
# Terminal única (levantar todo):
./start.sh
```

O seguir los pasos manuales abajo.

## 🚀 Inicio Manual (Paso a Paso)

### Prerrequisitos

- Node.js 18+ y npm
- Python 3.11+
- Docker y Docker Compose

### 1. Clonar y configurar variables de entorno

```bash
# Copiar archivo de ejemplo
cp .env.example .env
cp frontend/.env.example frontend/.env
```

### 2. Levantar la base de datos

**Terminal 1:**
```bash
cd infra
docker-compose up -d
```

Esto levantará:
- **PostgreSQL** en `localhost:5432`
- **pgAdmin** en `http://localhost:5050` (admin@plantulas.com / admin)

Verificar que PostgreSQL esté corriendo:
```bash
docker compose ps
```

### 3. Configurar y correr el backend

**Terminal 2:**
```bash
cd backend

# Crear entorno virtual (solo primera vez)
python3 -m venv venv

# Activar venv
source venv/bin/activate  # En Windows: venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt

# Aplicar migraciones de base de datos
alembic upgrade head

# Ejecutar seed (datos demo para telegram_user_id=12345678)
python -m app.seed

# Correr el servidor
uvicorn app.main:app --reload --port 8000
```

El backend estará disponible en:
- API: `http://localhost:8000`
- Docs interactivos: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/api/health`

### 4. Configurar y correr el frontend

**Terminal 3:**
```bash
cd frontend

# Instalar dependencias (solo primera vez)
npm install

# Correr servidor de desarrollo
npm run dev
```

El frontend estará disponible en `http://localhost:5174`

## ✅ Verificación de Funcionalidad

### ✅ ETAPA 4 (Frontend UI) - COMPLETADA

El frontend está completamente funcional con todas las páginas e integraciones con el backend.

#### Verificación Rápida

1. **Dashboard (Panel):**
   - Acceder a `http://localhost:5174/panel`
   - Debe mostrar 3 cards con métricas (Indoors, Plantas, Necesitan riego)
   - Lista de próximos riegos ordenados por estado
   - Botones "Regar" deben abrir modal

2. **Indoors:**
   - Acceder a `http://localhost:5174/indoors`
   - Debe mostrar 2 cards (Carpa Principal, Jardín de Hierbas)
   - Click en card navega a detalle

3. **Detalle Indoor:**
   - Desde Indoors, click en una card
   - Debe mostrar tabla de plantas
   - Botones "Regar", "Historial", "Editar"
   - Historial de eventos del indoor
   - Formulario editable para configuración (temperatura, luz, toggles, etc.)
   - Botón "Guardar Cambios" llama PATCH endpoint

4. **Modal de Riego:**
   - Click "Regar" en Panel o Detalle
   - Modal debe mostrar campos: Litros (default 1), Nota (opcional)
   - Submit guarda riego y refetch de datos
   - Toast notificación "Planta regada correctamente"

#### Headers y Autenticación

- Usuario de Telegram ID se guarda en localStorage
- Todas las requests incluyen header `X-Telegram-UserId`
- Verificar en DevTools > Network

#### Ejemplo curl para verificar backend

```bash
# Dashboard
curl -H "X-Telegram-UserId: 12345678" http://localhost:8000/api/dashboard

# Indoors
curl -H "X-Telegram-UserId: 12345678" http://localhost:8000/api/indoors

# Detalle indoor
curl -H "X-Telegram-UserId: 12345678" http://localhost:8000/api/indoors/ac0907b2-f43b-4b1c-a404-dc2c5267bea2

# Regar planta
curl -X POST -H "Content-Type: application/json" \
  -H "X-Telegram-UserId: 12345678" \
  -d '{"liters": 1.5, "note": "Riego manual"}' \
  http://localhost:8000/api/plants/9088aef8-0125-4c15-9d14-7f44357ec3a7/water

# Actualizar indoor
curl -X PATCH -H "Content-Type: application/json" \
  -H "X-Telegram-UserId: 12345678" \
  -d '{"light_power_pct": 85}' \
  http://localhost:8000/api/indoors/ac0907b2-f43b-4b1c-a404-dc2c5267bea2
```

### ✅ ETAPA 3 (REST API) - COMPLETADA

6 endpoints funcionales:
- ✅ `GET /api/dashboard` - Resumen y próximos riegos
- ✅ `GET /api/indoors` - Lista de indoors
- ✅ `GET /api/indoors/{id}` - Detalle con plantas e historial
- ✅ `PATCH /api/indoors/{id}` - Actualizar configuración
- ✅ `POST /api/plants/{id}/water` - Registrar riego
- ✅ Auto-creación de usuarios desde header

### ✅ ETAPA 2 (DB + Modelos) - COMPLETADA

- Base de datos PostgreSQL con 5 tablas
- Modelos SQLAlchemy completos
- Alembic migrations
- Seed script idempotente
- Función compute_next_water_at()

### ✅ ETAPA 1 (Scaffold) - COMPLETADA

Monorepo completo con frontend, backend e infraestructura funcionando.

## 📁 Archivos ETAPA 4

### Users
- `id` (UUID) - Primary key
- `telegram_user_id` (BigInt) - Unique, indexed
- `created_at` (DateTime)

### Indoors
- `id` (UUID) - Primary key
- `user_id` (UUID) - Foreign key a users
- `name` (Text) - Nombre del indoor
- `temp_c`, `humidity` - Parámetros ambientales
- `fan_location`, `extractor_top`, `extractor_bottom`, `fan` - Ventilación
- `light_height_cm`, `light_power_pct`, `light_schedule` - Iluminación
- `created_at`, `updated_at`

### Plants
- `id` (UUID) - Primary key
- `user_id` (UUID) - Foreign key a users
- `indoor_id` (UUID) - Foreign key a indoors
- `name`, `species` - Información de la planta
- `planted_at` (Date)
- `watering_interval_days`, `default_liters` - Config de riego
- `last_watered_at`, `next_water_at` (Date)
- `notes`
- `created_at`, `updated_at`

### WateringHistory
- `id` (UUID) - Primary key
- `plant_id` (UUID) - Foreign key a plants
- `event_ts` (DateTime) - Timestamp del riego
- `liters` (Numeric) - Cantidad regada
- `note` (Text)
- `ferts` (JSONB) - Fertilizantes aplicados

### IndoorHistory
- `id` (UUID) - Primary key
- `indoor_id` (UUID) - Foreign key a indoors
- `event_ts` (DateTime)
- `message` (Text) - Descripción del evento
- `payload` (JSONB) - Datos adicionales

## � Archivos ETAPA 4

### Frontend - API
- `frontend/src/api/client.ts` - Cliente HTTP centralizado
- `frontend/src/api/types.ts` - 13 interfaces TypeScript

### Frontend - Hooks
- `frontend/src/hooks/index.ts` - 5 hooks custom (useDashboard, useIndoors, etc.)

### Frontend - Componentes
- `frontend/src/components/Layout.tsx` - Sidebar + navegación actualizado
- `frontend/src/components/Modals.tsx` - WaterModal, ToastContainer, CardSkeleton, EmptyState

### Frontend - Páginas
- `frontend/src/pages/Panel.tsx` - Dashboard con cards y próximos riegos
- `frontend/src/pages/Indoors.tsx` - Listado de indoors
- `frontend/src/pages/IndoorDetail.tsx` - Detalle con tabla, historial, formulario editable
- `frontend/src/pages/ChatbotTest.tsx` - Placeholder para ETAPA 5

### Frontend - Configuración
- `frontend/.env` - Variables de entorno (VITE_API_BASE_URL)
- `frontend/.env.example` - Template

### Documentación
- `ETAPA4_FRONTEND_UI.md` - Documentación detallada de ETAPA 4

## �🛠️ Comandos Útiles

### Docker
```bash
# Levantar servicios
cd infra && docker compose up -d

# Ver logs
docker compose logs -f

# Detener servicios
docker compose down

# Limpiar todo (incluyendo volúmenes)
docker compose down -v
```

### Backend
```bash
# Activar entorno virtual
source venv/bin/activate

# Crear nueva migración (después de cambiar modelos)
alembic revision --autogenerate -m "descripción del cambio"

# Aplicar migraciones
alembic upgrade head

# Revertir migración
alembic downgrade -1

# Ejecutar seed
python -m app.seed

# Verificar datos en DB
python -m app.verify_db

# Correr servidor
uvicorn app.main:app --reload

# Ver docs de la API
# Abrir http://localhost:8000/docs
```

### Frontend
```bash
# Instalar dependencias
npm install

# Modo desarrollo
npm run dev

# Build para producción
npm run build

# Preview de build
npm preview
```

## 📝 Progreso del Proyecto

### ✅ ETAPA 1 (Scaffold) - COMPLETADA
Monorepo configurado con frontend, backend e infraestructura funcionando.

### ✅ ETAPA 2 (DB + Modelos) - COMPLETADA
- Base de datos PostgreSQL con todas las tablas
- Modelos SQLAlchemy completos
- Sistema de migraciones con Alembic
- Script de seed con datos demo
- Función de cálculo de próximo riego

### ✅ ETAPA 3 (REST API) - COMPLETADA
- 6 endpoints REST implementados y probados
- User auto-creation desde header
- Business logic completa (status calculation, watering, history tracking)

### ✅ ETAPA 4 (Frontend UI) - COMPLETADA
- React + Vite + TypeScript + Tailwind
- 4 páginas funcionales (Panel, Indoors, IndoorDetail, ChatbotTest)
- Modal de riego reutilizable
- Hooks custom para API consumption
- Loading, empty, error states
- Toast notifications
- Form handling y validation

### 🔄 Próximas Etapas
- **ETAPA 5**: Integración con Telegram Bot + OpenAI Chatbot
  - Webhook para recibir mensajes de Telegram
  - Commands: /start, /plants, /water, /config
  - OpenAI/Claude integration para respuestas inteligentes
- **ETAPA 6**: Features avanzados
  - Crear/editar plants y indoors
  - Fotos de plantas
  - Notificaciones automáticas
  - Mobile app con React Native

## 🔧 Troubleshooting

### Backend no se conecta a PostgreSQL
Verificar que PostgreSQL esté corriendo:
```bash
cd infra && docker compose ps
```

Si no está corriendo:
```bash
cd infra && docker compose up -d
```

### Errores de migración de Alembic
Si las migraciones fallan, verificar:
1. PostgreSQL está corriendo
2. DATABASE_URL en `.env` es correcto
3. Ejecutar `alembic upgrade head` desde el directorio `backend/`

### Puerto 5432 ya en uso
Cambiar el puerto en `.env`:
```
POSTGRES_PORT=5433
```

Y actualizar `DATABASE_URL`:
```
DATABASE_URL=postgresql+psycopg://plantulas:plantulas123@localhost:5433/plantulasdb
```

### Seed no crea datos
Verificar que las migraciones se aplicaron:
```bash
cd backend
alembic current  # Debe mostrar la versión actual
alembic upgrade head  # Si no hay versión
```

### CORS errors en el frontend
Verificar que el backend esté corriendo en el puerto 8000 y que CORS esté configurado correctamente en `backend/app/main.py`.

### Frontend no encuentra el backend
Verificar la configuración del proxy en `frontend/vite.config.ts` y que el backend esté corriendo.

## 📄 Licencia

Proyecto privado - PlantulasBot
