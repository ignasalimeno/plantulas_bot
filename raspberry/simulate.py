#!/usr/bin/env python3
"""
Simula el bridge (solo lectura) sin hardware: manda una lectura de sensores y
el estado on/off de los equipos a PlantulasBot. Sirve para probar el panel y el
historial sin Home Assistant.

Uso:
  export BACKEND_URL=http://localhost:8010
  export DEVICE_TOKEN=xxxx
  python3 simulate.py --temp 24 --humidity 50 --pump on
  python3 simulate.py --loop --interval 15      # repite cada 15s
"""
import os
import sys
import json
import time
import random
import argparse
import urllib.request


def _post(url: str, token: str, payload: dict) -> int:
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return resp.status


def cycle(url: str, token: str, temp: float, humidity: float, states: dict):
    base = url.rstrip("/")
    status = _post(f"{base}/api/devices/telemetry", token, {"temp_c": temp, "humidity": humidity})
    print(f"→ telemetry  temp={temp}°C  humidity={humidity}%   [{status}]")
    status = _post(f"{base}/api/devices/state", token, states)
    print(f"→ state      {states}   [{status}]")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default=os.environ.get("BACKEND_URL"))
    parser.add_argument("--token", default=os.environ.get("DEVICE_TOKEN"))
    parser.add_argument("--temp", type=float, default=None)
    parser.add_argument("--humidity", type=float, default=None)
    parser.add_argument("--pump", choices=["on", "off"], default="off")
    parser.add_argument("--loop", action="store_true")
    parser.add_argument("--interval", type=int, default=15)
    args = parser.parse_args()

    if not args.url or not args.token:
        print("Faltan --url/--token (o BACKEND_URL/DEVICE_TOKEN en el entorno).")
        sys.exit(1)

    states = {
        "humidifier": False,
        "ac": False,
        "extractor": False,
        "intractor": False,
        "fan": False,
        "pump": args.pump == "on",
    }

    while True:
        temp = args.temp if args.temp is not None else round(random.uniform(18, 30), 1)
        humidity = args.humidity if args.humidity is not None else round(random.uniform(40, 80))
        try:
            cycle(args.url, args.token, temp, humidity, states)
        except Exception as exc:  # noqa: BLE001
            print("error:", exc)
        if not args.loop:
            break
        time.sleep(args.interval)


if __name__ == "__main__":
    main()
