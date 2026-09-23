#!/usr/bin/env python3
"""
PlantulasBot bridge (read-only) for Raspberry Pi.

Every INTERVAL_SECONDS:
  1. Fetches this device's config (Home Assistant entity IDs) from PlantulasBot.
  2. Reads the sensors (temp, humidity) and the on/off state of each device
     from Home Assistant.
  3. Pushes them back (telemetry + state).

It NEVER controls anything: only reads HA and reports. All control/automation
lives in Home Assistant.

Config via environment variables (see .env.example).
"""
import os
import sys
import time
import logging

import requests

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("plantulas-bridge")

BACKEND_URL = os.environ["BACKEND_URL"].rstrip("/")
DEVICE_TOKEN = os.environ["DEVICE_TOKEN"]
HA_URL = os.environ.get("HA_URL", "http://localhost:8123").rstrip("/")
HA_TOKEN = os.environ["HA_TOKEN"]
INTERVAL = int(os.environ.get("INTERVAL_SECONDS", "60"))

# Fields the bridge knows how to read. The actual entity_id comes from the
# device config in the app (set via the Dispositivos panel).
SENSOR_FIELDS = ("temp", "humidity")
STATE_FIELDS = ("humidifier", "ac", "extractor", "intractor", "fan", "pump")

HA_HEADERS = {"Authorization": f"Bearer {HA_TOKEN}", "Content-Type": "application/json"}
BOT_HEADERS = {"Authorization": f"Bearer {DEVICE_TOKEN}", "Content-Type": "application/json"}

_ON_VALUES = {"on", "true", "1", "open", "heat", "cool", "auto", "dry", "fan", "heat_cool"}


def _num(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _bool(value):
    if value is None:
        return None
    return str(value).strip().lower() in _ON_VALUES


def fetch_entities() -> dict:
    """Get the entity IDs configured for this device in the app."""
    r = requests.get(f"{BACKEND_URL}/api/devices/me", headers=BOT_HEADERS, timeout=15)
    r.raise_for_status()
    return r.json().get("ha_entities") or {}


def ha_state(entity_id: str):
    r = requests.get(f"{HA_URL}/api/states/{entity_id}", headers=HA_HEADERS, timeout=10)
    r.raise_for_status()
    return r.json().get("state")


def read_entity(entity_id: str, parser):
    try:
        return parser(ha_state(entity_id))
    except Exception as exc:  # noqa: BLE001
        log.warning("no pude leer %s: %s", entity_id, exc)
        return None


def push_telemetry(payload: dict):
    requests.post(
        f"{BACKEND_URL}/api/devices/telemetry",
        headers=BOT_HEADERS,
        json=payload,
        timeout=15,
    ).raise_for_status()


def push_state(payload: dict):
    requests.post(
        f"{BACKEND_URL}/api/devices/state",
        headers=BOT_HEADERS,
        json=payload,
        timeout=15,
    ).raise_for_status()


def cycle():
    entities = fetch_entities()

    temp = read_entity(entities["temp"], _num) if entities.get("temp") else None
    humidity = read_entity(entities["humidity"], _num) if entities.get("humidity") else None
    log.info("sensors: temp=%s humidity=%s", temp, humidity)
    if temp is not None or humidity is not None:
        push_telemetry({"temp_c": temp, "humidity": humidity})

    states: dict = {}
    for field in STATE_FIELDS:
        entity = entities.get(field)
        if not entity:
            continue
        value = read_entity(entity, _bool)
        if value is not None:
            states[field] = value
    if states:
        log.info("states: %s", states)
        push_state(states)


def main():
    log.info("PlantulasBot bridge (read-only) started (interval=%ss)", INTERVAL)
    while True:
        try:
            cycle()
        except Exception as exc:  # noqa: BLE001
            log.error("cycle failed: %s", exc)
        time.sleep(INTERVAL)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
