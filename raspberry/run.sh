#!/bin/sh
set -e

CONFIG=/data/options.json

export BACKEND_URL="$(jq -r '.backend_url' "$CONFIG")"
export DEVICE_TOKEN="$(jq -r '.device_token' "$CONFIG")"
export INTERVAL_SECONDS="$(jq -r '.interval_seconds' "$CONFIG")"

# Inside an add-on, Home Assistant Core is reachable through the Supervisor
# proxy using the automatically injected SUPERVISOR_TOKEN.
export HA_URL="http://supervisor/core"
export HA_TOKEN="${SUPERVISOR_TOKEN}"

exec python3 /bridge.py
