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
    IndoorWateringEvent,
    IndoorWateringEventPlant,
    IndoorWateringUpdate,
    IndoorHistoryCreate,
)
from app.api import get_current_user
from app.services.indoor_service import (
    get_indoor_with_plants,
    update_indoor,
    seed_indoor_defaults,
    register_indoor_watering,
)
from app.services.environment_service import compute_current_environment
from app.services.plant_service import recompute_plant_watering
from app.stages import DEFAULT_STAGE, STAGE_KEYS
from app.timeutils import now

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
        humidifier_mode=body.humidifier_mode or "auto",
        ac=body.ac,
        ac_mode=body.ac_mode or "auto",
        ac_on_above_temp=Decimal(str(body.ac_on_above_temp)) if body.ac_on_above_temp is not None else None,
        ac_off_below_temp=Decimal(str(body.ac_off_below_temp)) if body.ac_off_below_temp is not None else None,
        ac_hvac_mode=body.ac_hvac_mode or "cool",
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
        event_ts=now(),
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
        extractor_top=bool(indoor.extractor_top),
        extractor_bottom=bool(indoor.extractor_bottom),
        fan=bool(indoor.fan),
        humidifier=bool(indoor.humidifier),
        humidifier_on_below_humidity=float(indoor.humidifier_on_below_humidity) if indoor.humidifier_on_below_humidity is not None else None,
        humidifier_off_above_humidity=float(indoor.humidifier_off_above_humidity) if indoor.humidifier_off_above_humidity is not None else None,
        humidifier_on_above_temp=float(indoor.humidifier_on_above_temp) if indoor.humidifier_on_above_temp is not None else None,
        humidifier_off_below_temp=float(indoor.humidifier_off_below_temp) if indoor.humidifier_off_below_temp is not None else None,
        humidifier_mode=indoor.humidifier_mode or "auto",
        ac=bool(indoor.ac),
        ac_mode=indoor.ac_mode or "auto",
        ac_on_above_temp=float(indoor.ac_on_above_temp) if indoor.ac_on_above_temp is not None else None,
        ac_off_below_temp=float(indoor.ac_off_below_temp) if indoor.ac_off_below_temp is not None else None,
        ac_hvac_mode=indoor.ac_hvac_mode,
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
            id=item.id,
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
        extractor_top=bool(indoor.extractor_top),
        extractor_bottom=bool(indoor.extractor_bottom),
        fan=bool(indoor.fan),
        humidifier=bool(indoor.humidifier),
        humidifier_on_below_humidity=float(indoor.humidifier_on_below_humidity) if indoor.humidifier_on_below_humidity is not None else None,
        humidifier_off_above_humidity=float(indoor.humidifier_off_above_humidity) if indoor.humidifier_off_above_humidity is not None else None,
        humidifier_on_above_temp=float(indoor.humidifier_on_above_temp) if indoor.humidifier_on_above_temp is not None else None,
        humidifier_off_below_temp=float(indoor.humidifier_off_below_temp) if indoor.humidifier_off_below_temp is not None else None,
        humidifier_mode=indoor.humidifier_mode or "auto",
        ac=bool(indoor.ac),
        ac_mode=indoor.ac_mode or "auto",
        ac_on_above_temp=float(indoor.ac_on_above_temp) if indoor.ac_on_above_temp is not None else None,
        ac_off_below_temp=float(indoor.ac_off_below_temp) if indoor.ac_off_below_temp is not None else None,
        ac_hvac_mode=indoor.ac_hvac_mode,
        light_height_cm=float(indoor.light_height_cm) if indoor.light_height_cm else None,
        light_power_pct=indoor.light_power_pct,
        light_schedule=indoor.light_schedule,
        stage=indoor.stage,
        stage_started_at=indoor.stage_started_at,
        current_environment=compute_current_environment(db, indoor),
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
        humidifier_mode=body.humidifier_mode,
        ac=body.ac,
        ac_mode=body.ac_mode,
        ac_on_above_temp=body.ac_on_above_temp,
        ac_off_below_temp=body.ac_off_below_temp,
        ac_hvac_mode=body.ac_hvac_mode,
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
        extractor_top=bool(updated_indoor.extractor_top),
        extractor_bottom=bool(updated_indoor.extractor_bottom),
        fan=bool(updated_indoor.fan),
        humidifier=bool(updated_indoor.humidifier),
        humidifier_on_below_humidity=float(updated_indoor.humidifier_on_below_humidity) if updated_indoor.humidifier_on_below_humidity is not None else None,
        humidifier_off_above_humidity=float(updated_indoor.humidifier_off_above_humidity) if updated_indoor.humidifier_off_above_humidity is not None else None,
        humidifier_on_above_temp=float(updated_indoor.humidifier_on_above_temp) if updated_indoor.humidifier_on_above_temp is not None else None,
        humidifier_off_below_temp=float(updated_indoor.humidifier_off_below_temp) if updated_indoor.humidifier_off_below_temp is not None else None,
        humidifier_mode=updated_indoor.humidifier_mode or "auto",
        ac=bool(updated_indoor.ac),
        ac_mode=updated_indoor.ac_mode or "auto",
        ac_on_above_temp=float(updated_indoor.ac_on_above_temp) if updated_indoor.ac_on_above_temp is not None else None,
        ac_off_below_temp=float(updated_indoor.ac_off_below_temp) if updated_indoor.ac_off_below_temp is not None else None,
        ac_hvac_mode=updated_indoor.ac_hvac_mode,
        light_height_cm=float(updated_indoor.light_height_cm) if updated_indoor.light_height_cm else None,
        light_power_pct=updated_indoor.light_power_pct,
        light_schedule=updated_indoor.light_schedule,
        stage=updated_indoor.stage,
        stage_started_at=updated_indoor.stage_started_at,
        current_environment=compute_current_environment(db, updated_indoor),
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

    plants, names, group_id = register_indoor_watering(
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
        applied_at = datetime.combine(event_date, now().time())
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


def _group_watering_events(db: Session, indoor_id) -> list[IndoorWateringEvent]:
    rows = (
        db.query(WateringHistory, Plant)
        .join(Plant, WateringHistory.plant_id == Plant.id)
        .filter(Plant.indoor_id == indoor_id)
        .order_by(WateringHistory.event_ts.desc())
        .all()
    )
    groups: dict = {}
    order: list = []
    for wh, plant in rows:
        gid = wh.group_id
        if gid not in groups:
            groups[gid] = IndoorWateringEvent(
                group_id=gid,
                event_ts=wh.event_ts,
                liters=float(wh.liters),
                ec=float(wh.ec) if wh.ec is not None else None,
                ph=float(wh.ph) if wh.ph is not None else None,
                runoff_ec=float(wh.runoff_ec) if wh.runoff_ec is not None else None,
                note=wh.note,
                plants=[],
            )
            order.append(gid)
        groups[gid].plants.append(IndoorWateringEventPlant(id=plant.id, name=plant.name))
    return [groups[g] for g in order]


@router.get("/{indoor_id}/watering-history", response_model=list[IndoorWateringEvent])
async def get_indoor_watering_history(
    indoor_id: str,
    limit: int = 100,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Get watering events for an indoor, grouped (one per event, with its plants).
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

    return _group_watering_events(db, indoor.id)[:limit]


@router.patch("/watering-events/{group_id}", response_model=IndoorWateringEvent)
async def update_watering_event(
    group_id: str,
    body: IndoorWateringUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Update a watering event (all its plants). Optionally replace which plants it includes.
    """
    from uuid import UUID

    try:
        gid = UUID(group_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid group_id format")

    rows = (
        db.query(WateringHistory)
        .join(Plant, WateringHistory.plant_id == Plant.id)
        .filter(WateringHistory.group_id == gid, Plant.user_id == user.id)
        .all()
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Watering event not found")

    indoor = rows[0].plant.indoor
    affected = {r.plant_id for r in rows}

    # Update values on all rows
    for r in rows:
        if body.liters is not None:
            r.liters = body.liters
        if body.ec is not None:
            r.ec = body.ec
        if body.ph is not None:
            r.ph = body.ph
        if body.runoff_ec is not None:
            r.runoff_ec = body.runoff_ec
        if body.note is not None:
            r.note = body.note
        if body.date is not None:
            r.event_ts = datetime.combine(body.date, r.event_ts.time())

    # Replace the plant set if requested
    if body.plant_ids is not None:
        valid = {
            p.id
            for p in db.query(Plant).filter(
                Plant.user_id == user.id, Plant.id.in_(body.plant_ids)
            ).all()
        }
        base = rows[0]
        for r in list(rows):
            if r.plant_id not in valid:
                affected.add(r.plant_id)
                db.delete(r)
        existing = {r.plant_id for r in rows}
        for pid in valid - existing:
            db.add(WateringHistory(
                group_id=gid,
                plant_id=pid,
                event_ts=base.event_ts,
                liters=base.liters,
                note=base.note,
                ferts=base.ferts,
                ec=base.ec,
                ph=base.ph,
                runoff_ec=base.runoff_ec,
            ))
            affected.add(pid)

    db.commit()

    for pid in affected:
        plant = db.query(Plant).filter(Plant.id == pid).first()
        if plant:
            recompute_plant_watering(db, plant)
    db.commit()

    if indoor:
        for e in _group_watering_events(db, indoor.id):
            if e.group_id == gid:
                return e
    raise HTTPException(status_code=404, detail="Watering event not found")


@router.delete("/watering-events/{group_id}", status_code=204)
async def delete_watering_event(
    group_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete a watering event (all its plant rows)."""
    from uuid import UUID

    try:
        gid = UUID(group_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid group_id format")

    rows = (
        db.query(WateringHistory)
        .join(Plant, WateringHistory.plant_id == Plant.id)
        .filter(WateringHistory.group_id == gid, Plant.user_id == user.id)
        .all()
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Watering event not found")

    affected = {r.plant_id for r in rows}
    for r in rows:
        db.delete(r)
    db.commit()

    for pid in affected:
        plant = db.query(Plant).filter(Plant.id == pid).first()
        if plant:
            recompute_plant_watering(db, plant)
    db.commit()
    return None


@router.post("/{indoor_id}/history", response_model=IndoorHistoryItem, status_code=201)
async def create_indoor_history_event(
    indoor_id: str,
    body: IndoorHistoryCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Add a manual history event to an indoor."""
    from uuid import UUID
    from app.models import IndoorHistory

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
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="Message required")

    event = IndoorHistory(
        indoor_id=indoor.id,
        event_ts=body.event_ts or now(),
        message=body.message.strip(),
        payload=None,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return IndoorHistoryItem(id=event.id, event_ts=event.event_ts, message=event.message)


@router.delete("/{indoor_id}/history/{event_id}", status_code=204)
async def delete_indoor_history_event(
    indoor_id: str,
    event_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete a history event from an indoor."""
    from uuid import UUID
    from app.models import IndoorHistory

    try:
        indoor_uuid = UUID(indoor_id)
        event_uuid = UUID(event_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid id format")

    indoor = db.query(Indoor).filter(
        Indoor.id == indoor_uuid,
        Indoor.user_id == user.id,
    ).first()
    if not indoor:
        raise HTTPException(status_code=404, detail="Indoor not found")

    event = db.query(IndoorHistory).filter(
        IndoorHistory.id == event_uuid,
        IndoorHistory.indoor_id == indoor.id,
    ).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    db.delete(event)
    db.commit()
    return None
