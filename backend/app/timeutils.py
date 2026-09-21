"""Time helpers: always use timezone-aware UTC timestamps."""
from datetime import datetime, timezone


def now() -> datetime:
    """Current time, timezone-aware in UTC."""
    return datetime.now(timezone.utc)
