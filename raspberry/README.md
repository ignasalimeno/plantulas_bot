# Raspberry Pi Bridge

Conecta tu cultivo con PlantulasBot en **modo solo lectura**: lee sensores (temp/humedad) y el estado (on/off) de los equipos desde **Home Assistant** y los reporta a la app. **No controla nada** — toda la automatización vive en HA.

```
Tuya/Smart Life ──► Home Assistant ──► bridge.py ──► PlantulasBot (Render)
```

## 1. Home Assistant + Tuya
1. Instalá **Home Assistant OS** en el Pi 4B (imagen para Pi 4B).
2. Creá una cuenta en **Tuya IoT Platform** (iot.tuya.com), un **Cloud project** y **vinculá tu cuenta de Smart Life**.
3. En HA: **Ajustes → Dispositivos y servicios → Añadir integración → Tuya** y cargá el **Access ID** y **Access Secret**.
4. Verificá que aparezcan las entidades. Anotá los `entity_id`:
   - Sensor temperatura → `sensor.sensor_humedad_temperatura`
   - Sensor humedad → `sensor.sensor_humedad_humedad`
   - Humidificador → `switch.humidificador_enchufe_1`
   - Aire (IR) → `climate.aire`
   - Intractor → `switch.intractor_enchufe_1` (el extractor es el mismo equipo)
   - Ventilador interno / Bomba de riego → cuando los sumes a HA

## 2. Token de dispositivo en la app
1. En PlantulasBot → tu indoor → panel **Dispositivos** → **+ Nuevo dispositivo**.
2. Completá los `entity_id` de HA.
3. **Copiá el token** (se muestra una sola vez).

## 3. Token de Home Assistant
En HA: **perfil (abajo a la izquierda) → Long-Lived Access Tokens → Crear token**. Copialo.

## 4. Instalar el bridge en el Pi
```bash
sudo apt update && sudo apt install -y python3-venv git
mkdir -p ~/plantulas_bridge && cd ~/plantulas_bridge
# copiá bridge.py y requirements.txt a esta carpeta
python3 -m venv venv
./venv/bin/pip install -r requirements.txt

cp .env.example .env
nano .env   # completá BACKEND_URL, DEVICE_TOKEN, HA_URL y HA_TOKEN
            # (las entidades de HA se cargan en la app, en el device)
```

Probar a mano:
```bash
./venv/bin/python bridge.py
```

## 5. Correr como servicio (arranca solo)
```bash
sudo cp plantulas-bridge.service /etc/systemd/system/
# ajustá rutas/usuarios en el .service si no usás /home/pi
sudo systemctl daemon-reload
sudo systemctl enable --now plantulas-bridge
sudo journalctl -u plantulas-bridge -f   # ver logs
```

## Cómo funciona (solo lectura)
Cada `INTERVAL_SECONDS` (por defecto 60):
1. Lee temp/humedad de HA y las sube (`/api/devices/telemetry`) → queda como medición (historial para gráficos).
2. Lee el estado on/off de los equipos y lo reporta (`/api/devices/state`).

En el backend, cada **cambio de estado** (on↔off) de un equipo se registra como un **evento en el historial** del indoor (ej: "Bomba de riego: ON"). Así podés ver cuándo se prendió cada cosa.

El bridge **no prende ni apaga nada**. Si el backend no responde, solo reintenta en el próximo ciclo.
