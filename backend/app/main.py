from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine
from app import models  # Import models to ensure they're registered
from app.api import dashboard, indoors, plants

app = FastAPI(title="PlantulasBot API")

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


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"ok": True}


@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "PlantulasBot API - Use /docs for API documentation"}
