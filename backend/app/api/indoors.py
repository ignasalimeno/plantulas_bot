"""
Indoors router
"""
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, Indoor, Plant, WateringHistory, Fertilizer, FertilizerApplication
from app.schemas import (
    IndoorListItem,
    IndoorDetailResponse,
    IndoorDetail,
    PlantInIndoor,
    IndoorHistoryItem,
    IndoorCreateRequest,
    IndoorUpdateRequest,
    IndoorWaterRequest,
    IndoorWaterResponse,
    IndoorWateringItem,
)
from app.api import get_current_user
from app.services.indoor_service import (
    get_indoor_with_plants,
    update_indoor,
    seed_indoor_defaults,
    register_indoor_watering,
)
from app.stages import DEFAULT_STAGE, STAGE_KEYS

router = APIRouter(prefix="/api/indoors", tags=["indoors"])


@router.post("", response_model=IndoorDetail, status_code=201)
async def create_indoor(
    body: IndoorCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Create a new indoor environment.
    """
    from decimal import Decimal
    from datetime import datetime
    from app.models import IndoorHistory
    
    if body.stage is not None and body.stage not in STAGE_KEYS:
        raise HTTPException(status_code=400, detail="Invalid stage")
    
    # Create indoor
    indoor = Indoor(
        user_id=user.id,
        name=body.name,
        temp_c=Decimal(str(body.temp_c)) if body.temp_c is not None else None,
        humidity=Decimal(str(body.humidity)) if body.humidity is not None else None,
        fan_location=body.fan_location,
        extractor_top=body.extractor_top,
        extractor_bottom=body.extractor_bottom,
        fan=body.fan,
        humidifier=body.humidifier,
        humidifier_on_below_humidity=Decimal(str(body.humidifier_on_below_humidity)) if body.humidifier_on_below_humidity is not None else None,
        humidifier_off_above_humidity=Decimal(str(body.humidifier_off_above_humidity)) if body.humidifier_off_above_humidity is not None else None,
        humidifier_on_above_temp=Decimal(str(body.humidifier_on_above_temp)) if body.humidifier_on_above_temp is not None else None,
        humidifier_off_below_temp=Decimal(str(body.humidifier_off_below_temp)) if body.humidifier_off_below_temp is not None else None,
        light_height_cm=Decimal(str(body.light_height_cm)) if body.light_height_cm is not None else None,
        light_power_pct=body.light_power_pct,
        light_schedule=body.light_schedule,
        stage=body.stage or DEFAULT_STAGE,
        stage_started_at=body.stage_started_at,
    )
    
    db.add(indoor)
    db.commit()
    db.refresh(indoor)
    
    # Create history entry
    history = IndoorHistory(
        indoor_id=indoor.id,
        event_ts=datetime.now(),
        message="Indoor creado.",
        payload=None
    )
    db.add(history)
    db.commit()
    
    # Seed default stage targets and checklist
    seed_indoor_defaults(db, indoor)
    db.refresh(indoor)
    
    return IndoorDetail(
        id=indoor.id,
        name=indoor.name,
        temp_c=float(indoor.temp_c) if indoor.temp_c else None,
        humidity=float(indoor.humidity) if indoor.humidity else None,
        fan_location=indoor.fan_location,
        extractor_top=indoor.extractor_top,
        extractor_bottom=indoor.extractor_bottom,
        fan=indoor.fan,
        humidifier=indoor.humidifier,
        humidifier_on_below_humidity=float(indoor.humidifier_on_below_humidity) if indoor.humidifier_on_below_humidity is not None else None,
        humidifier_off_above_humidity=float(indoor.humidifier_off_above_humidity) if indoor.humidifier_off_above_humidity is not None else None,
        humidifier_on_above_temp=float(indoor.humidifier_on_above_temp) if indoor.humidifier_on_above_temp is not None else None,
        humidifier_off_below_temp=float(indoor.humidifier_off_below_temp) if indoor.humidifier_off_below_temp is not None else None,
        light_height_cm=float(indoor.light_height_cm) if indoor.light_height_cm else None,
        light_power_pct=indoor.light_power_pct,
        light_schedule=indoor.light_schedule,
        stage=indoor.stage,
        stage_started_at=indoor.stage_started_at,
    )


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
            days_since_planted=days_since_planted,
            planted_at=plant.planted_at,
            default_liters=float(plant.default_liters),
            notes=plant.notes,
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
        humidifier=indoor.humidifier,
        humidifier_on_below_humidity=float(indoor.humidifier_on_below_humidity) if indoor.humidifier_on_below_humidity is not None else None,
        humidifier_off_above_humidity=float(indoor.humidifier_off_above_humidity) if indoor.humidifier_off_above_humidity is not None else None,
        humidifier_on_above_temp=float(indoor.humidifier_on_above_temp) if indoor.humidifier_on_above_temp is not None else None,
        humidifier_off_below_temp=float(indoor.humidifier_off_below_temp) if indoor.humidifier_off_below_temp is not None else None,
        light_height_cm=float(indoor.light_height_cm) if indoor.light_height_cm else None,
        light_power_pct=indoor.light_power_pct,
        light_schedule=indoor.light_schedule,
        stage=indoor.stage,
        stage_started_at=indoor.stage_started_at,
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
    
    if body.stage is not None and body.stage not in STAGE_KEYS:
        raise HTTPException(status_code=400, detail="Invalid stage")
    
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
        humidifier=body.humidifier,
        humidifier_on_below_humidity=body.humidifier_on_below_humidity,
        humidifier_off_above_humidity=body.humidifier_off_above_humidity,
        humidifier_on_above_temp=body.humidifier_on_above_temp,
        humidifier_off_below_temp=body.humidifier_off_below_temp,
        light_height_cm=body.light_height_cm,
        light_power_pct=body.light_power_pct,
        light_schedule=body.light_schedule,
        stage=body.stage,
        stage_started_at=body.stage_started_at,
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
        humidifier=updated_indoor.humidifier,
        humidifier_on_below_humidity=float(updated_indoor.humidifier_on_below_humidity) if updated_indoor.humidifier_on_below_humidity is not None else None,
        humidifier_off_above_humidity=float(updated_indoor.humidifier_off_above_humidity) if updated_indoor.humidifier_off_above_humidity is not None else None,
        humidifier_on_above_temp=float(updated_indoor.humidifier_on_above_temp) if updated_indoor.humidifier_on_above_temp is not None else None,
        humidifier_off_below_temp=float(updated_indoor.humidifier_off_below_temp) if updated_indoor.humidifier_off_below_temp is not None else None,
        light_height_cm=float(updated_indoor.light_height_cm) if updated_indoor.light_height_cm else None,
        light_power_pct=updated_indoor.light_power_pct,
        light_schedule=updated_indoor.light_schedule,
        stage=updated_indoor.stage,
        stage_started_at=updated_indoor.stage_started_at,
    )


@router.post("/{indoor_id}/water", response_model=IndoorWaterResponse)
async def water_indoor(
    indoor_id: str,
    body: IndoorWaterRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Register the same watering for all (or a selected subset of) plants in an indoor.
    """
    from uuid import UUID

    try:
        indoor_uuid = UUID(indoor_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid indoor_id format")

    indoor = db.query(Indoor).filter(
        Indoor.id == indoor_uuid,
        Indoor.user_id == user.id,
    ).first()
    if not indoor:
        raise HTTPException(status_code=404, detail="Indoor not found")

    if body.liters <= 0:
        raise HTTPException(status_code=400, detail="liters must be greater than 0")

    event_date = body.date or date.today()

    plants, names = register_indoor_watering(
        db,
        indoor,
        liters=body.liters,
        event_date=event_date,
        note=body.note,
        ec=body.ec,
        ph=body.ph,
        runoff_ec=body.runoff_ec,
        plant_ids=body.plant_ids,
    )

    applications_created = 0
    if body.fertilizers:
        applied_at = datetime.combine(event_date, datetime.now().time())
        for item in body.fertilizers:
            fert = db.query(Fertilizer).filter(
                Fertilizer.id == item.fertilizer_id,
                Fertilizer.user_id == user.id,
            ).first()
            if not fert:
                raise HTTPException(status_code=404, detail="Fertilizer not found")
            db.add(FertilizerApplication(
                indoor_id=indoor.id,
                fertilizer_id=fert.id,
                applied_at=applied_at,
                amount=item.amount,
                note=body.note,
            ))
            applications_created += 1
        db.commit()

    return IndoorWaterResponse(
        plants_watered=len(plants),
        liters=body.liters,
        plant_names=names,
        applications_created=applications_created,
    )


@router.get("/{indoor_id}/watering-history", response_model=list[IndoorWateringItem])
async def get_indoor_watering_history(
    indoor_id: str,
    limit: int = 100,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Get all watering events for an indoor, merged across its plants.
    """
    from uuid import UUID

    try:
        indoor_uuid = UUID(indoor_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid indoor_id format")

    indoor = db.query(Indoor).filter(
        Indoor.id == indoor_uuid,
        Indoor.user_id == user.id,
    ).first()
    if not indoor:
        raise HTTPException(status_code=404, detail="Indoor not found")

    rows = (
        db.query(WateringHistory, Plant)
        .join(Plant, WateringHistory.plant_id == Plant.id)
        .filter(Plant.indoor_id == indoor.id)
        .order_by(WateringHistory.event_ts.desc())
        .limit(limit)
        .all()
    )

    return [
        IndoorWateringItem(
            id=wh.id,
            plant_id=plant.id,
            plant_name=plant.name,
            event_ts=wh.event_ts,
            liters=float(wh.liters),
            note=wh.note,
            ferts=wh.ferts,
            ec=float(wh.ec) if wh.ec is not None else None,
            ph=float(wh.ph) if wh.ph is not None else None,
            runoff_ec=float(wh.runoff_ec) if wh.runoff_ec is not None else None,
        )
        for wh, plant in rows
    ]
