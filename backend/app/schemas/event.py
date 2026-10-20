from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, ConfigDict

class EventOut(BaseModel):
    id: str = Field(..., alias="_id")
    request_id: str
    camera_id: Optional[str] = None
    camera_name: Optional[str] = "Webcam"
    source_type: str
    processed_at: str
    labels_summary: Dict[str, int]
    confidence_summary: float
    severity: str = "warning"
    acknowledged: bool = False
    acknowledged_at: Optional[str] = None
    acknowledged_by: Optional[str] = None
    created_at: str

    model_config = ConfigDict(populate_by_name=True)

class EventFilterParams(BaseModel):
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    camera_id: Optional[str] = None
    source_type: Optional[str] = None
    status: Optional[str] = None  # 'mask', 'no_mask', 'all'
    acknowledged: Optional[bool] = None
    search: Optional[str] = None
    page: int = Field(default=1, ge=1)
    limit: int = Field(default=20, ge=1, le=100)

class EventListResponse(BaseModel):
    events: List[EventOut]
    total: int
    page: int
    limit: int
    total_pages: int
