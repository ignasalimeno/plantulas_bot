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
    
    # Lighting
    light_height_cm = Column(Numeric(6, 2))
    light_power_pct = Column(Integer)  # 0-100
    light_schedule = Column(Text)  # e.g., "18/6", "20/4"
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    user = relationship("User", back_populates="indoors")
    plants = relationship("Plant", back_populates="indoor", cascade="all, delete-orphan")
    history = relationship("IndoorHistory", back_populates="indoor", cascade="all, delete-orphan")

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
    plant_id = Column(UUID(as_uuid=True), ForeignKey("plants.id", ondelete="CASCADE"), nullable=False, index=True)
    event_ts = Column(DateTime(timezone=True), nullable=False, index=True)
    liters = Column(Numeric(6, 3), nullable=False)
    note = Column(Text)
    ferts = Column(JSONB)  # Optional fertilizer data

    # Relationships
    plant = relationship("Plant", back_populates="watering_history")

    def __repr__(self):
        return f"<WateringHistory(id={self.id}, plant_id={self.plant_id}, liters={self.liters})>"


# Create composite indexes
Index("idx_plants_user_indoor", Plant.user_id, Plant.indoor_id)
Index("idx_watering_history_plant_ts", WateringHistory.plant_id, WateringHistory.event_ts.desc())
Index("idx_indoor_history_indoor_ts", IndoorHistory.indoor_id, IndoorHistory.event_ts.desc())
