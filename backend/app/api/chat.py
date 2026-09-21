"""
AI chat router.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, ChatMessage
from app.schemas import ChatRequest, ChatConfirmRequest, ChatMessageItem, ChatResponse
from app.api import get_current_user
from app.services import chat_service

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Send a message to the AI assistant."""
    if not chat_service.is_configured():
        raise HTTPException(
            status_code=503,
            detail="El chatbot no está configurado (falta OPENAI_API_KEY).",
        )
    message = (body.message or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="Mensaje vacío")
    try:
        return chat_service.run_chat(db, user, message)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Error del asistente: {exc}")


@router.post("/confirm", response_model=ChatResponse)
async def confirm(
    body: ChatConfirmRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Confirm or cancel the pending action."""
    if not chat_service.is_configured():
        raise HTTPException(status_code=503, detail="El chatbot no está configurado.")
    try:
        return chat_service.confirm_pending(db, user, body.approve)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Error del asistente: {exc}")


@router.get("/history", response_model=list[ChatMessageItem])
async def history(
    limit: int = 100,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get the conversation history."""
    rows = (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == user.id, ChatMessage.role.in_(["user", "assistant"]))
        .order_by(ChatMessage.created_at.asc())
        .limit(limit)
        .all()
    )
    return rows


@router.delete("/history", status_code=204)
async def clear_history(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Clear the conversation history."""
    db.query(ChatMessage).filter(ChatMessage.user_id == user.id).delete(synchronize_session=False)
    db.commit()
    return None
