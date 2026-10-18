from typing import Optional, Dict, Any
from pydantic import BaseModel, Field

class SettingsResponse(BaseModel):
    confidence_threshold: float = Field(default=0.60, ge=0.1, le=1.0)
    alert_cooldown_seconds: int = Field(default=15, ge=0, le=3600)
    frame_interval_ms: int = Field(default=800, ge=200, le=5000)
    retention_days: int = Field(default=30, ge=1, le=365)
    image_retention_enabled: bool = False
    ai_provider: str
    ai_model: str
    is_ai_configured: bool
    updated_at: Optional[str] = None

class SettingsUpdate(BaseModel):
    confidence_threshold: Optional[float] = Field(default=None, ge=0.1, le=1.0)
    alert_cooldown_seconds: Optional[int] = Field(default=None, ge=0, le=3600)
    frame_interval_ms: Optional[int] = Field(default=None, ge=200, le=5000)
    retention_days: Optional[int] = Field(default=None, ge=1, le=365)
    image_retention_enabled: Optional[bool] = None
