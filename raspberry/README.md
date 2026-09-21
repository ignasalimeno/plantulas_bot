# Raspberry Pi Bridge

Conecta tu cultivo con PlantulasBot: lee temp/humedad desde **Home Assistant** y controla el **humidificador** (enchufe) y el **aire** (IR blaster) según lo que define la app.

```
Tuya/Smart Life ──► Home Assistant (Pi) ──► bridge.py ──► PlantulasBot (Render)
```

## 1. Home Assistant + Tuya
1. Instalá **Home Assistant OS** en el Pi 4B (imagen para Pi 4B).
2. Creá una cuenta en **Tuya IoT Platform** (iot.tuya.com), un **Cloud project** y **vinculá tu cuenta de Smart Life**.
3. En HA: **Ajustes → Dispositivos y servicios → Añadir integración → Tuya** y cargá el **Access ID** y **Access Secret**.
4. Verificá que aparezcan las entidades. Anotá los `entity_id`:
   - Sensor temperatura → `sensor.carpa_temperatura`
   - Sensor humedad → `sensor.carpa_humedad`
   - Enchufe humidificador → `switch.humidificador`
   - Aire (IR) → `climate.aire`

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
nano .env   # completá BACKEND_URL, DEVICE_TOKEN, HA_TOKEN y las entidades
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

## Cómo funciona el control
Cada `INTERVAL_SECONDS` (por defecto 900 = 15 min):
1. Lee temp/humedad de HA y las sube (`/api/devices/telemetry`).
2. Pide el estado deseado (`/api/devices/commands`).
3. Aplica en HA (prende/apaga el humidificador y el aire).
4. Reporta el estado aplicado (`/api/devices/state`).

El estado deseado se calcula en la app según el **modo** de cada equipo:
- **auto**: usa los umbrales del indoor (humedad/temperatura).
- **manual**: lo que forzás desde la app.
- **off**: siempre apagado.

Si el backend no responde, el bridge **mantiene el último estado** (no cambia nada).
