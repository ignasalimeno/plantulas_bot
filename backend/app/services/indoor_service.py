"""
Indoor-related services
"""
from datetime import datetime, date
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models import Indoor, Plant, IndoorHistory
from uuid import UUID


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
    light_height_cm: float | None = None,
    light_power_pct: int | None = None,
    light_schedule: str | None = None,
) -> Indoor:
    """
    Update indoor fields and create history if light_power_pct changes.
    """
    old_light_power = indoor.light_power_pct
    
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
    if light_height_cm is not None:
        indoor.light_height_cm = light_height_cm
    if light_power_pct is not None:
        indoor.light_power_pct = light_power_pct
    if light_schedule is not None:
        indoor.light_schedule = light_schedule
    
    # Create history if light_power_pct changed
    if light_power_pct is not None and old_light_power != light_power_pct:
        if light_power_pct > old_light_power:
            message = f"Se aumentó la potencia de la luz a {light_power_pct}%."
        else:
            message = f"Se ajustó la potencia de la luz a {light_power_pct}%."
        
        history = IndoorHistory(
            indoor_id=indoor.id,
            event_ts=datetime.now(),
            message=message,
            payload=None
        )
        db.add(history)
    
    db.commit()
    db.refresh(indoor)
    return indoor
