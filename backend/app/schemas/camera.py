from typing import Optional
from pydantic import BaseModel, Field, ConfigDict

class CameraCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    location: str = Field(..., min_length=2, max_length=150)
    camera_type: str = Field(default="webcam", description="'webcam', 'image_upload', or 'ip_camera'")
    rtsp_url: Optional[str] = Field(default=None, description="Protected RTSP URL if IP camera")
    status: str = Field(default="active", description="'active', 'inactive', 'requires_streaming_configuration'")

class CameraUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    camera_type: Optional[str] = None
    rtsp_url: Optional[str] = None
    status: Optional[str] = None

class CameraOut(BaseModel):
    id: str = Field(..., alias="_id")
    name: str
    location: str
    camera_type: str
    status: str
    has_stream_credentials: bool = False
    created_at: str
    updated_at: str
    last_seen_at: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)
