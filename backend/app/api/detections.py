import base64
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, status
from app.core.security import get_current_user_token_data
from app.schemas.detection import DetectionResponse, FramePayload
from app.services.detection_service import DetectionService
from app.database.connection import get_collection

router = APIRouter(prefix="/detections", tags=["Detections"])

@router.post("/image", response_model=DetectionResponse)
async def analyze_image(
    file: UploadFile = File(...),
    camera_id: Optional[str] = Form(None),
    token_data: dict = Depends(get_current_user_token_data)
):
    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "EMPTY_FILE", "message": "Uploaded image file is empty"}
        )
    return await DetectionService.process_detection(
        image_bytes=image_bytes,
        source_type="image_upload",
        camera_id=camera_id
    )

@router.post("/frame", response_model=DetectionResponse)
async def analyze_frame(
    payload: FramePayload,
    token_data: dict = Depends(get_current_user_token_data)
):
    try:
        raw_b64 = payload.image_base64
        if "," in raw_b64:
            raw_b64 = raw_b64.split(",", 1)[1]
        image_bytes = base64.b64decode(raw_b64)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_BASE64", "message": f"Invalid base64 encoded image: {str(e)}"}
        )

    return await DetectionService.process_detection(
        image_bytes=image_bytes,
        source_type=payload.source_type or "webcam",
        camera_id=payload.camera_id
    )

@router.get("/{detection_id}")
async def get_detection(
    detection_id: str,
    token_data: dict = Depends(get_current_user_token_data)
):
    events_col = get_collection("events")
    event = await events_col.find_one({"request_id": detection_id})
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Detection record not found"}
        )
    return event
