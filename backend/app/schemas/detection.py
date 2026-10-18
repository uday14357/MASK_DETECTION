from typing import List, Optional
from pydantic import BaseModel, Field

class BoundingBox(BaseModel):
    x: float = Field(..., description="Top-left x coordinate (normalized 0-1 or pixel)")
    y: float = Field(..., description="Top-left y coordinate (normalized 0-1 or pixel)")
    width: float = Field(..., description="Box width (normalized 0-1 or pixel)")
    height: float = Field(..., description="Box height (normalized 0-1 or pixel)")
    coordinate_format: str = Field(default="normalized", description="Coordinate system ('normalized' [0-1] or 'pixels')")

class DetectionItem(BaseModel):
    label: str = Field(..., description="Classification: 'mask', 'no_mask', or 'uncertain'")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Detection confidence score")
    bbox: BoundingBox

class DetectionSummary(BaseModel):
    faces_detected: int = Field(default=0)
    mask_count: int = Field(default=0)
    no_mask_count: int = Field(default=0)
    uncertain_count: int = Field(default=0)

class DetectionResponse(BaseModel):
    request_id: str
    processed_at: str
    source_type: str = Field(..., description="'webcam', 'image_upload', or 'ip_camera'")
    camera_id: Optional[str] = None
    detections: List[DetectionItem]
    summary: DetectionSummary
    latency_ms: Optional[float] = None
    is_demo: bool = False
    warning: Optional[str] = None

class FramePayload(BaseModel):
    image_base64: str = Field(..., description="Base64 encoded JPEG, PNG, or WebP image frame")
    source_type: str = Field(default="webcam")
    camera_id: Optional[str] = None
