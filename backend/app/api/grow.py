"""
Grow router: cultivation stages, EC/pH targets, measurements and checklist tasks.
"""
from datetime import datetime, date
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Indoor, StageTarget, Measurement, Task
from app.schemas import (
    StageInfo,
    StageTargetItem,
    StageTargetsUpdate,
    MeasurementCreate,
    MeasurementItem,
    TaskCreate,
    TaskUpdate,
    TaskItem,
)
from app.api import get_current_user
from app.stages import STAGES, STAGE_KEYS
from app.timeutils import now

router = APIRouter(prefix="/api", tags=["grow"])


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


# ============ STAGES ============

@router.get("/stages", response_model=list[StageInfo])
async def list_stages():
    """List the cultivation stages (key + label)."""
    return [StageInfo(key=key, label=label) for key, label in STAGES]


# ============ STAGE TARGETS ============

def _target_item(target: StageTarget) -> StageTargetItem:
    return StageTargetItem(
        stage=target.stage,
        ec_min=float(target.ec_min) if target.ec_min is not None else None,
        ec_max=float(target.ec_max) if target.ec_max is not None else None,
        ph_min=float(target.ph_min) if target.ph_min is not None else None,
        ph_max=float(target.ph_max) if target.ph_max is not None else None,
        temp_min=float(target.temp_min) if target.temp_min is not None else None,
        temp_max=float(target.temp_max) if target.temp_max is not None else None,
        humidity_min=float(target.humidity_min) if target.humidity_min is not None else None,
        humidity_max=float(target.humidity_max) if target.humidity_max is not None else None,
        light_height_min=float(target.light_height_min) if target.light_height_min is not None else None,
        light_height_max=float(target.light_height_max) if target.light_height_max is not None else None,
        ppfd_min=target.ppfd_min,
        ppfd_max=target.ppfd_max,
        light_schedule=target.light_schedule,
        notes=target.notes,
    )


@router.get("/indoors/{indoor_id}/stage-targets", response_model=list[StageTargetItem])
async def get_stage_targets(
    indoor_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get EC/pH targets per stage for an indoor."""
    indoor = _get_indoor(db, user, indoor_id)
    targets = db.query(StageTarget).filter(StageTarget.indoor_id == indoor.id).all()
    by_stage = {t.stage: t for t in targets}
    # Return in canonical stage order
    return [_target_item(by_stage[key]) for key in STAGE_KEYS if key in by_stage]


@router.put("/indoors/{indoor_id}/stage-targets", response_model=list[StageTargetItem])
async def update_stage_targets(
    indoor_id: str,
    body: StageTargetsUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Upsert EC/pH targets per stage for an indoor."""
    indoor = _get_indoor(db, user, indoor_id)

    for item in body.targets:
        if item.stage not in STAGE_KEYS:
            raise HTTPException(status_code=400, detail=f"Invalid stage: {item.stage}")
        target = db.query(StageTarget).filter(
            StageTarget.indoor_id == indoor.id,
            StageTarget.stage == item.stage,
        ).first()
        if not target:
            target = StageTarget(indoor_id=indoor.id, stage=item.stage)
            db.add(target)

        target.ec_min = Decimal(str(item.ec_min)) if item.ec_min is not None else None
        target.ec_max = Decimal(str(item.ec_max)) if item.ec_max is not None else None
        target.ph_min = Decimal(str(item.ph_min)) if item.ph_min is not None else None
        target.ph_max = Decimal(str(item.ph_max)) if item.ph_max is not None else None
        target.temp_min = Decimal(str(item.temp_min)) if item.temp_min is not None else None
        target.temp_max = Decimal(str(item.temp_max)) if item.temp_max is not None else None
        target.humidity_min = Decimal(str(item.humidity_min)) if item.humidity_min is not None else None
        target.humidity_max = Decimal(str(item.humidity_max)) if item.humidity_max is not None else None
        target.light_height_min = Decimal(str(item.light_height_min)) if item.light_height_min is not None else None
        target.light_height_max = Decimal(str(item.light_height_max)) if item.light_height_max is not None else None
        target.ppfd_min = item.ppfd_min
        target.ppfd_max = item.ppfd_max
        target.light_schedule = item.light_schedule
        target.notes = item.notes

    db.commit()

    targets = db.query(StageTarget).filter(StageTarget.indoor_id == indoor.id).all()
    by_stage = {t.stage: t for t in targets}
    return [_target_item(by_stage[key]) for key in STAGE_KEYS if key in by_stage]


# ============ MEASUREMENTS ============

def _measurement_item(m: Measurement) -> MeasurementItem:
    return MeasurementItem(
        id=m.id,
        event_ts=m.event_ts,
        temp_c=float(m.temp_c) if m.temp_c is not None else None,
        humidity=float(m.humidity) if m.humidity is not None else None,
        ph=float(m.ph) if m.ph is not None else None,
        ec=float(m.ec) if m.ec is not None else None,
        runoff_ec=float(m.runoff_ec) if m.runoff_ec is not None else None,
        ppfd=m.ppfd,
        note=m.note,
    )


@router.get("/indoors/{indoor_id}/measurements", response_model=list[MeasurementItem])
async def list_measurements(
    indoor_id: str,
    limit: int = 100,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List environment measurements for an indoor (most recent first)."""
    indoor = _get_indoor(db, user, indoor_id)
    rows = db.query(Measurement).filter(
        Measurement.indoor_id == indoor.id
    ).order_by(Measurement.event_ts.desc()).limit(limit).all()
    return [_measurement_item(m) for m in rows]


@router.post("/indoors/{indoor_id}/measurements", response_model=MeasurementItem, status_code=201)
async def create_measurement(
    indoor_id: str,
    body: MeasurementCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Register an environment measurement for an indoor."""
    indoor = _get_indoor(db, user, indoor_id)

    measurement = Measurement(
        indoor_id=indoor.id,
        event_ts=body.event_ts or now(),
        temp_c=Decimal(str(body.temp_c)) if body.temp_c is not None else None,
        humidity=Decimal(str(body.humidity)) if body.humidity is not None else None,
        ph=Decimal(str(body.ph)) if body.ph is not None else None,
        ec=Decimal(str(body.ec)) if body.ec is not None else None,
        runoff_ec=Decimal(str(body.runoff_ec)) if body.runoff_ec is not None else None,
        ppfd=body.ppfd,
        note=body.note,
    )
    db.add(measurement)
    db.commit()
    db.refresh(measurement)
    return _measurement_item(measurement)


@router.delete("/measurements/{measurement_id}", status_code=204)
async def delete_measurement(
    measurement_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete a measurement."""
    try:
        measurement_uuid = UUID(measurement_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid measurement_id format")

    measurement = db.query(Measurement).join(Indoor).filter(
        Measurement.id == measurement_uuid,
        Indoor.user_id == user.id,
    ).first()
    if not measurement:
        raise HTTPException(status_code=404, detail="Measurement not found")

    db.delete(measurement)
    db.commit()
    return None


# ============ TASKS / CHECKLIST ============

def _task_item(task: Task) -> TaskItem:
    return TaskItem(
        id=task.id,
        title=task.title,
        description=task.description,
        frequency=task.frequency,
        stage=task.stage,
        is_done=task.is_done,
        due_at=task.due_at,
        completed_at=task.completed_at,
    )


@router.get("/indoors/{indoor_id}/tasks", response_model=list[TaskItem])
async def list_tasks(
    indoor_id: str,
    stage: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List checklist tasks for an indoor. Optionally filter by stage."""
    indoor = _get_indoor(db, user, indoor_id)
    query = db.query(Task).filter(Task.indoor_id == indoor.id)
    if stage is not None:
        query = query.filter((Task.stage == stage) | (Task.stage.is_(None)))
    tasks = query.order_by(Task.is_done, Task.created_at).all()
    return [_task_item(t) for t in tasks]


@router.post("/indoors/{indoor_id}/tasks", response_model=TaskItem, status_code=201)
async def create_task(
    indoor_id: str,
    body: TaskCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a checklist task for an indoor."""
    indoor = _get_indoor(db, user, indoor_id)

    if body.stage is not None and body.stage not in STAGE_KEYS:
        raise HTTPException(status_code=400, detail="Invalid stage")

    task = Task(
        indoor_id=indoor.id,
        title=body.title,
        description=body.description,
        frequency=body.frequency,
        stage=body.stage,
        due_at=body.due_at,
        is_done=False,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return _task_item(task)


@router.patch("/tasks/{task_id}", response_model=TaskItem)
async def update_task(
    task_id: str,
    body: TaskUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update a checklist task (e.g. mark as done)."""
    try:
        task_uuid = UUID(task_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid task_id format")

    task = db.query(Task).join(Indoor).filter(
        Task.id == task_uuid,
        Indoor.user_id == user.id,
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    updates = body.model_dump(exclude_unset=True)
    if "stage" in updates and updates["stage"] is not None and updates["stage"] not in STAGE_KEYS:
        raise HTTPException(status_code=400, detail="Invalid stage")

    for field, value in updates.items():
        setattr(task, field, value)

    if "is_done" in updates:
        task.completed_at = now() if updates["is_done"] else None

    db.commit()
    db.refresh(task)
    return _task_item(task)


@router.delete("/tasks/{task_id}", status_code=204)
async def delete_task(
    task_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete a checklist task."""
    try:
        task_uuid = UUID(task_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid task_id format")

    task = db.query(Task).join(Indoor).filter(
        Task.id == task_uuid,
        Indoor.user_id == user.id,
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    db.delete(task)
    db.commit()
    return None
