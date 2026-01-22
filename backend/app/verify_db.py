"""
Verification script to check database content.
"""
from app.database import SessionLocal
from app.models import User, Indoor, Plant, WateringHistory, IndoorHistory


def verify_database():
    """Verify database content"""
    db = SessionLocal()
    try:
        print("🔍 Database Verification")
        print("=" * 60)
        
        # Count users
        user_count = db.query(User).count()
        print(f"Users: {user_count}")
        
        # Count indoors
        indoor_count = db.query(Indoor).count()
        print(f"Indoors: {indoor_count}")
        
        # Count plants
        plant_count = db.query(Plant).count()
        print(f"Plants: {plant_count}")
        
        # Count watering history
        watering_count = db.query(WateringHistory).count()
        print(f"Watering History: {watering_count}")
        
        # Count indoor history
        indoor_history_count = db.query(IndoorHistory).count()
        print(f"Indoor History: {indoor_history_count}")
        
        print("=" * 60)
        
        # Show details
        user = db.query(User).filter(User.telegram_user_id == 12345678).first()
        if user:
            print(f"\n📱 User telegram_user_id={user.telegram_user_id}")
            print(f"   ID: {user.id}")
            print(f"   Created: {user.created_at}")
            
            print(f"\n🏠 Indoors ({len(user.indoors)}):")
            for indoor in user.indoors:
                print(f"   - {indoor.name}")
                print(f"     Temp: {indoor.temp_c}°C, Humidity: {indoor.humidity}%")
                print(f"     Light: {indoor.light_schedule}, {indoor.light_power_pct}%")
            
            print(f"\n🌱 Plants ({len(user.plants)}):")
            for plant in user.plants:
                print(f"   - {plant.name} ({plant.species})")
                print(f"     Indoor: {plant.indoor.name if plant.indoor else 'None'}")
                print(f"     Last watered: {plant.last_watered_at}")
                print(f"     Next water: {plant.next_water_at}")
                print(f"     Watering records: {len(plant.watering_history)}")
        
        print("\n✅ Verification complete!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    verify_database()
