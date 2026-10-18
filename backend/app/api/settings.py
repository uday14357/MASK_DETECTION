from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from app.core.config import settings
from app.core.security import get_current_user_token_data, require_role
from app.database.connection import get_collection
from app.schemas.settings import SettingsResponse, SettingsUpdate

router = APIRouter(prefix="/settings", tags=["Settings"])

@router.get("", response_model=SettingsResponse)
async def get_settings(token_data: dict = Depends(get_current_user_token_data)):
    settings_col = get_collection("settings")
    doc = await settings_col.find_one({"scope": "global"})
    
    is_configured = bool(settings.AI_API_KEY) or settings.AI_PROVIDER == "demo"
    if not doc:
        return SettingsResponse(
            confidence_threshold=settings.CONFIDENCE_THRESHOLD,
            alert_cooldown_seconds=settings.ALERT_COOLDOWN_SECONDS,
            frame_interval_ms=settings.FRAME_INTERVAL_MS,
            retention_days=settings.RETENTION_DAYS,
            image_retention_enabled=settings.IMAGE_RETENTION_ENABLED,
            ai_provider=settings.AI_PROVIDER,
            ai_model=settings.AI_MODEL,
            is_ai_configured=is_configured,
            updated_at=None
        )

    return SettingsResponse(
        confidence_threshold=doc.get("confidence_threshold", settings.CONFIDENCE_THRESHOLD),
        alert_cooldown_seconds=doc.get("alert_cooldown_seconds", settings.ALERT_COOLDOWN_SECONDS),
        frame_interval_ms=doc.get("frame_interval_ms", settings.FRAME_INTERVAL_MS),
        retention_days=doc.get("retention_days", settings.RETENTION_DAYS),
        image_retention_enabled=doc.get("image_retention_enabled", settings.IMAGE_RETENTION_ENABLED),
        ai_provider=settings.AI_PROVIDER,
        ai_model=settings.AI_MODEL,
        is_ai_configured=is_configured,
        updated_at=doc.get("updated_at")
    )

@router.patch("", response_model=SettingsResponse)
async def update_settings(
    payload: SettingsUpdate,
    token_data: dict = Depends(require_role(["admin"]))
):
    settings_col = get_collection("settings")
    update_data = {}
    if payload.confidence_threshold is not None:
        update_data["confidence_threshold"] = payload.confidence_threshold
    if payload.alert_cooldown_seconds is not None:
        update_data["alert_cooldown_seconds"] = payload.alert_cooldown_seconds
    if payload.frame_interval_ms is not None:
        update_data["frame_interval_ms"] = payload.frame_interval_ms
    if payload.retention_days is not None:
        update_data["retention_days"] = payload.retention_days
    if payload.image_retention_enabled is not None:
        update_data["image_retention_enabled"] = payload.image_retention_enabled

    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await settings_col.update_one({"scope": "global"}, {"$set": update_data})
    
    return await get_settings(token_data)
