import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine, SessionLocal
from app import models  # Import models to ensure they're registered
from app.api import dashboard, indoors, plants, grow, fertilizers, chat, devices, alerts
from app.services import alert_service

logger = logging.getLogger("plantulas.alerts")

# How often the background job evaluates alert rules.
ALERT_INTERVAL_SECONDS = 300


def _evaluate_all_alerts() -> None:
    db = SessionLocal()
    try:
        alert_service.evaluate_all(db)
    finally:
        db.close()


async def _alert_loop() -> None:
    while True:
        try:
            await asyncio.to_thread(_evaluate_all_alerts)
        except Exception as exc:  # noqa: BLE001
            logger.error("alert loop failed: %s", exc)
        await asyncio.sleep(ALERT_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(_alert_loop())
    try:
        yield
    finally:
        task.cancel()


app = FastAPI(title="PlantulasBot API", lifespan=lifespan)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(dashboard.router)
app.include_router(indoors.router)
app.include_router(plants.router)
app.include_router(grow.router)
app.include_router(fertilizers.router)
app.include_router(chat.router)
app.include_router(devices.router)
app.include_router(alerts.router)


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"ok": True}


@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "PlantulasBot API - Use /docs for API documentation"}
