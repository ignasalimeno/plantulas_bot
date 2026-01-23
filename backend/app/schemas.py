"""
Pydantic schemas for API responses
"""
from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel
from uuid import UUID


# ============ DASHBOARD ============

class PlantUpcomingItem(BaseModel):
    plant_id: UUID
    name: str
    next_water_at: Optional[date]
    due_in_days: Optional[int]
    status: str  # "OVERDUE" | "DUE_SOON" | "OK"

    class Config:
        from_attributes = True


class DashboardResponse(BaseModel):
    indoors_total: int
    plants_total: int
    need_water_count: int
    upcoming: List[PlantUpcomingItem]

    class Config:
        from_attributes = True


# ============ INDOORS ============

class IndoorListItem(BaseModel):
    id: UUID
    name: str
    plants_count: int

    class Config:
        from_attributes = True


class IndoorHistoryItem(BaseModel):
    event_ts: datetime
    message: str

    class Config:
        from_attributes = True


class PlantInIndoor(BaseModel):
    id: UUID
    name: str
    species: Optional[str]
    last_watered_at: Optional[date]
    next_water_at: Optional[date]
    watering_interval_days: int
    days_since_planted: Optional[int]

    class Config:
        from_attributes = True


class IndoorDetail(BaseModel):
    id: UUID
    name: str
    temp_c: Optional[float]
    humidity: Optional[float]
    fan_location: Optional[str]
    extractor_top: bool
    extractor_bottom: bool
    fan: bool
    light_height_cm: Optional[float]
    light_power_pct: Optional[int]
    light_schedule: Optional[str]

    class Config:
        from_attributes = True


class IndoorDetailResponse(BaseModel):
    indoor: IndoorDetail
    plants: List[PlantInIndoor]
    history: List[IndoorHistoryItem]

    class Config:
        from_attributes = True


class IndoorCreateRequest(BaseModel):
    name: str
    temp_c: Optional[float] = None
    humidity: Optional[float] = None
    fan_location: Optional[str] = None
    extractor_top: Optional[bool] = False
    extractor_bottom: Optional[bool] = False
    fan: Optional[bool] = False
    light_height_cm: Optional[float] = None
    light_power_pct: Optional[int] = None
    light_schedule: Optional[str] = None

    class Config:
        from_attributes = True


class IndoorUpdateRequest(BaseModel):
    temp_c: Optional[float] = None
    humidity: Optional[float] = None
    fan_location: Optional[str] = None
    extractor_top: Optional[bool] = None
    extractor_bottom: Optional[bool] = None
    fan: Optional[bool] = None
    light_height_cm: Optional[float] = None
    light_power_pct: Optional[int] = None
    light_schedule: Optional[str] = None

    class Config:
        from_attributes = True


# ============ PLANTS ============

class FertilizerItem(BaseModel):
    name: str
    amount: str


class WateringHistoryItem(BaseModel):
    id: UUID
    event_ts: datetime
    liters: float
    note: Optional[str]
    ferts: Optional[dict]

    class Config:
        from_attributes = True


class PlantWaterRequest(BaseModel):
    liters: float
    date: Optional[date] = None
    note: Optional[str] = None
    ferts: Optional[List[FertilizerItem]] = None


class PlantResponse(BaseModel):
    id: UUID
    name: str
    species: Optional[str]
    last_watered_at: Optional[date]
    next_water_at: Optional[date]
    watering_interval_days: int
    default_liters: float

    class Config:
        from_attributes = True


class WaterResponseData(BaseModel):
    plant: PlantResponse
    watering_history: WateringHistoryItem

    class Config:
        from_attributes = True


class PlantCreateRequest(BaseModel):
    name: str
    species: Optional[str] = None
    indoor_id: Optional[UUID] = None
    planted_at: Optional[date] = None
    watering_interval_days: int = 7
    default_liters: float = 1.0
    notes: Optional[str] = None

    class Config:
        from_attributes = True
