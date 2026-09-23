"""
Shared helper to compute the current (latest available) environment values for
an indoor.

A single source of truth used by both the API (indoor detail) and the chatbot,
so the panel, the edit form and the assistant always agree.

For each reading we take the most recent value available across:
  - Measurement rows (temp, humidity, EC, pH, runoff, PPFD)
  - WateringHistory rows (EC, pH, runoff) — the feed solution
and fall back to the values stored on the indoor for temp/humidity.
"""
from sqlalchemy.orm import Session

from app.models import Indoor, Measurement, Plant, WateringHistory

WATERING_FIELDS = ("ec", "ph", "runoff_ec")


def _num(value) -> float | None:
    return float(value) if value is not None else None


def _latest_measurement(db: Session, indoor_id, field: str) -> Measurement | None:
    column = getattr(Measurement, field)
    return (
        db.query(Measurement)
        .filter(Measurement.indoor_id == indoor_id, column.isnot(None))
        .order_by(Measurement.event_ts.desc())
        .first()
    )


def _latest_watering(db: Session, indoor_id, field: str) -> WateringHistory | None:
    column = getattr(WateringHistory, field)
    return (
        db.query(WateringHistory)
        .join(Plant, WateringHistory.plant_id == Plant.id)
        .filter(Plant.indoor_id == indoor_id, column.isnot(None))
        .order_by(WateringHistory.event_ts.desc())
        .first()
    )


def _reading(value, at, source: str | None) -> dict:
    return {"value": _num(value), "at": at, "source": source}


def compute_current_environment(db: Session, indoor: Indoor) -> dict:
    readings: dict[str, dict] = {}

    # Temperature and humidity: latest measurement, else the indoor value.
    for field, indoor_value in (("temp_c", indoor.temp_c), ("humidity", indoor.humidity)):
        measurement = _latest_measurement(db, indoor.id, field)
        if measurement is not None:
            readings[field] = _reading(getattr(measurement, field), measurement.event_ts, "measurement")
        elif indoor_value is not None:
            readings[field] = _reading(indoor_value, None, "indoor")
        else:
            readings[field] = _reading(None, None, None)

    # EC / pH / runoff / PPFD: most recent between measurements and waterings.
    for field in ("ec", "ph", "runoff_ec", "ppfd"):
        candidates = []
        measurement = _latest_measurement(db, indoor.id, field)
        if measurement is not None:
            candidates.append((measurement.event_ts, getattr(measurement, field), "measurement"))
        if field in WATERING_FIELDS:
            watering = _latest_watering(db, indoor.id, field)
            if watering is not None:
                candidates.append((watering.event_ts, getattr(watering, field), "watering"))
        if not candidates:
            readings[field] = _reading(None, None, None)
        else:
            at, value, source = max(candidates, key=lambda c: c[0])
            readings[field] = _reading(value, at, source)

    return {
        **readings,
        "light_height_cm": _num(indoor.light_height_cm),
        "light_power_pct": indoor.light_power_pct,
        "light_schedule": indoor.light_schedule,
    }
