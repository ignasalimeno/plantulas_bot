"""
Indoor-related services
"""
from datetime import datetime, date
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models import Indoor, Plant, IndoorHistory, StageTarget, Task
from app.stages import stage_label, DEFAULT_STAGE_TARGETS, DEFAULT_TASKS
from app.timeutils import now
from uuid import UUID, uuid4


def get_indoor_with_plants(db: Session, user_id: UUID, indoor_id: UUID) -> tuple[Indoor, list[Plant], list[IndoorHistory]]:
    """
    Get indoor with its plants and history.
    Returns None if indoor doesn't belong to user.
    """
    indoor = db.query(Indoor).filter(
        Indoor.id == indoor_id,
        Indoor.user_id == user_id
    ).first()
    
    if not indoor:
        return None, None, None
    
    plants = db.query(Plant).filter(Plant.indoor_id == indoor_id).all()
    history = db.query(IndoorHistory).filter(
        IndoorHistory.indoor_id == indoor_id
    ).order_by(desc(IndoorHistory.event_ts)).all()
    
    return indoor, plants, history


def update_indoor(
    db: Session,
    indoor: Indoor,
    temp_c: float | None = None,
    humidity: float | None = None,
    fan_location: str | None = None,
    extractor_top: bool | None = None,
    extractor_bottom: bool | None = None,
    fan: bool | None = None,
    pump: bool | None = None,
    humidifier: bool | None = None,
    humidifier_on_below_humidity: float | None = None,
    humidifier_off_above_humidity: float | None = None,
    humidifier_on_above_temp: float | None = None,
    humidifier_off_below_temp: float | None = None,
    humidifier_mode: str | None = None,
    ac: bool | None = None,
    ac_mode: str | None = None,
    ac_on_above_temp: float | None = None,
    ac_off_below_temp: float | None = None,
    ac_hvac_mode: str | None = None,
    light_height_cm: float | None = None,
    light_power_pct: int | None = None,
    light_schedule: str | None = None,
    stage: str | None = None,
    stage_started_at: date | None = None,
) -> Indoor:
    """
    Update indoor fields. Creates history entries for light power and stage changes.
    """
    old_light_power = indoor.light_power_pct
    old_stage = indoor.stage
    
    # Update fields
    if temp_c is not None:
        indoor.temp_c = temp_c
    if humidity is not None:
        indoor.humidity = humidity
    if fan_location is not None:
        indoor.fan_location = fan_location
    if extractor_top is not None:
        indoor.extractor_top = extractor_top
    if extractor_bottom is not None:
        indoor.extractor_bottom = extractor_bottom
    if fan is not None:
        indoor.fan = fan
    if pump is not None:
        indoor.pump = pump
    if humidifier is not None:
        indoor.humidifier = humidifier
    if humidifier_on_below_humidity is not None:
        indoor.humidifier_on_below_humidity = humidifier_on_below_humidity
    if humidifier_off_above_humidity is not None:
        indoor.humidifier_off_above_humidity = humidifier_off_above_humidity
    if humidifier_on_above_temp is not None:
        indoor.humidifier_on_above_temp = humidifier_on_above_temp
    if humidifier_off_below_temp is not None:
        indoor.humidifier_off_below_temp = humidifier_off_below_temp
    if humidifier_mode is not None:
        indoor.humidifier_mode = humidifier_mode
    if ac is not None:
        indoor.ac = ac
    if ac_mode is not None:
        indoor.ac_mode = ac_mode
    if ac_on_above_temp is not None:
        indoor.ac_on_above_temp = ac_on_above_temp
    if ac_off_below_temp is not None:
        indoor.ac_off_below_temp = ac_off_below_temp
    if ac_hvac_mode is not None:
        indoor.ac_hvac_mode = ac_hvac_mode
    if light_height_cm is not None:
        indoor.light_height_cm = light_height_cm
    if light_power_pct is not None:
        indoor.light_power_pct = light_power_pct
    if light_schedule is not None:
        indoor.light_schedule = light_schedule
    if stage_started_at is not None:
        indoor.stage_started_at = stage_started_at
    
    # Stage change
    if stage is not None and stage != old_stage:
        indoor.stage = stage
        if stage_started_at is None:
            indoor.stage_started_at = date.today()
        db.add(IndoorHistory(
            indoor_id=indoor.id,
            event_ts=now(),
            message=f"Cambio de etapa: {stage_label(old_stage)} → {stage_label(stage)}.",
            payload={"stage": stage, "previous_stage": old_stage},
        ))
    
    # Create history if light_power_pct changed
    if light_power_pct is not None and old_light_power != light_power_pct:
        if old_light_power is not None and light_power_pct > old_light_power:
            message = f"Se aumentó la potencia de la luz a {light_power_pct}%."
        else:
            message = f"Se ajustó la potencia de la luz a {light_power_pct}%."
        
        history = IndoorHistory(
            indoor_id=indoor.id,
            event_ts=now(),
            message=message,
            payload=None
        )
        db.add(history)
    
    db.commit()
    db.refresh(indoor)
    return indoor


def seed_indoor_defaults(db: Session, indoor: Indoor) -> None:
    """
    Create default stage targets and checklist tasks for an indoor.
    Idempotent: only seeds each set if the indoor has none yet.
    """
    from decimal import Decimal

    existing_targets = db.query(StageTarget).filter(
        StageTarget.indoor_id == indoor.id
    ).count()
    if existing_targets == 0:
        for stage, target in DEFAULT_STAGE_TARGETS.items():
            db.add(StageTarget(
                indoor_id=indoor.id,
                stage=stage,
                ec_min=Decimal(str(target["ec_min"])) if target.get("ec_min") is not None else None,
                ec_max=Decimal(str(target["ec_max"])) if target.get("ec_max") is not None else None,
                ph_min=Decimal(str(target["ph_min"])) if target.get("ph_min") is not None else None,
                ph_max=Decimal(str(target["ph_max"])) if target.get("ph_max") is not None else None,
                notes=target.get("notes"),
            ))

    existing_tasks = db.query(Task).filter(Task.indoor_id == indoor.id).count()
    if existing_tasks == 0:
        for task in DEFAULT_TASKS:
            db.add(Task(
                indoor_id=indoor.id,
                title=task["title"],
                frequency=task.get("frequency"),
                stage=task.get("stage"),
                is_done=False,
            ))

    db.commit()


def register_indoor_watering(
    db: Session,
    indoor: Indoor,
    liters: float,
    event_date: date | None = None,
    note: str | None = None,
    ec: float | None = None,
    ph: float | None = None,
    runoff_ec: float | None = None,
    plant_ids: list | None = None,
) -> tuple[list[Plant], list[str], UUID]:
    """
    Register a watering for all (or a subset of) plants in an indoor.
    Returns the watered plants, their names and the event group_id.
    """
    from app.services.plant_service import register_watering

    if event_date is None:
        event_date = date.today()

    plants = list(indoor.plants)
    if plant_ids is not None:
        wanted = {str(pid) for pid in plant_ids}
        plants = [p for p in plants if str(p.id) in wanted]

    group_id = uuid4()
    names: list[str] = []
    for plant in plants:
        register_watering(
            db,
            plant.id,
            indoor.user_id,
            liters=liters,
            event_date=event_date,
            note=note,
            ec=ec,
            ph=ph,
            runoff_ec=runoff_ec,
            group_id=group_id,
        )
        names.append(plant.name)

    if plants:
        db.add(IndoorHistory(
            indoor_id=indoor.id,
            event_ts=now(),
            message=f"Riego general: {liters} L a {len(plants)} planta(s).",
            payload={"liters": liters, "plants": len(plants)},
        ))
        db.commit()

    return plants, names, group_id
