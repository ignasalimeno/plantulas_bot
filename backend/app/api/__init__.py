"""
API dependencies
"""
from fastapi import Depends, Request, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User


async def get_current_user(
    request: Request,
    db: Session = Depends(get_db)
) -> User:
    """
    Get current user from X-Telegram-UserId header.
    Creates user if doesn't exist.
    """
    telegram_user_id = request.headers.get("X-Telegram-UserId")
    
    if not telegram_user_id:
        raise HTTPException(
            status_code=400,
            detail="Missing X-Telegram-UserId header"
        )
    
    try:
        telegram_user_id = int(telegram_user_id)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="X-Telegram-UserId must be an integer"
        )
    
    # Get or create user
    user = db.query(User).filter(User.telegram_user_id == telegram_user_id).first()
    
    if not user:
        user = User(telegram_user_id=telegram_user_id)
        db.add(user)
        db.commit()
        db.refresh(user)
    
    return user
