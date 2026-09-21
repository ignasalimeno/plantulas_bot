#!/usr/bin/env python3
"""
PlantulasBot bridge for Raspberry Pi.

Every INTERVAL_SECONDS:
  1. Reads temp/humidity from Home Assistant.
  2. Pushes the reading to PlantulasBot (POST /api/devices/telemetry).
  3. Pulls the desired actuator state (GET /api/devices/commands).
  4. Applies it in Home Assistant (humidifier switch, AC climate/switch).

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
ENT_TEMP = os.environ["ENT_TEMP"]
ENT_HUMIDITY = os.environ["ENT_HUMIDITY"]
ENT_HUMIDIFIER = os.environ["ENT_HUMIDIFIER"]
ENT_AC = os.environ.get("ENT_AC", "").strip()
INTERVAL = int(os.environ.get("INTERVAL_SECONDS", "900"))

HA_HEADERS = {"Authorization": f"Bearer {HA_TOKEN}", "Content-Type": "application/json"}
BOT_HEADERS = {"Authorization": f"Bearer {DEVICE_TOKEN}", "Content-Type": "application/json"}


def _num(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def ha_state(entity_id: str):
    r = requests.get(f"{HA_URL}/api/states/{entity_id}", headers=HA_HEADERS, timeout=10)
    r.raise_for_status()
    return r.json().get("state")


def ha_call(domain: str, service: str, entity_id: str, data: dict | None = None):
    requests.post(
        f"{HA_URL}/api/services/{domain}/{service}",
        headers=HA_HEADERS,
        json={"entity_id": entity_id, **(data or {})},
        timeout=10,
    ).raise_for_status()


def read_sensor():
    return _num(ha_state(ENT_TEMP)), _num(ha_state(ENT_HUMIDITY))


def apply_commands(cmd: dict):
    # Humidifier (smart plug = switch)
    ha_call("switch", "turn_on" if cmd["humidifier"] else "turn_off", ENT_HUMIDIFIER)

    # Air conditioner (IR blaster -> climate, or switch)
    if ENT_AC:
        if ENT_AC.startswith("climate."):
            hvac = cmd.get("ac_hvac_mode") or "cool"
            ha_call("climate", "set_hvac_mode", ENT_AC, {"hvac_mode": hvac if cmd["ac"] else "off"})
        else:
            ha_call("switch", "turn_on" if cmd["ac"] else "turn_off", ENT_AC)


def push_telemetry(temp, humidity):
    requests.post(
        f"{BACKEND_URL}/api/devices/telemetry",
        headers=BOT_HEADERS,
        json={"temp_c": temp, "humidity": humidity},
        timeout=15,
    ).raise_for_status()


def pull_commands() -> dict:
    r = requests.get(f"{BACKEND_URL}/api/devices/commands", headers=BOT_HEADERS, timeout=15)
    r.raise_for_status()
    return r.json()


def report_state(cmd: dict):
    requests.post(
        f"{BACKEND_URL}/api/devices/state",
        headers=BOT_HEADERS,
        json={"humidifier": cmd["humidifier"], "ac": cmd["ac"]},
        timeout=15,
    )


def cycle():
    temp, humidity = read_sensor()
    log.info("sensor: temp=%s humidity=%s", temp, humidity)

    if temp is not None or humidity is not None:
        push_telemetry(temp, humidity)

    cmd = pull_commands()
    log.info("commands: humidifier=%s ac=%s", cmd["humidifier"], cmd["ac"])
    apply_commands(cmd)
    report_state(cmd)


def main():
    log.info("PlantulasBot bridge started (interval=%ss)", INTERVAL)
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
