"""
Device router: Raspberry Pi bridges (telemetry ingest + command pull) and management.
"""
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Indoor, Device, Measurement, IndoorHistory
from app.schemas import (
    DeviceCreate,
    DeviceUpdate,
    DeviceItem,
    DeviceCreateResponse,
    TelemetryRequest,
    DeviceCommands,
    DeviceStateRequest,
)
from app.api import get_current_user
from app.services import device_service
from app.timeutils import now

router = APIRouter(prefix="/api", tags=["devices"])

ACTUATOR_FIELDS = ("humidifier", "ac", "extractor", "intractor", "fan", "pump")
ACTUATOR_LABELS = {
    "humidifier": "Humidificador",
    "ac": "Aire acondicionado",
    "extractor": "Extractor",
    "intractor": "Intractor",
    "fan": "Ventilador interno",
    "pump": "Bomba de riego",
}


def _get_owned_indoor(db: Session, user: User, indoor_id: str) -> Indoor:
    try:
        indoor_uuid = UUID(indoor_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid indoor_id format")
    indoor = db.query(Indoor).filter(
        Indoor.id == indoor_uuid,
        Indoor.user_id == user.id,
    ).first()
    if not indoor:
        raise HTTPException(status_code=404, detail="Indoor not found")
    return indoor


def get_current_device(
    request: Request,
    db: Session = Depends(get_db),
) -> Device:
    """Authenticate a bridge device via `Authorization: Bearer <token>`."""
    auth = request.headers.get("Authorization", "")
    if not auth.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing device token")
    token = auth[7:].strip()
    device = device_service.get_device_by_token(db, token)
    if not device:
        raise HTTPException(status_code=401, detail="Invalid device token")
    return device


# ============ DEVICE-FACING (bridge) ============

@router.get("/devices/me")
async def device_me(device: Device = Depends(get_current_device)):
    """Return this device's config (entity IDs) so the bridge can use them."""
    return {
        "id": str(device.id),
        "indoor_id": str(device.indoor_id),
        "name": device.name,
        "ha_entities": device.ha_entities or {},
    }


@router.post("/devices/telemetry")
async def device_telemetry(
    body: TelemetryRequest,
    db: Session = Depends(get_db),
    device: Device = Depends(get_current_device),
):
    """Ingest a sensor reading from the bridge."""
    measurement = Measurement(
        indoor_id=device.indoor_id,
        event_ts=now(),
        temp_c=Decimal(str(body.temp_c)) if body.temp_c is not None else None,
        humidity=Decimal(str(body.humidity)) if body.humidity is not None else None,
        ppfd=body.ppfd,
        ec=Decimal(str(body.ec)) if body.ec is not None else None,
        ph=Decimal(str(body.ph)) if body.ph is not None else None,
        runoff_ec=Decimal(str(body.runoff_ec)) if body.runoff_ec is not None else None,
        note=body.note,
    )
    db.add(measurement)
    device.last_seen = now()
    db.commit()
    return {"ok": True, "measurement_id": str(measurement.id)}


@router.get("/devices/commands", response_model=DeviceCommands)
async def device_commands(
    db: Session = Depends(get_db),
    device: Device = Depends(get_current_device),
):
    """Return the desired state of each actuator for the device's indoor."""
    device.last_seen = now()
    db.commit()
    indoor = db.query(Indoor).filter(Indoor.id == device.indoor_id).first()
    if not indoor:
        raise HTTPException(status_code=404, detail="Indoor not found")
    return device_service.compute_commands(db, indoor)


@router.post("/devices/state")
async def device_state(
    body: DeviceStateRequest,
    db: Session = Depends(get_db),
    device: Device = Depends(get_current_device),
):
    """The bridge reports the real state read from Home Assistant (read-only)."""
    previous = device.reported_state or {}
    new_state = {
        field: getattr(body, field)
        for field in ACTUATOR_FIELDS
        if getattr(body, field) is not None
    }

    # Log ON/OFF transitions so they show up in the indoor history timeline.
    for field, value in new_state.items():
        old = previous.get(field)
        if old is not None and old != value:
            db.add(IndoorHistory(
                indoor_id=device.indoor_id,
                event_ts=now(),
                message=f"{ACTUATOR_LABELS[field]}: {'ON' if value else 'OFF'}",
                payload={"device_id": str(device.id), "field": field, "value": value},
            ))

    device.reported_state = {**previous, **new_state, "at": now().isoformat()}
    device.last_seen = now()
    db.commit()
    return {"ok": True}


# ============ USER-FACING (management) ============

@router.get("/indoors/{indoor_id}/devices", response_model=list[DeviceItem])
async def list_devices(
    indoor_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    indoor = _get_owned_indoor(db, user, indoor_id)
    return indoor.devices


@router.post("/indoors/{indoor_id}/devices", response_model=DeviceCreateResponse, status_code=201)
async def create_device(
    indoor_id: str,
    body: DeviceCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a bridge device. The token is returned only once."""
    indoor = _get_owned_indoor(db, user, indoor_id)
    token = device_service.generate_token()
    device = Device(
        indoor_id=indoor.id,
        name=body.name,
        token_hash=device_service.hash_token(token),
        ha_entities=body.ha_entities.model_dump() if body.ha_entities else None,
    )
    db.add(device)
    db.commit()
    db.refresh(device)
    return DeviceCreateResponse(device=DeviceItem.model_validate(device), token=token)


@router.patch("/devices/{device_id}", response_model=DeviceItem)
async def update_device(
    device_id: str,
    body: DeviceUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        did = UUID(device_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid device_id format")

    device = db.query(Device).join(Indoor).filter(
        Device.id == did,
        Indoor.user_id == user.id,
    ).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    updates = body.model_dump(exclude_unset=True)
    if "ha_entities" in updates and body.ha_entities is not None:
        updates["ha_entities"] = body.ha_entities.model_dump()
    for field, value in updates.items():
        setattr(device, field, value)

    db.commit()
    db.refresh(device)
    return device


@router.post("/devices/{device_id}/rotate-token", response_model=DeviceCreateResponse)
async def rotate_device_token(
    device_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        did = UUID(device_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid device_id format")

    device = db.query(Device).join(Indoor).filter(
        Device.id == did,
        Indoor.user_id == user.id,
    ).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    token = device_service.generate_token()
    device.token_hash = device_service.hash_token(token)
    db.commit()
    db.refresh(device)
    return DeviceCreateResponse(device=DeviceItem.model_validate(device), token=token)


@router.delete("/devices/{device_id}", status_code=204)
async def delete_device(
    device_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        did = UUID(device_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid device_id format")

    device = db.query(Device).join(Indoor).filter(
        Device.id == did,
        Indoor.user_id == user.id,
    ).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    db.delete(device)
    db.commit()
    return None
