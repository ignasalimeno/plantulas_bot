import uuid
from datetime import datetime, date
from sqlalchemy import (
    Column, String, BigInteger, DateTime, Date, Integer, Numeric, Boolean,
    Text, ForeignKey, Index
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class User(Base):
    """User identified by Telegram user ID"""
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    telegram_user_id = Column(BigInteger, unique=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    indoors = relationship("Indoor", back_populates="user", cascade="all, delete-orphan")
    plants = relationship("Plant", back_populates="user", cascade="all, delete-orphan")
    fertilizers = relationship("Fertilizer", back_populates="user", cascade="all, delete-orphan")
    chat_messages = relationship("ChatMessage", back_populates="user", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User(id={self.id}, telegram_user_id={self.telegram_user_id})>"


class Indoor(Base):
    """Indoor growing environment"""
    __tablename__ = "indoors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(Text, nullable=False)
    
    # Environmental parameters
    temp_c = Column(Numeric(5, 2))  # Temperature in Celsius
    humidity = Column(Numeric(5, 2))  # Humidity percentage
    
    # Ventilation
    fan_location = Column(Text)
    extractor_top = Column(Boolean, default=False)
    extractor_bottom = Column(Boolean, default=False)
    fan = Column(Boolean, default=False)
    humidifier = Column(Boolean, default=False)
    humidifier_mode = Column(Text, nullable=False, server_default="auto")  # auto | manual | off
    # Humidifier thresholds
    humidifier_on_below_humidity = Column(Numeric(5, 2))  # turn ON if humidity below
    humidifier_off_above_humidity = Column(Numeric(5, 2))  # turn OFF if humidity above
    humidifier_on_above_temp = Column(Numeric(5, 2))  # turn ON if temp above (cooling)
    humidifier_off_below_temp = Column(Numeric(5, 2))  # turn OFF if temp below
    # Air conditioner (controlled via IR)
    ac = Column(Boolean, default=False)
    ac_mode = Column(Text, nullable=False, server_default="auto")  # auto | manual | off
    ac_on_above_temp = Column(Numeric(5, 2))
    ac_off_below_temp = Column(Numeric(5, 2))
    ac_hvac_mode = Column(Text, server_default="cool")  # cool | heat | fan | dry
    
    # Lighting
    light_height_cm = Column(Numeric(6, 2))
    light_power_pct = Column(Integer)  # 0-100
    light_schedule = Column(Text)  # e.g., "18/6", "20/4"

    # Grow stage
    stage = Column(Text, nullable=False, server_default="seedling")
    stage_started_at = Column(Date)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    user = relationship("User", back_populates="indoors")
    plants = relationship("Plant", back_populates="indoor", cascade="all, delete-orphan")
    history = relationship("IndoorHistory", back_populates="indoor", cascade="all, delete-orphan")
    stage_targets = relationship("StageTarget", back_populates="indoor", cascade="all, delete-orphan")
    measurements = relationship("Measurement", back_populates="indoor", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="indoor", cascade="all, delete-orphan")
    fertilizer_plan = relationship("IndoorFertilizerPlan", back_populates="indoor", cascade="all, delete-orphan")
    fertilizer_applications = relationship("FertilizerApplication", back_populates="indoor", cascade="all, delete-orphan")
    devices = relationship("Device", back_populates="indoor", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Indoor(id={self.id}, name={self.name})>"


class IndoorHistory(Base):
    """History of events for indoor environments"""
    __tablename__ = "indoor_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    indoor_id = Column(UUID(as_uuid=True), ForeignKey("indoors.id", ondelete="CASCADE"), nullable=False, index=True)
    event_ts = Column(DateTime(timezone=True), nullable=False, index=True)
    message = Column(Text, nullable=False)
    payload = Column(JSONB)  # Optional extra data

    # Relationships
    indoor = relationship("Indoor", back_populates="history")

    def __repr__(self):
        return f"<IndoorHistory(id={self.id}, indoor_id={self.indoor_id}, event_ts={self.event_ts})>"


class Plant(Base):
    """Plant being grown"""
    __tablename__ = "plants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    indoor_id = Column(UUID(as_uuid=True), ForeignKey("indoors.id", ondelete="SET NULL"), index=True)
    
    # Plant info
    name = Column(Text, nullable=False)
    species = Column(Text)
    planted_at = Column(Date)
    notes = Column(Text)
    
    # Watering
    watering_interval_days = Column(Integer, nullable=False, default=7)
    default_liters = Column(Numeric(6, 3), nullable=False, default=1.0)
    last_watered_at = Column(Date)
    next_water_at = Column(Date)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    user = relationship("User", back_populates="plants")
    indoor = relationship("Indoor", back_populates="plants")
    watering_history = relationship("WateringHistory", back_populates="plant", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Plant(id={self.id}, name={self.name}, species={self.species})>"


class WateringHistory(Base):
    """History of watering events"""
    __tablename__ = "watering_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    plant_id = Column(UUID(as_uuid=True), ForeignKey("plants.id", ondelete="CASCADE"), nullable=False, index=True)
    event_ts = Column(DateTime(timezone=True), nullable=False, index=True)
    liters = Column(Numeric(6, 3), nullable=False)
    note = Column(Text)
    ferts = Column(JSONB)  # Optional fertilizer data
    ec = Column(Numeric(4, 2))  # EC of the feed solution (mS/cm)
    ph = Column(Numeric(4, 2))  # pH of the feed solution
    runoff_ec = Column(Numeric(4, 2))  # EC of the runoff

    # Relationships
    plant = relationship("Plant", back_populates="watering_history")

    def __repr__(self):
        return f"<WateringHistory(id={self.id}, plant_id={self.plant_id}, liters={self.liters})>"


class StageTarget(Base):
    """Per-indoor EC/pH target for a given cultivation stage."""
    __tablename__ = "stage_targets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    indoor_id = Column(UUID(as_uuid=True), ForeignKey("indoors.id", ondelete="CASCADE"), nullable=False, index=True)
    stage = Column(Text, nullable=False)
    ec_min = Column(Numeric(4, 2))
    ec_max = Column(Numeric(4, 2))
    ph_min = Column(Numeric(4, 2))
    ph_max = Column(Numeric(4, 2))
    temp_min = Column(Numeric(5, 2))
    temp_max = Column(Numeric(5, 2))
    humidity_min = Column(Numeric(5, 2))
    humidity_max = Column(Numeric(5, 2))
    light_height_min = Column(Numeric(6, 2))
    light_height_max = Column(Numeric(6, 2))
    ppfd_min = Column(Integer)
    ppfd_max = Column(Integer)
    light_schedule = Column(Text)
    notes = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    indoor = relationship("Indoor", back_populates="stage_targets")

    __table_args__ = (
        Index("uq_stage_targets_indoor_stage", "indoor_id", "stage", unique=True),
    )

    def __repr__(self):
        return f"<StageTarget(indoor_id={self.indoor_id}, stage={self.stage})>"


class Measurement(Base):
    """A timestamped environment reading for an indoor."""
    __tablename__ = "measurements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    indoor_id = Column(UUID(as_uuid=True), ForeignKey("indoors.id", ondelete="CASCADE"), nullable=False, index=True)
    event_ts = Column(DateTime(timezone=True), nullable=False, index=True)
    temp_c = Column(Numeric(5, 2))
    humidity = Column(Numeric(5, 2))
    ph = Column(Numeric(4, 2))
    ec = Column(Numeric(4, 2))
    runoff_ec = Column(Numeric(4, 2))
    ppfd = Column(Integer)
    note = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    indoor = relationship("Indoor", back_populates="measurements")

    def __repr__(self):
        return f"<Measurement(id={self.id}, indoor_id={self.indoor_id}, event_ts={self.event_ts})>"


class Task(Base):
    """A checklist task for an indoor, optionally tied to a stage."""
    __tablename__ = "tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    indoor_id = Column(UUID(as_uuid=True), ForeignKey("indoors.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(Text, nullable=False)
    description = Column(Text)
    frequency = Column(Text)  # e.g. "daily", "weekly", "every_2_3_days"
    stage = Column(Text)  # if set, only relevant during this stage
    is_done = Column(Boolean, nullable=False, default=False, server_default="false")
    due_at = Column(Date)
    completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    indoor = relationship("Indoor", back_populates="tasks")

    def __repr__(self):
        return f"<Task(id={self.id}, title={self.title}, is_done={self.is_done})>"


class Fertilizer(Base):
    """A fertilizer product in the user's catalog."""
    __tablename__ = "fertilizers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(Text, nullable=False)
    kind = Column(Text)  # base | calmag | pk | root | enzyme | other
    unit = Column(Text)  # ml/L | g/L | ml | g
    default_amount = Column(Numeric(8, 3))
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="fertilizers")
    plan_items = relationship("IndoorFertilizerPlan", back_populates="fertilizer", cascade="all, delete-orphan")
    applications = relationship("FertilizerApplication", back_populates="fertilizer", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Fertilizer(id={self.id}, name={self.name})>"


class IndoorFertilizerPlan(Base):
    """A fertilizer included in an indoor's feeding plan."""
    __tablename__ = "indoor_fertilizer_plan"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    indoor_id = Column(UUID(as_uuid=True), ForeignKey("indoors.id", ondelete="CASCADE"), nullable=False, index=True)
    fertilizer_id = Column(UUID(as_uuid=True), ForeignKey("fertilizers.id", ondelete="CASCADE"), nullable=False, index=True)
    frequency = Column(Text)  # every_watering | weekly | stage
    stage = Column(Text)  # optional stage scope
    active = Column(Boolean, nullable=False, default=True, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    indoor = relationship("Indoor", back_populates="fertilizer_plan")
    fertilizer = relationship("Fertilizer", back_populates="plan_items")

    __table_args__ = (
        Index("uq_indoor_fertilizer_plan", "indoor_id", "fertilizer_id", unique=True),
    )

    def __repr__(self):
        return f"<IndoorFertilizerPlan(indoor_id={self.indoor_id}, fertilizer_id={self.fertilizer_id})>"


class FertilizerApplication(Base):
    """A logged fertilizer application for an indoor."""
    __tablename__ = "fertilizer_applications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    indoor_id = Column(UUID(as_uuid=True), ForeignKey("indoors.id", ondelete="CASCADE"), nullable=False, index=True)
    fertilizer_id = Column(UUID(as_uuid=True), ForeignKey("fertilizers.id", ondelete="CASCADE"), nullable=False, index=True)
    applied_at = Column(DateTime(timezone=True), nullable=False, index=True)
    amount = Column(Numeric(8, 3))
    note = Column(Text)
    watering_history_id = Column(UUID(as_uuid=True), ForeignKey("watering_history.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    indoor = relationship("Indoor", back_populates="fertilizer_applications")
    fertilizer = relationship("Fertilizer", back_populates="applications")

    def __repr__(self):
        return f"<FertilizerApplication(id={self.id}, fertilizer_id={self.fertilizer_id}, applied_at={self.applied_at})>"


class ChatMessage(Base):
    """A message in the AI chat conversation for a user."""
    __tablename__ = "chat_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(Text, nullable=False)  # user | assistant | tool
    content = Column(Text, nullable=False)
    pending_action = Column(JSONB)  # proposed action awaiting confirmation
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="chat_messages")

    def __repr__(self):
        return f"<ChatMessage(id={self.id}, role={self.role})>"


class Device(Base):
    """A bridge device (e.g. Raspberry Pi) that reports telemetry and applies commands."""
    __tablename__ = "devices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    indoor_id = Column(UUID(as_uuid=True), ForeignKey("indoors.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(Text, nullable=False)
    token_hash = Column(Text, nullable=False, index=True)
    ha_entities = Column(JSONB)  # {temp, humidity, humidifier, ac}
    reported_state = Column(JSONB)  # {humidifier, ac, at}
    last_seen = Column(DateTime(timezone=True))
    active = Column(Boolean, nullable=False, default=True, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    indoor = relationship("Indoor", back_populates="devices")

    def __repr__(self):
        return f"<Device(id={self.id}, name={self.name})>"


# Create composite indexes
Index("idx_plants_user_indoor", Plant.user_id, Plant.indoor_id)
Index("idx_watering_history_plant_ts", WateringHistory.plant_id, WateringHistory.event_ts.desc())
Index("idx_indoor_history_indoor_ts", IndoorHistory.indoor_id, IndoorHistory.event_ts.desc())
Index("idx_measurements_indoor_ts", Measurement.indoor_id, Measurement.event_ts.desc())
Index("idx_tasks_indoor", Task.indoor_id, Task.is_done)
Index("idx_fertilizer_applications_indoor_ts", FertilizerApplication.indoor_id, FertilizerApplication.applied_at.desc())
