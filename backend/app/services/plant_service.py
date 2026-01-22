"""
Plant-related services
"""
from datetime import date, datetime
from decimal import Decimal
from sqlalchemy.orm import Session
from app.models import Plant, WateringHistory
from app.services import compute_next_water_at
from uuid import UUID


def register_watering(
    db: Session,
    plant_id: UUID,
    user_id: UUID,
    liters: float,
    event_date: date | None = None,
    note: str | None = None,
    ferts: list | None = None,
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
        plant_id=plant.id,
        event_ts=event_ts,
        liters=Decimal(str(liters)),
        note=note,
        ferts=ferts_dict
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
