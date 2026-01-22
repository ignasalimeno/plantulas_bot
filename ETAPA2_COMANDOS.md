# ETAPA 2 - Resumen de Comandos

## ✅ Completado

La ETAPA 2 está implementada con:
- Configuración de PostgreSQL con SQLAlchemy + psycopg3
- 5 modelos: User, Indoor, Plant, WateringHistory, IndoorHistory
- Alembic configurado con migración inicial
- Script de seed idempotente con datos demo
- Función `compute_next_water_at()` para lógica de riego

## 📋 Comandos de Verificación

### 1. Levantar PostgreSQL
```bash
cd /Users/ignaciosalimeno/Documents/Ignacio/Code/plantulas_bot/infra
docker compose up -d
docker compose ps  # Verificar que está corriendo
```

**Resultado esperado:**
```
NAME                  IMAGE                STATUS
plantulas_postgres    postgres:16-alpine   Up
plantulas_pgadmin     dpage/pgadmin4       Up
```

---

### 2. Aplicar Migraciones
```bash
cd /Users/ignaciosalimeno/Documents/Ignacio/Code/plantulas_bot/backend
source venv/bin/activate
alembic upgrade head
```

**Resultado esperado:**
```
INFO  [alembic.runtime.migration] Running upgrade  -> ce812b509193, init schema
```

---

### 3. Ejecutar Seed (Primera vez)
```bash
cd /Users/ignaciosalimeno/Documents/Ignacio/Code/plantulas_bot/backend
source venv/bin/activate
python -m app.seed
```

**Resultado esperado:**
```
🌱 Starting database seed...
✓ Created user with telegram_user_id=12345678
✓ Created indoor 'Carpa Principal'
✓ Created indoor 'Jardín de Hierbas'
✓ Created plant 'Monstera' (next water: 2026-01-24)
✓ Created plant 'Ficus' (next water: 2026-01-19)
✓ Created plant 'Albahaca' (next water: 2026-01-22)
✓ Created 2 watering records for 'Monstera'
✓ Created 2 watering records for 'Ficus'
✓ Created 2 watering records for 'Albahaca'
✅ Database seed completed successfully!
   - User: telegram_user_id=12345678
   - Indoors: 2
   - Plants: 3
```

---

### 4. Ejecutar Seed (Segunda vez - Idempotencia)
```bash
python -m app.seed
```

**Resultado esperado:**
```
🌱 Starting database seed...
✓ User with telegram_user_id=12345678 already exists
✓ Indoor 'Carpa Principal' already exists
✓ Indoor 'Jardín de Hierbas' already exists
✓ Plant 'Monstera' already exists
✓ Plant 'Ficus' already exists
✓ Plant 'Albahaca' already exists
✓ Plant 'Monstera' already has 2 watering records
✓ Plant 'Ficus' already has 2 watering records
✓ Plant 'Albahaca' already has 2 watering records
✅ Database seed completed successfully!
```

---

### 5. Verificar Datos en DB
```bash
python -m app.verify_db
```

**Resultado esperado:**
```
🔍 Database Verification
============================================================
Users: 1
Indoors: 2
Plants: 3
Watering History: 6
Indoor History: 2
============================================================

📱 User telegram_user_id=12345678
   ID: <uuid>
   Created: <timestamp>

🏠 Indoors (2):
   - Carpa Principal
     Temp: 24.50°C, Humidity: 65.00%
     Light: 18/6, 80%
   - Jardín de Hierbas
     Temp: 22.00°C, Humidity: 55.00%
     Light: 16/8, 60%

🌱 Plants (3):
   - Monstera (Monstera deliciosa)
     Indoor: Carpa Principal
     Last watered: <date>
     Next water: <date>
     Watering records: 2
   - Ficus (Ficus elastica)
     Indoor: Carpa Principal
     Last watered: <date>
     Next water: <date>
     Watering records: 2
   - Albahaca (Ocimum basilicum)
     Indoor: Jardín de Hierbas
     Last watered: <date>
     Next water: <date>
     Watering records: 2

✅ Verification complete!
```

---

### 6. Iniciar Backend
```bash
uvicorn app.main:app --reload
```

**Resultado esperado:**
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete.
```

Verificar en navegador:
- http://localhost:8000/docs - Debe mostrar la documentación de FastAPI
- http://localhost:8000/api/health - Debe retornar `{"ok": true}`

---

## ✅ Criterios de Aceptación

### 1. ✅ Migración corre sin errores
- `alembic upgrade head` se ejecuta sin errores
- Se crean 5 tablas: users, indoors, indoor_history, plants, watering_history
- Todos los índices se crean correctamente

### 2. ✅ Seed es idempotente
- Primera ejecución crea todos los datos
- Segunda ejecución no duplica datos
- Muestra mensajes "already exists" en segunda ejecución

### 3. ✅ Backend inicia y conecta a DB sin error
- Backend importa sin errores
- Se conecta a PostgreSQL correctamente
- Health endpoint responde

---

## 📊 Datos Demo Creados

### Usuario
- `telegram_user_id`: 12345678

### Indoors (2)
1. **Carpa Principal**
   - Temp: 24.5°C, Humidity: 65%
   - Luz: 18/6, 80% power, 50cm altura
   - Ventilación: Extractor top, Fan activo

2. **Jardín de Hierbas**
   - Temp: 22°C, Humidity: 55%
   - Luz: 16/8, 60% power, 40cm altura
   - Ventilación: Fan activo

### Plantas (3)
1. **Monstera** (Monstera deliciosa)
   - Indoor: Carpa Principal
   - Riego cada 7 días, 1.5L
   - Última riego: hace 3 días
   - Próximo riego: en 4 días

2. **Ficus** (Ficus elastica)
   - Indoor: Carpa Principal
   - Riego cada 5 días, 1.0L
   - Última riego: hace 6 días
   - **⚠️ Necesita riego** (vencido ayer)

3. **Albahaca** (Ocimum basilicum)
   - Indoor: Jardín de Hierbas
   - Riego cada 3 días, 0.5L
   - Última riego: hace 1 día
   - Próximo riego: en 2 días

### Historial
- 6 registros de riego (2 por planta)
- 2 registros de eventos de indoor (creación)

---

## 🎯 Estado de Implementación

### ✅ Archivos Creados/Modificados

**Configuración:**
- `backend/app/database.py` - Engine, SessionLocal, get_db
- `backend/app/config.py` - Agregado db_echo
- `backend/.env` - DATABASE_URL con psycopg
- `backend/.env.example` - Ejemplo de variables

**Modelos:**
- `backend/app/models.py` - 5 modelos SQLAlchemy completos
- `backend/app/services.py` - compute_next_water_at()

**Alembic:**
- `backend/alembic/` - Directorio de Alembic
- `backend/alembic.ini` - Configuración
- `backend/alembic/env.py` - Configurado para importar modelos
- `backend/alembic/versions/ce812b509193_init_schema.py` - Migración inicial

**Scripts:**
- `backend/app/seed.py` - Script de seed idempotente
- `backend/app/verify_db.py` - Script de verificación

**Documentación:**
- `README.md` - Actualizado con ETAPA 2

---

## 🚀 Siguiente Paso

Una vez verificado que todo funciona correctamente, estamos listos para:

**ETAPA 3**: Implementar endpoints REST para CRUD de plantas e indoors

**NO AVANZAR** hasta recibir confirmación "OK etapa 2".
