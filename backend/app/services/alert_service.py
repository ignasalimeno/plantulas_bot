"""
Alert evaluation for indoors: watering plan, humidity and temperature.

Rules are evaluated periodically (and on demand). When a condition becomes true
an Alert is created; when it goes back to normal, the open alert is auto-resolved.
"""
from datetime import timedelta

from sqlalchemy.orm import Session

from app.models import Indoor, Measurement, WateringHistory, Plant, WateringPlan, AlertRule, Alert
from app.timeutils import now

KIND_LABELS = {
    "temp_out_of_range": "Temperatura fuera de rango",
    "humidity_below": "Humedad baja",
    "watering_overdue": "Riego atrasado",
}


def _measurements_in_window(db: Session, indoor_id, minutes: int) -> list[Measurement]:
    since = now() - timedelta(minutes=minutes)
    return (
        db.query(Measurement)
        .filter(Measurement.indoor_id == indoor_id, Measurement.event_ts >= since)
        .order_by(Measurement.event_ts.asc())
        .all()
    )


def _last_watering_at(db: Session, indoor_id):
    row = (
        db.query(WateringHistory)
        .join(Plant, WateringHistory.plant_id == Plant.id)
        .filter(Plant.indoor_id == indoor_id)
        .order_by(WateringHistory.event_ts.desc())
        .first()
    )
    return row.event_ts if row else None


def _eval_rule(db: Session, indoor: Indoor, rule: AlertRule) -> tuple[bool, str | None]:
    """Return (active, message) for a rule against the indoor's data."""
    if rule.kind == "humidity_below":
        threshold = float(rule.min_value) if rule.min_value is not None else None
        duration = rule.duration_minutes or 30
        if threshold is None:
            return False, None
        rows = _measurements_in_window(db, indoor.id, duration)
        values = [float(m.humidity) for m in rows if m.humidity is not None]
        if len(values) >= 2 and max(values) < threshold:
            return True, f"Humedad por debajo de {threshold:.0f}% durante {duration} min (mín {min(values):.0f}%)"
        return False, None

    if rule.kind == "temp_out_of_range":
        lo = float(rule.min_value) if rule.min_value is not None else None
        hi = float(rule.max_value) if rule.max_value is not None else None
        duration = rule.duration_minutes or 30
        if lo is None and hi is None:
            return False, None
        rows = _measurements_in_window(db, indoor.id, duration)
        values = [float(m.temp_c) for m in rows if m.temp_c is not None]
        if len(values) < 2:
            return False, None
        outside = all((lo is not None and v < lo) or (hi is not None and v > hi) for v in values)
        if outside:
            rng = f"{lo:.0f}–{hi:.0f}°C" if lo is not None and hi is not None else f"{lo or ''}{hi or ''}°C"
            return True, f"Temperatura fuera de rango ({rng}) durante {duration} min (actual {values[-1]:.1f}°C)"
        return False, None

    if rule.kind == "watering_overdue":
        plan = (
            db.query(WateringPlan)
            .filter(WateringPlan.indoor_id == indoor.id, WateringPlan.enabled.is_(True))
            .first()
        )
        if not plan:
            return False, None
        tolerance = rule.tolerance_days or 0
        if plan.mode == "times_per_day" and plan.times_per_day:
            expected_hours = 24 / plan.times_per_day
        elif plan.interval_days:
            expected_hours = plan.interval_days * 24
        else:
            return False, None
        expected_hours += tolerance * 24
        last = _last_watering_at(db, indoor.id)
        if last is None:
            return True, "Plan de riego activo pero nunca se registró un riego"
        elapsed_hours = (now() - last).total_seconds() / 3600
        if elapsed_hours > expected_hours:
            return True, f"Riego atrasado: pasaron {elapsed_hours:.0f} h (esperado cada {expected_hours:.0f} h)"
        return False, None

    return False, None


def evaluate_indoor(db: Session, indoor: Indoor) -> None:
    """Evaluate all enabled rules for an indoor; create/resolve alerts."""
    rules = (
        db.query(AlertRule)
        .filter(AlertRule.indoor_id == indoor.id, AlertRule.enabled.is_(True))
        .all()
    )
    for rule in rules:
        active, message = _eval_rule(db, indoor, rule)
        open_alert = (
            db.query(Alert)
            .filter(Alert.rule_id == rule.id, Alert.resolved_at.is_(None))
            .order_by(Alert.triggered_at.desc())
            .first()
        )
        if active and not open_alert:
            db.add(Alert(
                indoor_id=indoor.id,
                rule_id=rule.id,
                kind=rule.kind,
                message=message or KIND_LABELS.get(rule.kind, rule.kind),
                severity="warning",
                triggered_at=now(),
            ))
        elif not active and open_alert:
            open_alert.resolved_at = now()
    db.commit()


def evaluate_all(db: Session) -> None:
    """Evaluate every indoor (used by the background job)."""
    for indoor in db.query(Indoor).all():
        try:
            evaluate_indoor(db, indoor)
        except Exception:  # noqa: BLE001
            db.rollback()
