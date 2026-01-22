"""
Services package
"""
from datetime import date, timedelta
from typing import Optional


def compute_next_water_at(
    last_watered_at: Optional[date],
    watering_interval_days: int
) -> Optional[date]:
    """
    Compute the next watering date based on last watering and interval.
    
    Args:
        last_watered_at: Date of last watering (None if never watered)
        watering_interval_days: Days between waterings
        
    Returns:
        Next watering date, or None if last_watered_at is None
    """
    if last_watered_at is None:
        return None
    
    return last_watered_at + timedelta(days=watering_interval_days)

