"""
Device (Raspberry Pi bridge) helpers: token auth and desired-state computation.
"""
import hashlib
import secrets

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models import Device, Indoor, Measurement


def generate_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def get_device_by_token(db: Session, token: str) -> Device | None:
    if not token:
        return None
    return (
        db.query(Device)
        .filter(Device.token_hash == hash_token(token), Device.active.is_(True))
        .first()
    )


def _latest_measurement(db: Session, indoor_id) -> Measurement | None:
    """Latest measurement that actually has temperature or humidity."""
    return (
        db.query(Measurement)
        .filter(
            Measurement.indoor_id == indoor_id,
            or_(Measurement.temp_c.isnot(None), Measurement.humidity.isnot(None)),
        )
        .order_by(Measurement.event_ts.desc())
        .first()
    )


def _humidifier_recommendation(indoor: Indoor, temp, hr) -> str | None:
    """Return 'on' | 'off' | None based on the indoor thresholds."""
    if (
        indoor.humidifier_off_above_humidity is not None
        and hr is not None
        and hr > float(indoor.humidifier_off_above_humidity)
    ):
        return "off"
    if (
        indoor.humidifier_off_below_temp is not None
        and temp is not None
        and temp < float(indoor.humidifier_off_below_temp)
    ):
        return "off"
    if (
        indoor.humidifier_on_below_humidity is not None
        and hr is not None
        and hr < float(indoor.humidifier_on_below_humidity)
    ):
        return "on"
    if (
        indoor.humidifier_on_above_temp is not None
        and temp is not None
        and temp > float(indoor.humidifier_on_above_temp)
    ):
        return "on"
    return None


def compute_commands(db: Session, indoor: Indoor) -> dict:
    """
    Compute the desired state of each actuator for an indoor, using the latest
    measurement and the configured mode (auto | manual | off).
    """
    latest = _latest_measurement(db, indoor.id)
    temp = (
        float(latest.temp_c)
        if latest and latest.temp_c is not None
        else (float(indoor.temp_c) if indoor.temp_c is not None else None)
    )
    hr = (
        float(latest.humidity)
        if latest and latest.humidity is not None
        else (float(indoor.humidity) if indoor.humidity is not None else None)
    )

    # Humidifier
    if indoor.humidifier_mode == "off":
        humidifier = False
    elif indoor.humidifier_mode == "manual":
        humidifier = bool(indoor.humidifier)
    else:  # auto
        rec = _humidifier_recommendation(indoor, temp, hr)
        humidifier = (rec == "on") if rec is not None else bool(indoor.humidifier)

    # Air conditioner
    if indoor.ac_mode == "off":
        ac = False
    elif indoor.ac_mode == "manual":
        ac = bool(indoor.ac)
    else:  # auto
        ac = bool(indoor.ac)
        if temp is not None:
            if indoor.ac_on_above_temp is not None and temp > float(indoor.ac_on_above_temp):
                ac = True
            elif indoor.ac_off_below_temp is not None and temp < float(indoor.ac_off_below_temp):
                ac = False

    return {
        "indoor_id": indoor.id,
        "humidifier": humidifier,
        "ac": ac,
        "ac_hvac_mode": indoor.ac_hvac_mode or "cool",
        "humidifier_mode": indoor.humidifier_mode,
        "ac_mode": indoor.ac_mode,
    }
