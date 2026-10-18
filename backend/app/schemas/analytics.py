from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class AnalyticsSummary(BaseModel):
    total_events: int = 0
    total_faces: int = 0
    mask_detected_count: int = 0
    no_mask_detected_count: int = 0
    uncertain_count: int = 0
    mask_percentage: float = 0.0
    registered_cameras: int = 0
    unacknowledged_alerts: int = 0
    timeframe: str = "last_7_days"

class TrendPoint(BaseModel):
    date: str
    mask: int = 0
    no_mask: int = 0
    uncertain: int = 0
    total: int = 0
    mask_percentage: float = 0.0

class CameraStat(BaseModel):
    camera_id: str
    camera_name: str
    total_events: int = 0
    mask_count: int = 0
    no_mask_count: int = 0
    mask_percentage: float = 0.0
    status: str

class AnalyticsTrendsResponse(BaseModel):
    trends: List[TrendPoint]
    timeframe: str

class AnalyticsCamerasResponse(BaseModel):
    cameras: List[CameraStat]
