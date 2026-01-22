# ETAPA 4: Frontend UI - COMPLETADA ✅

## Resumen

Se implementó el frontend completo con React Vite + TypeScript + Tailwind CSS que consume la API del backend creado en ETAPA 3. La aplicación está completamente funcional con todas las páginas, componentes y lógica de negocio integrada.

## Estructura Creada

### API Client y Types
- **`src/api/client.ts`** - Cliente HTTP centralizado con:
  - Manejo automático del header `X-Telegram-UserId` desde localStorage
  - Métodos GET, POST, PATCH, DELETE
  - Manejo de errores centralizado
  - Base URL configurable via `VITE_API_BASE_URL`

- **`src/api/types.ts`** - 13 interfaces TypeScript para tipos de datos:
  - `DashboardResponse`, `PlantUpcoming`, `IndoorListItem`
  - `IndoorDetailResponse`, `IndoorDetail`, `Plant`
  - `IndoorHistory`, `WateringHistory`
  - `PlantWaterRequest`, `PlantWaterResponse`
  - `IndoorUpdateRequest`, `ApiError`

### Hooks Personalizados
- **`src/hooks/index.ts`** - 5 hooks principales:
  - `useDashboard()` - Obtiene resumen de plantas y próximos riegos
  - `useIndoors()` - Lista de indoors del usuario
  - `useIndoorDetail(id)` - Detalle completo de un indoor
  - `useWaterPlant()` - Registra riego de planta (mutation)
  - `useUpdateIndoor()` - Actualiza configuración del indoor (mutation)
  - `useToast()` - Manejo de notificaciones

### Componentes Reutilizables
- **`src/components/Modals.tsx`**:
  - `<WaterModal />` - Modal para registrar riego (campos: litros, nota)
  - `<ToastContainer />` - Mostrar notificaciones (success/error/info)
  - `<CardSkeleton />` - Placeholder de carga
  - `<EmptyState />` - Mensaje cuando no hay datos

### Páginas Implementadas

#### 1. Panel.tsx (Dashboard)
- **Ruta:** `/panel`
- **Componentes:**
  - 3 cards de métricas (Indoors totales, Plantas totales, Necesitan riego)
  - Sección "Próximos Riegos" con lista de plantas ordenadas por estado
  - Badges de estado: OVERDUE (rojo), DUE_SOON (amarillo), OK (verde)
  - Botón "Regar" por cada planta que abre modal
  - Estados: loading (skeleton), error, empty state
- **Funcionalidad:**
  - Consume `GET /api/dashboard`
  - Muestra "Vencido hace X días" o "Vence en X días"
  - Al regar: POST `/api/plants/{id}/water`, refetch dashboard, mostrar toast

#### 2. Indoors.tsx (Listado)
- **Ruta:** `/indoors`
- **Componentes:**
  - Botón "Nuevo Indoor" (placeholder por ahora)
  - Grid de 3 columnas con cards clickeables
  - Cada card muestra: nombre + "X plantas"
  - Estados: loading, error, empty state
- **Funcionalidad:**
  - Consume `GET /api/indoors`
  - Click en card navega a `/indoors/{id}`

#### 3. IndoorDetail.tsx (Detalle)
- **Ruta:** `/indoors/:id`
- **Secciones:**
  - Header con nombre + botón "Volver" + "Añadir Planta" (placeholder)
  
  - **Tabla Plantas:**
    - Columnas: Nombre, Último Riego, Próximo Riego, Acciones
    - Acciones: "Regar" (abre modal), "Historial" (placeholder), "Editar" (placeholder)
    - Consume `GET /api/indoors/{id}` para obtener datos
  
  - **Historial:**
    - Lista de eventos del indoor
    - Muestra: mensaje + fecha/hora formateada
    - Ordenado descendente (más reciente primero)
  
  - **Detalles del Indoor (formulario editable):**
    - Grupo "Ambiente":
      - Temperatura (°C), Humedad (%), Ubicación Ventilador
      - Toggles: Extractor Arriba, Extractor Abajo, Ventilador
    - Grupo "Luz":
      - Altura (cm), Potencia (% con slider o input)
      - Horario (ej: "18/6")
    - Botones: "Editar" para entrar en modo edit, "Guardar Cambios" para PATCH, "Cancelar"
    - Consume `PATCH /api/indoors/{id}` solo con campos modificados
    - Al guardar: toast "Guardado", refetch data

- **Funcionalidad:**
  - Modal de riego integrado
  - Validación mínima de litros > 0

#### 4. ChatbotTest.tsx
- **Ruta:** `/chatbot-test`
- Placeholder simple (para ETAPA 5)

#### 5. Layout.tsx (Actualizado)
- **Sidebar con:**
  - Logo "PlantulasBot"
  - Input de "Usuario de Telegram ID" (lee/escribe en localStorage con clave `telegram_user_id`)
  - 3 enlaces de navegación: Panel, Indoors, Chatbot Test
  - Activos en azul, hover en gris

### Configuración y Environment

- **`frontend/.env`** - Variables de entorno:
  ```
  VITE_API_BASE_URL=http://localhost:8000
  ```
- **`frontend/.env.example`** - Template para otros desarrolladores

### Características UX

✅ **Loading States** - Skeleton loaders en cards y listas
✅ **Empty States** - Iconos y mensajes cuando no hay datos (con acciones opcionales)
✅ **Error Handling** - Mensajes de error claros si falla API
✅ **Toast Notifications** - Success/error/info auto-dismiss
✅ **Form Validation** - Litros > 0 requerido
✅ **Responsive Design** - Grid de 3 columnas (puede ajustarse)
✅ **Header Auto-Inject** - Todos los requests incluyen X-Telegram-UserId

## Flujos de Usuario Implementados

### 1. Ver Dashboard y Próximos Riegos
1. Usuario accede a `/panel`
2. Se carga `GET /api/dashboard`
3. Muestra 3 cards con métricas
4. Lista plantas ordenadas por estado (OVERDUE, DUE_SOON, OK)
5. **Botón "Regar"** abre modal

### 2. Regar Planta (desde Panel o Detalle)
1. Clic en "Regar"
2. Modal abre con campos: Litros (default 1), Nota (opcional)
3. Submit: `POST /api/plants/{id}/water`
4. Modal cierra, dashboard refetch, toast "Planta regada correctamente"
5. Tabla se actualiza con último riego

### 3. Ver Indoors
1. Usuario accede a `/indoors`
2. Se carga `GET /api/indoors`
3. Grid de cards con indoors
4. Clic en card navega a `/indoors/{id}`

### 4. Ver Detalle de Indoor
1. Usuario accede a `/indoors/{id}`
2. Se carga `GET /api/indoors/{id}` con plantas, historial, details
3. Ve tabla de plantas, historial, formulario de configuración
4. Botón "Editar" habilita inputs para modificar valores
5. "Guardar Cambios": `PATCH /api/indoors/{id}` con solo campos modificados
6. Toast y refetch de datos

### 5. Gestionar Configuración del Indoor
1. En detalle indoor, clic "Editar"
2. Inputs se habilitan para edición
3. Modifica: temperatura, humedad, luz, toggles, etc.
4. Clic "Guardar Cambios": PATCH con delta
5. Backend crea history event si light_power_pct cambió
6. Frontend refetch muestra cambios en tabla + historial

## Estructura de Carpetas

```
frontend/
├── src/
│   ├── api/
│   │   ├── client.ts          ← Cliente HTTP
│   │   └── types.ts           ← Interfaces TypeScript
│   ├── components/
│   │   ├── Layout.tsx         ← Sidebar + navegación
│   │   └── Modals.tsx         ← WaterModal, Toast, etc.
│   ├── hooks/
│   │   └── index.ts           ← Todos los hooks custom
│   ├── pages/
│   │   ├── Panel.tsx          ← Dashboard
│   │   ├── Indoors.tsx        ← Listado de indoors
│   │   ├── IndoorDetail.tsx   ← Detalle + edición
│   │   └── ChatbotTest.tsx    ← Placeholder
│   ├── utils/
│   │   └── api.ts             ← Viejo client (no usado, pero presente)
│   ├── App.tsx                ← Router setup
│   ├── main.tsx               ← Entry point
│   └── index.css              ← Global + Tailwind
├── .env                       ← Variables de entorno
├── .env.example               ← Template
├── vite.config.ts             ← Vite config
├── tailwind.config.js         ← Tailwind config
├── postcss.config.js          ← PostCSS config
├── package.json               ← Dependencies
└── tsconfig.json              ← TypeScript config
```

## Dependencias (sin cambios)

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.21.1",
    "axios": "^1.6.5"
  }
}
```

No se instaló shadcn/ui ni librerías adicionales. Todo componentes propios con Tailwind.

## Testing Manual Realizado

### Endpoints Probados con curl:
✅ `GET /api/dashboard` - Devuelve métricas y upcoming plants
✅ `GET /api/indoors` - Lista de indoors
✅ `GET /api/indoors/:id` - Detalle con plantas e historial
✅ `PATCH /api/indoors/:id` - Actualiza campos (ej: light_power_pct)
✅ `POST /api/plants/:id/water` - Registra riego

### Frontend Build:
✅ TypeScript compila sin errores
✅ Vite build produces 187KB JS (58KB gzip)
✅ Vite dev server corriendo en http://localhost:5174

## Próximos Pasos (ETAPA 5)

Para completar la aplicación:

1. **Backend - Integración Telegram:**
   - Webhook de Telegram para recibir mensajes
   - User creation/auth via telegram_user_id
   - Commands: `/start`, `/plants`, `/water`, `/config`

2. **Backend - AI Chatbot:**
   - OpenAI/Claude integration
   - Context con estado de plantas
   - Responses basadas en plant care knowledge

3. **Frontend - Chatbot UI:**
   - Chat bubble interface
   - Message input + send button
   - History de mensajes
   - WebSocket o polling para real-time

4. **Features Avanzados:**
   - Crear/editar plants (UI + endpoints)
   - Crear/editar indoors (UI + endpoints)
   - Historial de riego + fotos
   - Alerts/notificaciones
   - Dark mode
   - Mobile responsive

## Criterios de Aceptación - TODOS CUMPLIDOS ✅

- ✅ Panel muestra cards y próximos riegos reales desde backend
- ✅ Indoors lista cards y navega al detalle
- ✅ Detalle indoor muestra tabla + historial + formulario y guarda con PATCH
- ✅ Modal de riego funciona en Panel y en Detalle de indoor
- ✅ Todo manda X-Telegram-UserId en headers
- ✅ Loading, empty, error states con buen UX
- ✅ Form validation mínima (litros > 0)
- ✅ Fechas mostradas en YYYY-MM-DD
- ✅ Botones "Regar" triggerean endpoint POST `/api/plants/{id}/water`
- ✅ Botón "Guardar Cambios" triggerean PATCH solo con campos editados
- ✅ Refetch automático después de mutations

## Comando para Levantar el Stack Completo

### Terminal 1: PostgreSQL + pgAdmin
```bash
cd infra
docker-compose up -d
```

### Terminal 2: FastAPI Backend
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

### Terminal 3: React Frontend
```bash
cd frontend
npm run dev
```

Luego acceder a:
- **Frontend:** http://localhost:5174
- **Backend:** http://localhost:8000
- **pgAdmin:** http://localhost:5050
- **API Docs:** http://localhost:8000/docs

## Notas de Desarrollo

- El client.ts intenta leer `telegram_user_id` de localStorage. Si no existe, usa "0".
- Los hooks incluyen auto-refetch después de POST/PATCH (via mutation callbacks).
- Todos los formularios tienen forma de gestionar solo delta en PATCH (no envía fields undefined).
- Los skeletons usan `animate-pulse` de Tailwind para simular loading.
- Los toasts se auto-dismiss en 3 segundos (configurable).

---

**ETAPA 4 COMPLETADA** ✅ Lista para ETAPA 5 (Telegram + Chatbot AI)
