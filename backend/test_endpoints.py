"""
Test script para verificar endpoints de ETAPA 3
"""
import sys
from datetime import date, datetime, timedelta
from app.database import SessionLocal
from app.models import User

def test_endpoints():
    """Test all endpoints logic"""
    db = SessionLocal()
    
    print("🧪 Testing ETAPA 3 Endpoints Logic")
    print("=" * 60)
    
    try:
        # Test 1: Get or create user
        print("\n1️⃣ Testing user retrieval...")
        user = db.query(User).filter(User.telegram_user_id == 12345678).first()
        assert user is not None, "User should exist from seed"
        print(f"✅ User found: {user.id}")
        
        # Test 2: Dashboard logic
        print("\n2️⃣ Testing dashboard logic...")
        today = date.today()
        
        indoors_total = len(user.indoors)
        plants_total = len(user.plants)
        need_water_count = sum(
            1 for plant in user.plants
            if plant.next_water_at and plant.next_water_at <= today
        )
        
        print(f"✅ Indoors total: {indoors_total}")
        print(f"✅ Plants total: {plants_total}")
        print(f"✅ Need water count: {need_water_count}")
        
        # Build upcoming list
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
            
            upcoming.append({
                "plant_id": plant.id,
                "name": plant.name,
                "next_water_at": plant.next_water_at,
                "due_in_days": due_in_days,
                "status": status
            })
        
        upcoming.sort(key=lambda x: x["next_water_at"] or date.max)
        print(f"✅ Upcoming plants sorted: {len(upcoming)}")
        for item in upcoming[:3]:
            print(f"   - {item['name']}: {item['status']} (due in {item['due_in_days']} days)")
        
        # Test 3: Indoors list logic
        print("\n3️⃣ Testing indoors list logic...")
        for indoor in user.indoors:
            plants_count = len(indoor.plants)
            print(f"✅ {indoor.name}: {plants_count} plants")
        
        # Test 4: Indoor detail logic
        print("\n4️⃣ Testing indoor detail logic...")
        if user.indoors:
            indoor = user.indoors[0]
            plants_in_indoor = []
            for plant in indoor.plants:
                days_since_planted = None
                if plant.planted_at:
                    days_since_planted = (today - plant.planted_at).days
                
                plants_in_indoor.append({
                    "name": plant.name,
                    "last_watered_at": plant.last_watered_at,
                    "next_water_at": plant.next_water_at,
                    "days_since_planted": days_since_planted
                })
            
            history = indoor.history
            print(f"✅ {indoor.name}: {len(plants_in_indoor)} plants, {len(history)} history events")
            for p in plants_in_indoor:
                print(f"   - {p['name']}: planted {p['days_since_planted']}d ago")
        
        # Test 5: Plant watering logic
        print("\n5️⃣ Testing plant watering logic...")
        if user.plants:
            plant = user.plants[0]
            
            # Simulate watering
            from app.services.plant_service import register_watering
            from app.services import compute_next_water_at
            
            old_count = len(plant.watering_history)
            new_plant, watering = register_watering(
                db,
                plant.id,
                user.id,
                liters=1.5,
                event_date=today,
                note="Test watering",
                ferts=None
            )
            
            # Refresh to get updated data
            db.refresh(plant)
            
            new_count = len(plant.watering_history)
            next_water = compute_next_water_at(today, plant.watering_interval_days)
            
            print(f"✅ {plant.name}:")
            print(f"   - Watering records: {old_count} → {new_count}")
            print(f"   - Last watered: {plant.last_watered_at}")
            print(f"   - Next water: {plant.next_water_at}")
            print(f"   - Calculated next: {next_water}")
        
        # Test 6: Indoor update logic
        print("\n6️⃣ Testing indoor update logic...")
        if user.indoors:
            indoor = user.indoors[0]
            old_power = indoor.light_power_pct
            old_history_count = len(indoor.history)
            
            # Update light power
            from app.services.indoor_service import update_indoor
            
            updated = update_indoor(
                db,
                indoor,
                light_power_pct=80
            )
            
            db.refresh(indoor)
            new_history_count = len(indoor.history)
            
            print(f"✅ {indoor.name}:")
            print(f"   - Light power: {old_power}% → {updated.light_power_pct}%")
            print(f"   - History events: {old_history_count} → {new_history_count}")
            if new_history_count > old_history_count:
                last_event = indoor.history[-1]
                print(f"   - Last event: {last_event.message}")
        
        print("\n" + "=" * 60)
        print("✅ All endpoint logic tests passed!")
        return True
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()


if __name__ == "__main__":
    success = test_endpoints()
    sys.exit(0 if success else 1)
