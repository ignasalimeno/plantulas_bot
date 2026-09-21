"""
Plant-related services
"""
from datetime import date, datetime
from decimal import Decimal
from sqlalchemy.orm import Session
from app.models import Plant, WateringHistory
from app.services import compute_next_water_at
from uuid import UUID, uuid4


def register_watering(
    db: Session,
    plant_id: UUID,
    user_id: UUID,
    liters: float,
    event_date: date | None = None,
    note: str | None = None,
    ferts: list | None = None,
    ec: float | None = None,
    ph: float | None = None,
    runoff_ec: float | None = None,
    group_id: UUID | None = None,
) -> tuple[Plant, WateringHistory]:
    """
    Register a watering event and update plant next_water_at.
    Returns (plant, watering_history).
    """
    if event_date is None:
        event_date = date.today()
    
    # Get plant and verify it belongs to user
    plant = db.query(Plant).filter(
        Plant.id == plant_id,
        Plant.user_id == user_id
    ).first()
    
    if not plant:
        return None, None
    
    # Create watering history
    event_ts = datetime.combine(event_date, datetime.now().time())
    
    # Convert ferts list to dict for JSONB
    ferts_dict = None
    if ferts:
        ferts_dict = {item["name"]: item["amount"] for item in ferts}
    
    watering_history = WateringHistory(
        group_id=group_id or uuid4(),
        plant_id=plant.id,
        event_ts=event_ts,
        liters=Decimal(str(liters)),
        note=note,
        ferts=ferts_dict,
        ec=Decimal(str(ec)) if ec is not None else None,
        ph=Decimal(str(ph)) if ph is not None else None,
        runoff_ec=Decimal(str(runoff_ec)) if runoff_ec is not None else None,
    )
    db.add(watering_history)
    
    # Update plant
    plant.last_watered_at = event_date
    plant.next_water_at = compute_next_water_at(
        event_date,
        plant.watering_interval_days
    )
    
    db.commit()
    db.refresh(plant)
    db.refresh(watering_history)
    
    return plant, watering_history


def get_plant(db: Session, user_id: UUID, plant_id: UUID) -> Plant | None:
    """Get a plant belonging to the user, or None."""
    return db.query(Plant).filter(
        Plant.id == plant_id,
        Plant.user_id == user_id
    ).first()


def recompute_plant_watering(db: Session, plant: Plant) -> None:
    """Recompute last_watered_at/next_water_at from the remaining watering history."""
    latest = (
        db.query(WateringHistory)
        .filter(WateringHistory.plant_id == plant.id)
        .order_by(WateringHistory.event_ts.desc())
        .first()
    )
    if latest:
        plant.last_watered_at = latest.event_ts.date()
        plant.next_water_at = compute_next_water_at(
            plant.last_watered_at, plant.watering_interval_days
        )
    else:
        plant.last_watered_at = None
        plant.next_water_at = None


def update_plant(db: Session, plant: Plant, updates: dict) -> Plant:
    """
    Update plant fields. Recomputes next_water_at when the watering interval
    changes and the plant has been watered at least once.
    """
    for field, value in updates.items():
        if field == "default_liters" and value is not None:
            value = Decimal(str(value))
        setattr(plant, field, value)
    
    if "watering_interval_days" in updates and plant.last_watered_at:
        plant.next_water_at = compute_next_water_at(
            plant.last_watered_at,
            plant.watering_interval_days
        )
    
    db.commit()
    db.refresh(plant)
    return plant
