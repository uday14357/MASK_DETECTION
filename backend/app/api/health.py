from datetime import datetime, timezone
from fastapi import APIRouter
from app.core.config import settings
from app.database.connection import DatabaseManager
from app.services.ai_provider import get_ai_provider

router = APIRouter(tags=["Health"])

@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "MaskGuard AI API",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "environment": settings.ENVIRONMENT
    }

@router.get("/health/ready")
async def readiness_check():
    provider = get_ai_provider()
    ai_health = await provider.check_health()
    db_status = "live_mongodb" if not DatabaseManager.is_fallback else "embedded_datastore"

    return {
        "status": "ready",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database": {
            "status": "connected",
            "engine": db_status
        },
        "ai_provider": {
            "name": settings.AI_PROVIDER,
            "status": ai_health.get("status"),
            "ready": ai_health.get("ready", False),
            "model": settings.AI_MODEL if settings.AI_PROVIDER != "unconfigured" else None
        },
        "streaming_service": {
            "status": "requires_streaming_configuration",
            "rtsp_pipeline_ready": False
        }
    }
