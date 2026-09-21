#!/usr/bin/env python3
"""
Simula el bridge del Pi sin hardware: manda una lectura y pide los comandos.
Sin dependencias externas (solo stdlib).

Uso:
  export BACKEND_URL=https://plantulas-bot.onrender.com
  export DEVICE_TOKEN=xxxx
  python3 simulate.py --temp 24 --humidity 50
  python3 simulate.py --loop --interval 15      # repite cada 15s (lecturas random)

Sin --temp/--humidity genera valores aleatorios.
"""
import os
import sys
import json
import time
import random
import argparse
import urllib.request
import urllib.error


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


def _get(url: str, token: str) -> dict:
    req = urllib.request.Request(
        url,
        headers={"Authorization": f"Bearer {token}"},
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())


def cycle(url: str, token: str, temp: float, humidity: float):
    base = url.rstrip("/")
    status = _post(f"{base}/api/devices/telemetry", token, {"temp_c": temp, "humidity": humidity})
    print(f"→ telemetry  temp={temp}°C  humidity={humidity}%   [{status}]")

    cmd = _get(f"{base}/api/devices/commands", token)
    print(
        "← commands   "
        f"humidifier={'ON' if cmd['humidifier'] else 'OFF'} "
        f"ac={'ON' if cmd['ac'] else 'OFF'} ({cmd.get('ac_hvac_mode')})  "
        f"[modos: hum={cmd['humidifier_mode']} ac={cmd['ac_mode']}]"
    )

    _post(f"{base}/api/devices/state", token, {"humidifier": cmd["humidifier"], "ac": cmd["ac"]})
    return cmd


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default=os.environ.get("BACKEND_URL"))
    parser.add_argument("--token", default=os.environ.get("DEVICE_TOKEN"))
    parser.add_argument("--temp", type=float, default=None)
    parser.add_argument("--humidity", type=float, default=None)
    parser.add_argument("--loop", action="store_true")
    parser.add_argument("--interval", type=int, default=15)
    args = parser.parse_args()

    if not args.url or not args.token:
        print("Faltan --url/--token (o BACKEND_URL/DEVICE_TOKEN en el entorno).")
        sys.exit(1)

    while True:
        temp = args.temp if args.temp is not None else round(random.uniform(18, 30), 1)
        humidity = args.humidity if args.humidity is not None else round(random.uniform(40, 80))
        try:
            cycle(args.url, args.token, temp, humidity)
        except Exception as exc:  # noqa: BLE001
            print("error:", exc)
        if not args.loop:
            break
        time.sleep(args.interval)


if __name__ == "__main__":
    main()
