"""
Plants router
"""
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.schemas import PlantWaterRequest, WaterResponseData, PlantResponse, WateringHistoryItem
from app.api import get_current_user
from app.services.plant_service import register_watering

router = APIRouter(prefix="/api/plants", tags=["plants"])


@router.post("/{plant_id}/water", response_model=WaterResponseData)
async def water_plant(
    plant_id: str,
    body: PlantWaterRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Register a watering event. Updates plant last_watered_at and next_water_at.
    """
    from uuid import UUID
    
    try:
        plant_uuid = UUID(plant_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid plant_id format")
    
    # Use today if date not provided
    event_date = body.date if body.date else date.today()
    
    # Register watering
    plant, watering_history = register_watering(
        db,
        plant_uuid,
        user.id,
        liters=body.liters,
        event_date=event_date,
        note=body.note,
        ferts=[f.dict() for f in body.ferts] if body.ferts else None
    )
    
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    
    # Build response
    plant_response = PlantResponse(
        id=plant.id,
        name=plant.name,
        species=plant.species,
        last_watered_at=plant.last_watered_at,
        next_water_at=plant.next_water_at,
        watering_interval_days=plant.watering_interval_days,
        default_liters=float(plant.default_liters)
    )
    
    watering_response = WateringHistoryItem(
        id=watering_history.id,
        event_ts=watering_history.event_ts,
        liters=float(watering_history.liters),
        note=watering_history.note,
        ferts=watering_history.ferts
    )
    
    return WaterResponseData(
        plant=plant_response,
        watering_history=watering_response
    )
