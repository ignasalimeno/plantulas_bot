"""
Seed script for PlantulasBot database.
Creates demo data for telegram_user_id=12345678.
Idempotent: can be run multiple times without duplicating data.
"""
import sys
from datetime import datetime, date, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session
from app.database import SessionLocal, engine
from app.models import User, Indoor, IndoorHistory, Plant, WateringHistory
from app.services import compute_next_water_at


def create_user(db: Session, telegram_user_id: int) -> User:
    """Create or get existing user"""
    user = db.query(User).filter(User.telegram_user_id == telegram_user_id).first()
    if user:
        print(f"✓ User with telegram_user_id={telegram_user_id} already exists")
        return user
    
    user = User(telegram_user_id=telegram_user_id)
    db.add(user)
    db.commit()
    db.refresh(user)
    print(f"✓ Created user with telegram_user_id={telegram_user_id}")
    return user


def create_indoors(db: Session, user: User) -> list[Indoor]:
    """Create or get existing indoors"""
    indoors = []
    
    indoor_data = [
        {
            "name": "Carpa Principal",
            "temp_c": Decimal("24.5"),
            "humidity": Decimal("65.0"),
            "fan_location": "Esquina superior izquierda",
            "extractor_top": True,
            "extractor_bottom": False,
            "fan": True,
            "light_height_cm": Decimal("50.0"),
            "light_power_pct": 80,
            "light_schedule": "18/6",
        },
        {
            "name": "Jardín de Hierbas",
            "temp_c": Decimal("22.0"),
            "humidity": Decimal("55.0"),
            "fan_location": None,
            "extractor_top": False,
            "extractor_bottom": False,
            "fan": True,
            "light_height_cm": Decimal("40.0"),
            "light_power_pct": 60,
            "light_schedule": "16/8",
        }
    ]
    
    for data in indoor_data:
        existing = db.query(Indoor).filter(
            Indoor.user_id == user.id,
            Indoor.name == data["name"]
        ).first()
        
        if existing:
            print(f"✓ Indoor '{data['name']}' already exists")
            indoors.append(existing)
        else:
            indoor = Indoor(user_id=user.id, **data)
            db.add(indoor)
            db.commit()
            db.refresh(indoor)
            print(f"✓ Created indoor '{data['name']}'")
            
            # Create history entry
            history = IndoorHistory(
                indoor_id=indoor.id,
                event_ts=datetime.now(),
                message="Indoor creado.",
                payload=None
            )
            db.add(history)
            indoors.append(indoor)
    
    db.commit()
    return indoors


def create_plants(db: Session, user: User, indoors: list[Indoor]) -> list[Plant]:
    """Create or get existing plants"""
    plants = []
    
    # Calculate dates for realistic data
    today = date.today()
    
    plant_data = [
        {
            "name": "Monstera",
            "species": "Monstera deliciosa",
            "indoor_id": indoors[0].id,
            "planted_at": today - timedelta(days=60),
            "watering_interval_days": 7,
            "default_liters": Decimal("1.5"),
            "last_watered_at": today - timedelta(days=3),  # Watered 3 days ago
            "notes": "Necesita luz indirecta brillante",
        },
        {
            "name": "Ficus",
            "species": "Ficus elastica",
            "indoor_id": indoors[0].id,
            "planted_at": today - timedelta(days=45),
            "watering_interval_days": 5,
            "default_liters": Decimal("1.0"),
            "last_watered_at": today - timedelta(days=6),  # Needs watering (overdue)
            "notes": "Regar cuando la tierra esté seca al tacto",
        },
        {
            "name": "Albahaca",
            "species": "Ocimum basilicum",
            "indoor_id": indoors[1].id,
            "planted_at": today - timedelta(days=30),
            "watering_interval_days": 3,
            "default_liters": Decimal("0.5"),
            "last_watered_at": today - timedelta(days=1),  # Recently watered
            "notes": "Hierbas aromáticas para cocinar",
        }
    ]
    
    for data in plant_data:
        existing = db.query(Plant).filter(
            Plant.user_id == user.id,
            Plant.name == data["name"]
        ).first()
        
        if existing:
            print(f"✓ Plant '{data['name']}' already exists")
            plants.append(existing)
        else:
            # Compute next_water_at
            last_watered = data["last_watered_at"]
            interval = data["watering_interval_days"]
            next_water = compute_next_water_at(last_watered, interval)
            
            plant = Plant(
                user_id=user.id,
                indoor_id=data["indoor_id"],
                name=data["name"],
                species=data["species"],
                planted_at=data["planted_at"],
                watering_interval_days=interval,
                default_liters=data["default_liters"],
                last_watered_at=last_watered,
                next_water_at=next_water,
                notes=data.get("notes"),
            )
            db.add(plant)
            db.commit()
            db.refresh(plant)
            print(f"✓ Created plant '{data['name']}' (next water: {next_water})")
            plants.append(plant)
    
    return plants


def create_watering_history(db: Session, plants: list[Plant]):
    """Create watering history for plants"""
    today = date.today()
    
    for plant in plants:
        # Check if already has history
        existing_count = db.query(WateringHistory).filter(
            WateringHistory.plant_id == plant.id
        ).count()
        
        if existing_count > 0:
            print(f"✓ Plant '{plant.name}' already has {existing_count} watering records")
            continue
        
        # Create 2 watering records for each plant
        watering_records = [
            {
                "event_ts": datetime.combine(
                    plant.last_watered_at - timedelta(days=plant.watering_interval_days),
                    datetime.now().time()
                ),
                "liters": plant.default_liters,
                "note": "Riego regular",
                "ferts": None,
            },
            {
                "event_ts": datetime.combine(plant.last_watered_at, datetime.now().time()),
                "liters": plant.default_liters,
                "note": "Riego con fertilizante",
                "ferts": {"type": "NPK", "ratio": "10-10-10", "ml_per_liter": 5},
            }
        ]
        
        for record in watering_records:
            history = WateringHistory(
                plant_id=plant.id,
                **record
            )
            db.add(history)
        
        print(f"✓ Created {len(watering_records)} watering records for '{plant.name}'")
    
    db.commit()


def seed_database():
    """Main seed function"""
    print("🌱 Starting database seed...")
    print("-" * 50)
    
    db = SessionLocal()
    try:
        # Create user
        user = create_user(db, telegram_user_id=12345678)
        
        # Create indoors
        indoors = create_indoors(db, user)
        
        # Create plants
        plants = create_plants(db, user, indoors)
        
        # Create watering history
        create_watering_history(db, plants)
        
        print("-" * 50)
        print("✅ Database seed completed successfully!")
        print(f"   - User: telegram_user_id=12345678")
        print(f"   - Indoors: {len(indoors)}")
        print(f"   - Plants: {len(plants)}")
        
    except Exception as e:
        print(f"❌ Error during seed: {e}")
        db.rollback()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
