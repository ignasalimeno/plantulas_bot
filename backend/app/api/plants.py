"""
Plants router
"""
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, Plant, Indoor, WateringHistory
from app.schemas import (
    PlantWaterRequest,
    WaterResponseData,
    PlantResponse,
    WateringHistoryItem,
    PlantCreateRequest,
    PlantUpdateRequest,
    PlantDetailResponse,
    PlantHistoryResponse,
)
from app.api import get_current_user
from app.services.plant_service import register_watering, get_plant, update_plant

router = APIRouter(prefix="/api/plants", tags=["plants"])


def _plant_detail(plant: Plant) -> PlantDetailResponse:
    """Build a PlantDetailResponse from a Plant model."""
    return PlantDetailResponse(
        id=plant.id,
        name=plant.name,
        species=plant.species,
        indoor_id=plant.indoor_id,
        indoor_name=plant.indoor.name if plant.indoor else None,
        planted_at=plant.planted_at,
        notes=plant.notes,
        watering_interval_days=plant.watering_interval_days,
        default_liters=float(plant.default_liters),
        last_watered_at=plant.last_watered_at,
        next_water_at=plant.next_water_at,
    )


def _parse_plant_id(plant_id: str):
    from uuid import UUID
    try:
        return UUID(plant_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid plant_id format")


@router.post("", response_model=PlantResponse, status_code=201)
async def create_plant(
    body: PlantCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Create a new plant.
    """
    from datetime import datetime
    from decimal import Decimal
    from app.models import Plant, Indoor, IndoorHistory
    
    # Validate indoor_id if provided
    if body.indoor_id:
        indoor = db.query(Indoor).filter(
            Indoor.id == body.indoor_id,
            Indoor.user_id == user.id
        ).first()
        if not indoor:
            raise HTTPException(status_code=404, detail="Indoor not found")
    
    # Create plant
    plant = Plant(
        user_id=user.id,
        indoor_id=body.indoor_id,
        name=body.name,
        species=body.species,
        planted_at=body.planted_at,
        watering_interval_days=body.watering_interval_days,
        default_liters=Decimal(str(body.default_liters)),
        notes=body.notes,
        last_watered_at=None,
        next_water_at=None
    )
    
    db.add(plant)
    db.commit()
    db.refresh(plant)
    
    # Log plant creation in indoor history
    if plant.indoor_id:
        history = IndoorHistory(
            indoor_id=plant.indoor_id,
            event_ts=datetime.now(),
            message=f"Se añadió la planta '{plant.name}'.",
            payload=None
        )
        db.add(history)
        db.commit()
    
    return PlantResponse(
        id=plant.id,
        name=plant.name,
        species=plant.species,
        last_watered_at=plant.last_watered_at,
        next_water_at=plant.next_water_at,
        watering_interval_days=plant.watering_interval_days,
        default_liters=float(plant.default_liters)
    )


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
        ferts=[f.dict() for f in body.ferts] if body.ferts else None,
        ec=body.ec,
        ph=body.ph,
        runoff_ec=body.runoff_ec,
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
        ferts=watering_history.ferts,
        ec=float(watering_history.ec) if watering_history.ec is not None else None,
        ph=float(watering_history.ph) if watering_history.ph is not None else None,
        runoff_ec=float(watering_history.runoff_ec) if watering_history.runoff_ec is not None else None,
    )
    
    return WaterResponseData(
        plant=plant_response,
        watering_history=watering_response
    )


@router.get("", response_model=list[PlantDetailResponse])
async def list_plants(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    List all plants for the current user.
    """
    plants = db.query(Plant).filter(Plant.user_id == user.id).order_by(Plant.name).all()
    return [_plant_detail(p) for p in plants]


@router.get("/{plant_id}", response_model=PlantDetailResponse)
async def get_plant_detail(
    plant_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Get a single plant by id.
    """
    plant = get_plant(db, user.id, _parse_plant_id(plant_id))
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    return _plant_detail(plant)


@router.get("/{plant_id}/history", response_model=PlantHistoryResponse)
async def get_plant_history(
    plant_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Get a plant with its watering history (most recent first).
    """
    plant = get_plant(db, user.id, _parse_plant_id(plant_id))
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    
    history = db.query(WateringHistory).filter(
        WateringHistory.plant_id == plant.id
    ).order_by(WateringHistory.event_ts.desc()).all()
    
    history_items = [
        WateringHistoryItem(
            id=item.id,
            event_ts=item.event_ts,
            liters=float(item.liters),
            note=item.note,
            ferts=item.ferts,
            ec=float(item.ec) if item.ec is not None else None,
            ph=float(item.ph) if item.ph is not None else None,
            runoff_ec=float(item.runoff_ec) if item.runoff_ec is not None else None,
        )
        for item in history
    ]
    
    return PlantHistoryResponse(plant=_plant_detail(plant), history=history_items)


@router.patch("/{plant_id}", response_model=PlantDetailResponse)
async def update_plant_detail(
    plant_id: str,
    body: PlantUpdateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Update a plant. Only provided fields are changed.
    """
    from datetime import datetime
    from app.models import IndoorHistory
    
    plant = get_plant(db, user.id, _parse_plant_id(plant_id))
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    
    updates = body.model_dump(exclude_unset=True)
    old_name = plant.name
    old_indoor_id = plant.indoor_id
    
    # Validate new indoor if provided (None means "no indoor")
    if "indoor_id" in updates and updates["indoor_id"] is not None:
        indoor = db.query(Indoor).filter(
            Indoor.id == updates["indoor_id"],
            Indoor.user_id == user.id
        ).first()
        if not indoor:
            raise HTTPException(status_code=404, detail="Indoor not found")
    
    updated = update_plant(db, plant, updates)
    
    # Log relevant changes in the indoor history
    target_indoor_id = updated.indoor_id
    if target_indoor_id:
        messages = []
        if "indoor_id" in updates and old_indoor_id != target_indoor_id:
            messages.append(f"Se movió la planta '{updated.name}' a este indoor.")
        if "name" in updates and old_name != updated.name:
            messages.append(f"Se renombró la planta '{old_name}' a '{updated.name}'.")
        if messages:
            for message in messages:
                db.add(IndoorHistory(
                    indoor_id=target_indoor_id,
                    event_ts=datetime.now(),
                    message=message,
                    payload=None,
                ))
            db.commit()
    
    return _plant_detail(updated)


@router.delete("/{plant_id}", status_code=204)
async def delete_plant(
    plant_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Delete a plant and its watering history.
    """
    plant = get_plant(db, user.id, _parse_plant_id(plant_id))
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    
    db.delete(plant)
    db.commit()
    return None
