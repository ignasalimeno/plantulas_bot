"""
Fertilizer catalog, per-indoor feeding plan and application log.
"""
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Indoor, Fertilizer, IndoorFertilizerPlan, FertilizerApplication
from app.schemas import (
    FertilizerCreate,
    FertilizerUpdate,
    FertilizerItem,
    PlanUpdate,
    PlanItemResponse,
    ApplicationCreate,
    ApplicationItem,
)
from app.api import get_current_user
from app.timeutils import now

router = APIRouter(prefix="/api", tags=["fertilizers"])


def _get_indoor(db: Session, user: User, indoor_id: str) -> Indoor:
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
    return indoor


def _get_fertilizer(db: Session, user: User, fertilizer_id) -> Fertilizer:
    fert = db.query(Fertilizer).filter(
        Fertilizer.id == fertilizer_id,
        Fertilizer.user_id == user.id,
    ).first()
    if not fert:
        raise HTTPException(status_code=404, detail="Fertilizer not found")
    return fert


# ============ CATALOG ============

def _fertilizer_item(f: Fertilizer) -> FertilizerItem:
    return FertilizerItem(
        id=f.id,
        name=f.name,
        kind=f.kind,
        unit=f.unit,
        default_amount=float(f.default_amount) if f.default_amount is not None else None,
        notes=f.notes,
    )


@router.get("/fertilizers", response_model=list[FertilizerItem])
async def list_fertilizers(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = db.query(Fertilizer).filter(Fertilizer.user_id == user.id).order_by(Fertilizer.name).all()
    return [_fertilizer_item(f) for f in rows]


@router.post("/fertilizers", response_model=FertilizerItem, status_code=201)
async def create_fertilizer(
    body: FertilizerCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fert = Fertilizer(
        user_id=user.id,
        name=body.name,
        kind=body.kind,
        unit=body.unit,
        default_amount=Decimal(str(body.default_amount)) if body.default_amount is not None else None,
        notes=body.notes,
    )
    db.add(fert)
    db.commit()
    db.refresh(fert)
    return _fertilizer_item(fert)


@router.patch("/fertilizers/{fertilizer_id}", response_model=FertilizerItem)
async def update_fertilizer(
    fertilizer_id: str,
    body: FertilizerUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        fid = UUID(fertilizer_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid fertilizer_id format")

    fert = _get_fertilizer(db, user, fid)
    updates = body.model_dump(exclude_unset=True)
    for field, value in updates.items():
        if field == "default_amount":
            value = Decimal(str(value)) if value is not None else None
        setattr(fert, field, value)
    db.commit()
    db.refresh(fert)
    return _fertilizer_item(fert)


@router.delete("/fertilizers/{fertilizer_id}", status_code=204)
async def delete_fertilizer(
    fertilizer_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        fid = UUID(fertilizer_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid fertilizer_id format")

    fert = _get_fertilizer(db, user, fid)
    db.delete(fert)
    db.commit()
    return None


# ============ PLAN ============

def _plan_response(db: Session, indoor: Indoor) -> list[PlanItemResponse]:
    items = db.query(IndoorFertilizerPlan).filter(
        IndoorFertilizerPlan.indoor_id == indoor.id
    ).all()

    last_applied = dict(
        db.query(
            FertilizerApplication.fertilizer_id,
            func.max(FertilizerApplication.applied_at),
        )
        .filter(FertilizerApplication.indoor_id == indoor.id)
        .group_by(FertilizerApplication.fertilizer_id)
        .all()
    )

    result = []
    for item in items:
        fert = item.fertilizer
        if not fert:
            continue
        result.append(PlanItemResponse(
            id=item.id,
            fertilizer_id=fert.id,
            fertilizer_name=fert.name,
            kind=fert.kind,
            unit=fert.unit,
            default_amount=float(fert.default_amount) if fert.default_amount is not None else None,
            frequency=item.frequency,
            stage=item.stage,
            active=item.active,
            last_applied_at=last_applied.get(fert.id),
        ))
    result.sort(key=lambda x: x.fertilizer_name.lower())
    return result


@router.get("/indoors/{indoor_id}/fertilizer-plan", response_model=list[PlanItemResponse])
async def get_fertilizer_plan(
    indoor_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    indoor = _get_indoor(db, user, indoor_id)
    return _plan_response(db, indoor)


@router.put("/indoors/{indoor_id}/fertilizer-plan", response_model=list[PlanItemResponse])
async def update_fertilizer_plan(
    indoor_id: str,
    body: PlanUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    indoor = _get_indoor(db, user, indoor_id)

    # Replace the whole plan
    db.query(IndoorFertilizerPlan).filter(
        IndoorFertilizerPlan.indoor_id == indoor.id
    ).delete(synchronize_session=False)

    seen = set()
    for item in body.items:
        if item.fertilizer_id in seen:
            continue
        seen.add(item.fertilizer_id)
        _get_fertilizer(db, user, item.fertilizer_id)
        db.add(IndoorFertilizerPlan(
            indoor_id=indoor.id,
            fertilizer_id=item.fertilizer_id,
            frequency=item.frequency,
            stage=item.stage,
            active=item.active,
        ))

    db.commit()
    return _plan_response(db, indoor)


# ============ APPLICATIONS ============

def _application_item(app: FertilizerApplication) -> ApplicationItem:
    return ApplicationItem(
        id=app.id,
        fertilizer_id=app.fertilizer_id,
        fertilizer_name=app.fertilizer.name if app.fertilizer else "",
        applied_at=app.applied_at,
        amount=float(app.amount) if app.amount is not None else None,
        note=app.note,
    )


@router.get("/indoors/{indoor_id}/fertilizer-applications", response_model=list[ApplicationItem])
async def list_fertilizer_applications(
    indoor_id: str,
    limit: int = 100,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    indoor = _get_indoor(db, user, indoor_id)
    rows = db.query(FertilizerApplication).filter(
        FertilizerApplication.indoor_id == indoor.id
    ).order_by(FertilizerApplication.applied_at.desc()).limit(limit).all()
    return [_application_item(a) for a in rows]


@router.post("/indoors/{indoor_id}/fertilizer-applications", response_model=ApplicationItem, status_code=201)
async def create_fertilizer_application(
    indoor_id: str,
    body: ApplicationCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    indoor = _get_indoor(db, user, indoor_id)
    fert = _get_fertilizer(db, user, body.fertilizer_id)

    app = FertilizerApplication(
        indoor_id=indoor.id,
        fertilizer_id=fert.id,
        applied_at=body.applied_at or now(),
        amount=Decimal(str(body.amount)) if body.amount is not None else None,
        note=body.note,
    )
    db.add(app)
    db.commit()
    db.refresh(app)
    return _application_item(app)


@router.delete("/fertilizer-applications/{application_id}", status_code=204)
async def delete_fertilizer_application(
    application_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        aid = UUID(application_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid application_id format")

    app = db.query(FertilizerApplication).join(Indoor).filter(
        FertilizerApplication.id == aid,
        Indoor.user_id == user.id,
    ).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    db.delete(app)
    db.commit()
    return None
