"""
Alerts router: alert rules, triggered alerts and the watering plan.
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Indoor, AlertRule, Alert, WateringPlan
from app.schemas import (
    AlertItem,
    AlertUpdate,
    AlertRuleCreate,
    AlertRuleUpdate,
    AlertRuleItem,
    WateringPlanItem,
    WateringPlanUpdate,
)
from app.api import get_current_user
from app.services import alert_service

router = APIRouter(prefix="/api", tags=["alerts"])

VALID_KINDS = {"temp_out_of_range", "humidity_below", "watering_overdue"}
VALID_MODES = {"interval_days", "times_per_day"}
VALID_UNITS = {"L", "ml"}


def _get_indoor(db: Session, user: User, indoor_id: str) -> Indoor:
    try:
        uid = UUID(indoor_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid indoor_id format")
    indoor = db.query(Indoor).filter(Indoor.id == uid, Indoor.user_id == user.id).first()
    if not indoor:
        raise HTTPException(status_code=404, detail="Indoor not found")
    return indoor


# ============ ALERTS ============

@router.get("/indoors/{indoor_id}/alerts", response_model=list[AlertItem])
async def list_alerts(
    indoor_id: str,
    include_resolved: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Evaluate rules and return the alerts (active by default)."""
    indoor = _get_indoor(db, user, indoor_id)
    alert_service.evaluate_indoor(db, indoor)
    query = db.query(Alert).filter(Alert.indoor_id == indoor.id)
    if not include_resolved:
        query = query.filter(Alert.resolved_at.is_(None))
    return query.order_by(Alert.triggered_at.desc()).limit(100).all()


@router.patch("/alerts/{alert_id}", response_model=AlertItem)
async def update_alert(
    alert_id: str,
    body: AlertUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        aid = UUID(alert_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid alert_id format")
    alert = (
        db.query(Alert)
        .join(Indoor)
        .filter(Alert.id == aid, Indoor.user_id == user.id)
        .first()
    )
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    if body.acknowledged is not None:
        alert.acknowledged = body.acknowledged
    db.commit()
    db.refresh(alert)
    return alert


@router.delete("/alerts/{alert_id}", status_code=204)
async def delete_alert(
    alert_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        aid = UUID(alert_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid alert_id format")
    alert = (
        db.query(Alert)
        .join(Indoor)
        .filter(Alert.id == aid, Indoor.user_id == user.id)
        .first()
    )
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    db.delete(alert)
    db.commit()
    return None


# ============ ALERT RULES ============

@router.get("/indoors/{indoor_id}/alert-rules", response_model=list[AlertRuleItem])
async def list_alert_rules(
    indoor_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    indoor = _get_indoor(db, user, indoor_id)
    return (
        db.query(AlertRule)
        .filter(AlertRule.indoor_id == indoor.id)
        .order_by(AlertRule.created_at.asc())
        .all()
    )


@router.post("/indoors/{indoor_id}/alert-rules", response_model=AlertRuleItem, status_code=201)
async def create_alert_rule(
    indoor_id: str,
    body: AlertRuleCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    indoor = _get_indoor(db, user, indoor_id)
    if body.kind not in VALID_KINDS:
        raise HTTPException(status_code=400, detail="Invalid kind")
    rule = AlertRule(
        indoor_id=indoor.id,
        kind=body.kind,
        enabled=body.enabled,
        min_value=body.min_value,
        max_value=body.max_value,
        duration_minutes=body.duration_minutes,
        tolerance_days=body.tolerance_days,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.patch("/alert-rules/{rule_id}", response_model=AlertRuleItem)
async def update_alert_rule(
    rule_id: str,
    body: AlertRuleUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        rid = UUID(rule_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid rule_id format")
    rule = (
        db.query(AlertRule)
        .join(Indoor)
        .filter(AlertRule.id == rid, Indoor.user_id == user.id)
        .first()
    )
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    updates = body.model_dump(exclude_unset=True)
    if "kind" in updates and updates["kind"] not in VALID_KINDS:
        raise HTTPException(status_code=400, detail="Invalid kind")
    for field, value in updates.items():
        setattr(rule, field, value)
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/alert-rules/{rule_id}", status_code=204)
async def delete_alert_rule(
    rule_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        rid = UUID(rule_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid rule_id format")
    rule = (
        db.query(AlertRule)
        .join(Indoor)
        .filter(AlertRule.id == rid, Indoor.user_id == user.id)
        .first()
    )
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    db.delete(rule)
    db.commit()
    return None


# ============ WATERING PLAN ============

def _plan_item(plan: WateringPlan) -> WateringPlanItem:
    return WateringPlanItem(
        indoor_id=plan.indoor_id,
        enabled=plan.enabled,
        mode=plan.mode,
        interval_days=plan.interval_days,
        times_per_day=plan.times_per_day,
        amount=float(plan.amount) if plan.amount is not None else None,
        unit=plan.unit,
    )


@router.get("/indoors/{indoor_id}/watering-plan", response_model=WateringPlanItem)
async def get_watering_plan(
    indoor_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    indoor = _get_indoor(db, user, indoor_id)
    plan = db.query(WateringPlan).filter(WateringPlan.indoor_id == indoor.id).first()
    if not plan:
        return WateringPlanItem(indoor_id=indoor.id, enabled=False, mode="interval_days")
    return _plan_item(plan)


@router.put("/indoors/{indoor_id}/watering-plan", response_model=WateringPlanItem)
async def update_watering_plan(
    indoor_id: str,
    body: WateringPlanUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    indoor = _get_indoor(db, user, indoor_id)
    plan = db.query(WateringPlan).filter(WateringPlan.indoor_id == indoor.id).first()
    if not plan:
        plan = WateringPlan(indoor_id=indoor.id)
        db.add(plan)
    updates = body.model_dump(exclude_unset=True)
    if "mode" in updates and updates["mode"] not in VALID_MODES:
        raise HTTPException(status_code=400, detail="Invalid mode")
    if "unit" in updates and updates["unit"] not in VALID_UNITS:
        raise HTTPException(status_code=400, detail="Invalid unit")
    for field, value in updates.items():
        setattr(plan, field, value)
    db.commit()
    db.refresh(plan)
    return _plan_item(plan)
