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
    id: UUID
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
    planted_at: Optional[date] = None
    default_liters: float = 1.0
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class CurrentReading(BaseModel):
    value: Optional[float] = None
    at: Optional[datetime] = None
    source: Optional[str] = None


class CurrentEnvironment(BaseModel):
    temp_c: CurrentReading
    humidity: CurrentReading
    ec: CurrentReading
    ph: CurrentReading
    runoff_ec: CurrentReading
    ppfd: CurrentReading
    light_height_cm: Optional[float] = None
    light_power_pct: Optional[int] = None
    light_schedule: Optional[str] = None


class IndoorDetail(BaseModel):
    id: UUID
    name: str
    temp_c: Optional[float]
    humidity: Optional[float]
    fan_location: Optional[str]
    extractor_top: bool
    extractor_bottom: bool
    fan: bool
    humidifier: bool
    humidifier_mode: str
    humidifier_on_below_humidity: Optional[float]
    humidifier_off_above_humidity: Optional[float]
    humidifier_on_above_temp: Optional[float]
    humidifier_off_below_temp: Optional[float]
    ac: bool
    ac_mode: str
    ac_on_above_temp: Optional[float]
    ac_off_below_temp: Optional[float]
    ac_hvac_mode: Optional[str]
    light_height_cm: Optional[float]
    light_power_pct: Optional[int]
    light_schedule: Optional[str]
    stage: str
    stage_started_at: Optional[date]
    current_environment: Optional[CurrentEnvironment] = None

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
    humidifier: Optional[bool] = False
    humidifier_mode: Optional[str] = None
    humidifier_on_below_humidity: Optional[float] = None
    humidifier_off_above_humidity: Optional[float] = None
    humidifier_on_above_temp: Optional[float] = None
    humidifier_off_below_temp: Optional[float] = None
    ac: Optional[bool] = False
    ac_mode: Optional[str] = None
    ac_on_above_temp: Optional[float] = None
    ac_off_below_temp: Optional[float] = None
    ac_hvac_mode: Optional[str] = None
    light_height_cm: Optional[float] = None
    light_power_pct: Optional[int] = None
    light_schedule: Optional[str] = None
    stage: Optional[str] = None
    stage_started_at: Optional[date] = None

    class Config:
        from_attributes = True


class IndoorUpdateRequest(BaseModel):
    temp_c: Optional[float] = None
    humidity: Optional[float] = None
    fan_location: Optional[str] = None
    extractor_top: Optional[bool] = None
    extractor_bottom: Optional[bool] = None
    fan: Optional[bool] = None
    humidifier: Optional[bool] = None
    humidifier_mode: Optional[str] = None
    humidifier_on_below_humidity: Optional[float] = None
    humidifier_off_above_humidity: Optional[float] = None
    humidifier_on_above_temp: Optional[float] = None
    humidifier_off_below_temp: Optional[float] = None
    ac: Optional[bool] = None
    ac_mode: Optional[str] = None
    ac_on_above_temp: Optional[float] = None
    ac_off_below_temp: Optional[float] = None
    ac_hvac_mode: Optional[str] = None
    light_height_cm: Optional[float] = None
    light_power_pct: Optional[int] = None
    light_schedule: Optional[str] = None
    stage: Optional[str] = None
    stage_started_at: Optional[date] = None

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
    ec: Optional[float] = None
    ph: Optional[float] = None
    runoff_ec: Optional[float] = None

    class Config:
        from_attributes = True


class PlantWaterRequest(BaseModel):
    liters: float
    date: Optional[date] = None
    note: Optional[str] = None
    ferts: Optional[List[FertilizerItem]] = None
    ec: Optional[float] = None
    ph: Optional[float] = None
    runoff_ec: Optional[float] = None


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


class PlantUpdateRequest(BaseModel):
    name: Optional[str] = None
    species: Optional[str] = None
    indoor_id: Optional[UUID] = None
    planted_at: Optional[date] = None
    watering_interval_days: Optional[int] = None
    default_liters: Optional[float] = None
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class PlantDetailResponse(BaseModel):
    id: UUID
    name: str
    species: Optional[str]
    indoor_id: Optional[UUID]
    indoor_name: Optional[str]
    planted_at: Optional[date]
    notes: Optional[str]
    watering_interval_days: int
    default_liters: float
    last_watered_at: Optional[date]
    next_water_at: Optional[date]

    class Config:
        from_attributes = True


class PlantHistoryResponse(BaseModel):
    plant: PlantDetailResponse
    history: List[WateringHistoryItem]

    class Config:
        from_attributes = True


# ============ GROW STAGES / TARGETS ============

class StageInfo(BaseModel):
    key: str
    label: str


class StageTargetItem(BaseModel):
    stage: str
    ec_min: Optional[float] = None
    ec_max: Optional[float] = None
    ph_min: Optional[float] = None
    ph_max: Optional[float] = None
    temp_min: Optional[float] = None
    temp_max: Optional[float] = None
    humidity_min: Optional[float] = None
    humidity_max: Optional[float] = None
    light_height_min: Optional[float] = None
    light_height_max: Optional[float] = None
    ppfd_min: Optional[int] = None
    ppfd_max: Optional[int] = None
    light_schedule: Optional[str] = None
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class StageTargetsUpdate(BaseModel):
    targets: List[StageTargetItem]


# ============ MEASUREMENTS ============

class MeasurementCreate(BaseModel):
    event_ts: Optional[datetime] = None
    temp_c: Optional[float] = None
    humidity: Optional[float] = None
    ph: Optional[float] = None
    ec: Optional[float] = None
    runoff_ec: Optional[float] = None
    ppfd: Optional[int] = None
    note: Optional[str] = None


class MeasurementItem(BaseModel):
    id: UUID
    event_ts: datetime
    temp_c: Optional[float]
    humidity: Optional[float]
    ph: Optional[float]
    ec: Optional[float]
    runoff_ec: Optional[float]
    ppfd: Optional[int]
    note: Optional[str]

    class Config:
        from_attributes = True


# ============ TASKS / CHECKLIST ============

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    frequency: Optional[str] = None
    stage: Optional[str] = None
    due_at: Optional[date] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    frequency: Optional[str] = None
    stage: Optional[str] = None
    is_done: Optional[bool] = None
    due_at: Optional[date] = None


class TaskItem(BaseModel):
    id: UUID
    title: str
    description: Optional[str]
    frequency: Optional[str]
    stage: Optional[str]
    is_done: bool
    due_at: Optional[date]
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


# ============ FERTILIZERS ============

class FertilizerCreate(BaseModel):
    name: str
    kind: Optional[str] = None
    unit: Optional[str] = None
    default_amount: Optional[float] = None
    notes: Optional[str] = None


class FertilizerUpdate(BaseModel):
    name: Optional[str] = None
    kind: Optional[str] = None
    unit: Optional[str] = None
    default_amount: Optional[float] = None
    notes: Optional[str] = None


class FertilizerItem(BaseModel):
    id: UUID
    name: str
    kind: Optional[str]
    unit: Optional[str]
    default_amount: Optional[float]
    notes: Optional[str]

    class Config:
        from_attributes = True


class PlanItemInput(BaseModel):
    fertilizer_id: UUID
    frequency: Optional[str] = None
    stage: Optional[str] = None
    active: bool = True


class PlanUpdate(BaseModel):
    items: List[PlanItemInput]


class PlanItemResponse(BaseModel):
    id: UUID
    fertilizer_id: UUID
    fertilizer_name: str
    kind: Optional[str]
    unit: Optional[str]
    default_amount: Optional[float]
    frequency: Optional[str]
    stage: Optional[str]
    active: bool
    last_applied_at: Optional[datetime] = None


class ApplicationCreate(BaseModel):
    fertilizer_id: UUID
    amount: Optional[float] = None
    note: Optional[str] = None
    applied_at: Optional[datetime] = None


class ApplicationItem(BaseModel):
    id: UUID
    fertilizer_id: UUID
    fertilizer_name: str
    applied_at: datetime
    amount: Optional[float]
    note: Optional[str]


# ============ INDOOR WATERING ============

class IndoorWaterFertilizer(BaseModel):
    fertilizer_id: UUID
    amount: Optional[float] = None


class IndoorWaterRequest(BaseModel):
    liters: float
    date: Optional[date] = None
    note: Optional[str] = None
    ec: Optional[float] = None
    ph: Optional[float] = None
    runoff_ec: Optional[float] = None
    plant_ids: Optional[List[UUID]] = None
    fertilizers: Optional[List[IndoorWaterFertilizer]] = None


class IndoorWaterResponse(BaseModel):
    plants_watered: int
    liters: float
    plant_names: List[str]
    applications_created: int


class IndoorWateringItem(BaseModel):
    id: UUID
    plant_id: UUID
    plant_name: str
    event_ts: datetime
    liters: float
    note: Optional[str]
    ferts: Optional[dict]
    ec: Optional[float] = None
    ph: Optional[float] = None
    runoff_ec: Optional[float] = None


class IndoorWateringEventPlant(BaseModel):
    id: UUID
    name: str


class IndoorWateringEvent(BaseModel):
    group_id: UUID
    event_ts: datetime
    liters: float
    ec: Optional[float] = None
    ph: Optional[float] = None
    runoff_ec: Optional[float] = None
    note: Optional[str] = None
    plants: List[IndoorWateringEventPlant]


class IndoorWateringUpdate(BaseModel):
    liters: Optional[float] = None
    ec: Optional[float] = None
    ph: Optional[float] = None
    runoff_ec: Optional[float] = None
    note: Optional[str] = None
    date: Optional[date] = None
    plant_ids: Optional[List[UUID]] = None


class IndoorHistoryCreate(BaseModel):
    message: str
    event_ts: Optional[datetime] = None


# ============ CHAT ============

class ChatRequest(BaseModel):
    message: str


class ChatConfirmRequest(BaseModel):
    approve: bool


class ChatMessageItem(BaseModel):
    id: UUID
    role: str
    content: str
    pending_action: Optional[dict] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ChatResponse(BaseModel):
    reply: str
    pending_action: Optional[dict] = None


# ============ DEVICES (Raspberry Pi / bridges) ============

class DeviceHaEntities(BaseModel):
    temp: Optional[str] = None
    humidity: Optional[str] = None
    humidifier: Optional[str] = None
    ac: Optional[str] = None


class DeviceCreate(BaseModel):
    name: str
    ha_entities: Optional[DeviceHaEntities] = None


class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    ha_entities: Optional[DeviceHaEntities] = None
    active: Optional[bool] = None


class DeviceItem(BaseModel):
    id: UUID
    indoor_id: UUID
    name: str
    ha_entities: Optional[dict] = None
    reported_state: Optional[dict] = None
    last_seen: Optional[datetime] = None
    active: bool

    class Config:
        from_attributes = True


class DeviceCreateResponse(BaseModel):
    device: DeviceItem
    token: str


class TelemetryRequest(BaseModel):
    temp_c: Optional[float] = None
    humidity: Optional[float] = None
    ppfd: Optional[int] = None
    ec: Optional[float] = None
    ph: Optional[float] = None
    runoff_ec: Optional[float] = None
    note: Optional[str] = None


class DeviceCommands(BaseModel):
    indoor_id: UUID
    humidifier: bool
    ac: bool
    ac_hvac_mode: Optional[str] = None
    humidifier_mode: str
    ac_mode: str


class DeviceStateRequest(BaseModel):
    humidifier: Optional[bool] = None
    ac: Optional[bool] = None
