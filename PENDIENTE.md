# Pendiente: probar la conexión con Home Assistant

> Nota para retomar. La integración **solo lectura** con HA ya está implementada
> (bridge + backend + panel), pero **no se probó todavía contra Home Assistant real**.

## Qué quedó hecho
- **Bridge read-only** (`raspberry/bridge.py`): lee sensores y estados on/off de HA
  cada `INTERVAL_SECONDS` y los reporta. **No controla nada.**
- Toma las entidades del device **desde la app** (`GET /api/devices/me`), así no hay
  que repetirlas en el `.env`.
- **Backend**:
  - `POST /api/devices/state` guarda el estado real y **loguea cada transición ON/OFF**
    como evento en el historial del indoor (ej. "Bomba de riego: ON").
  - `POST /api/devices/telemetry` crea mediciones (temp/humedad) → historial para gráficos.
  - Campo `pump` en el indoor (migración `4fc2fb92c629`) para marcar la bomba a mano.
- **Panel**: tarjetas de dispositivos editables (toggle) con estado real de HA si está,
  o manual si no. Botón "Actualizar ahora".

## Entidades a configurar (en la app, no en el `.env`)
En la app → indoor → **Dispositivos** → nuevo dispositivo:

| Campo app | entity_id |
|---|---|
| Temperatura | `sensor.sensor_humedad_temperatura` |
| Humedad | `sensor.sensor_humedad_humedad` |
| Humidificador | `switch.humidificador_enchufe_1` |
| Aire | `climate.aire` |
| Intractor | `switch.intractor_enchufe_1` |
| Extractor | *(mismo equipo que intractor → dejar vacío)* |
| Ventilador interno | *(no existe → vacío)* |
| Bomba de riego | *(pendiente de sumar a HA → vacío)* |

## Pasos para probar
1. **Crear el device en la app** con esos `entity_id` → copiar el **token** (se muestra una vez).
2. **HA** → perfil → Long-Lived Access Tokens → crear token.
3. **En el equipo con HA**:
   ```bash
   mkdir -p ~/plantulas_bridge && cd ~/plantulas_bridge
   # copiar bridge.py, requirements.txt y .env.example desde raspberry/
   python3 -m venv venv && ./venv/bin/pip install -r requirements.txt
   cp .env.example .env && nano .env
   ```
   `.env`:
   ```bash
   BACKEND_URL=http://localhost:8010          # en prod: https://plantulas-bot.onrender.com
   DEVICE_TOKEN=<token del paso 1>
   HA_URL=http://localhost:8123
   HA_TOKEN=<token del paso 2>
   INTERVAL_SECONDS=60
   ```
4. Correr y mirar logs:
   ```bash
   ./venv/bin/python bridge.py
   ```
   Debería loguear `sensors: temp=.. humidity=..` y `states: {...}`.
5. **Verificar en la app**: Clima con temp/humedad, Humidificador/Intractor/Aire con
   estado real, y el Historial con los ON/OFF.

## Probar sin hardware
```bash
cd raspberry
BACKEND_URL=http://localhost:8010 DEVICE_TOKEN=<token> python3 simulate.py --temp 24 --humidity 55 --pump on
```

## Ojo
- El bridge tiene que **alcanzar HA y el backend**. Si el backend corre local
  (`localhost:8010`), el bridge debe correr en la misma máquina.
- **Prod**: al pushear, Render corre `alembic upgrade head` (aplica la migración de `pump`).
- Todo esto está **sin commitear** al momento de escribir esta nota.
