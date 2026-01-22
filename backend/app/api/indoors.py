"""
Indoors router
"""
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, Indoor
from app.schemas import (
    IndoorListItem,
    IndoorDetailResponse,
    IndoorDetail,
    PlantInIndoor,
    IndoorHistoryItem,
    IndoorUpdateRequest
)
from app.api import get_current_user
from app.services.indoor_service import get_indoor_with_plants, update_indoor

router = APIRouter(prefix="/api/indoors", tags=["indoors"])


@router.get("", response_model=list[IndoorListItem])
async def list_indoors(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Get all indoors for current user with plant counts.
    """
    indoors = []
    for indoor in user.indoors:
        plants_count = len(indoor.plants)
        indoors.append(IndoorListItem(
            id=indoor.id,
            name=indoor.name,
            plants_count=plants_count
        ))
    
    return indoors


@router.get("/{indoor_id}", response_model=IndoorDetailResponse)
async def get_indoor_detail(
    indoor_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Get indoor detail with plants and history.
    """
    from uuid import UUID
    
    try:
        indoor_uuid = UUID(indoor_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid indoor_id format")
    
    indoor, plants, history = get_indoor_with_plants(db, user.id, indoor_uuid)
    
    if not indoor:
        raise HTTPException(status_code=404, detail="Indoor not found")
    
    # Build plant list with days_since_planted
    today = date.today()
    plants_list = []
    for plant in plants:
        days_since_planted = None
        if plant.planted_at:
            days_since_planted = (today - plant.planted_at).days
        
        plants_list.append(PlantInIndoor(
            id=plant.id,
            name=plant.name,
            species=plant.species,
            last_watered_at=plant.last_watered_at,
            next_water_at=plant.next_water_at,
            watering_interval_days=plant.watering_interval_days,
            days_since_planted=days_since_planted
        ))
    
    # Build history list
    history_list = [
        IndoorHistoryItem(
            event_ts=item.event_ts,
            message=item.message
        )
        for item in history
    ]
    
    indoor_detail = IndoorDetail(
        id=indoor.id,
        name=indoor.name,
        temp_c=float(indoor.temp_c) if indoor.temp_c else None,
        humidity=float(indoor.humidity) if indoor.humidity else None,
        fan_location=indoor.fan_location,
        extractor_top=indoor.extractor_top,
        extractor_bottom=indoor.extractor_bottom,
        fan=indoor.fan,
        light_height_cm=float(indoor.light_height_cm) if indoor.light_height_cm else None,
        light_power_pct=indoor.light_power_pct,
        light_schedule=indoor.light_schedule
    )
    
    return IndoorDetailResponse(
        indoor=indoor_detail,
        plants=plants_list,
        history=history_list
    )


@router.patch("/{indoor_id}", response_model=IndoorDetail)
async def update_indoor_detail(
    indoor_id: str,
    body: IndoorUpdateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Update indoor settings. Creates history entry if light_power_pct changes.
    """
    from uuid import UUID
    
    try:
        indoor_uuid = UUID(indoor_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid indoor_id format")
    
    # Get indoor
    indoor = db.query(Indoor).filter(
        Indoor.id == indoor_uuid,
        Indoor.user_id == user.id
    ).first()
    
    if not indoor:
        raise HTTPException(status_code=404, detail="Indoor not found")
    
    # Update using service
    updated_indoor = update_indoor(
        db,
        indoor,
        temp_c=body.temp_c,
        humidity=body.humidity,
        fan_location=body.fan_location,
        extractor_top=body.extractor_top,
        extractor_bottom=body.extractor_bottom,
        fan=body.fan,
        light_height_cm=body.light_height_cm,
        light_power_pct=body.light_power_pct,
        light_schedule=body.light_schedule
    )
    
    return IndoorDetail(
        id=updated_indoor.id,
        name=updated_indoor.name,
        temp_c=float(updated_indoor.temp_c) if updated_indoor.temp_c else None,
        humidity=float(updated_indoor.humidity) if updated_indoor.humidity else None,
        fan_location=updated_indoor.fan_location,
        extractor_top=updated_indoor.extractor_top,
        extractor_bottom=updated_indoor.extractor_bottom,
        fan=updated_indoor.fan,
        light_height_cm=float(updated_indoor.light_height_cm) if updated_indoor.light_height_cm else None,
        light_power_pct=updated_indoor.light_power_pct,
        light_schedule=updated_indoor.light_schedule
    )
