"""
Dashboard router
"""
from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, Plant
from app.schemas import DashboardResponse, PlantUpcomingItem
from app.api import get_current_user

router = APIRouter(prefix="/api", tags=["dashboard"])


@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Get dashboard summary: indoors count, plants count, plants needing water.
    """
    today = date.today()
    
    # Count indoors and plants
    indoors_total = len(user.indoors)
    plants_total = len(user.plants)
    
    # Find plants needing water (next_water_at <= today)
    need_water_count = sum(
        1 for plant in user.plants
        if plant.next_water_at and plant.next_water_at <= today
    )
    
    # Build upcoming list (sorted by next_water_at)
    upcoming = []
    for plant in user.plants:
        if plant.next_water_at is None:
            continue
        
        due_in_days = (plant.next_water_at - today).days
        
        if plant.next_water_at < today:
            status = "OVERDUE"
        elif 0 <= due_in_days <= 2:
            status = "DUE_SOON"
        else:
            status = "OK"
        
        upcoming.append(PlantUpcomingItem(
            plant_id=plant.id,
            name=plant.name,
            next_water_at=plant.next_water_at,
            due_in_days=due_in_days,
            status=status
        ))
    
    # Sort by next_water_at ascending
    upcoming.sort(key=lambda x: x.next_water_at or date.max)
    
    return DashboardResponse(
        indoors_total=indoors_total,
        plants_total=plants_total,
        need_water_count=need_water_count,
        upcoming=upcoming
    )
