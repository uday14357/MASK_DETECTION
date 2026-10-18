import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status, Depends
from app.core.security import get_current_user_token_data, require_role
from app.database.connection import get_collection
from app.schemas.camera import CameraCreate, CameraUpdate, CameraOut

router = APIRouter(prefix="/cameras", tags=["Cameras"])

def sanitize_camera(doc: dict) -> CameraOut:
    has_creds = bool(doc.get("rtsp_url"))
    # Clean sensitive fields before returning
    clean_dict = {
        "_id": doc["_id"],
        "name": doc.get("name", ""),
        "location": doc.get("location", ""),
        "camera_type": doc.get("camera_type", "webcam"),
        "status": doc.get("status", "active"),
        "has_stream_credentials": has_creds,
        "created_at": doc.get("created_at", ""),
        "updated_at": doc.get("updated_at", ""),
        "last_seen_at": doc.get("last_seen_at")
    }
    return CameraOut(**clean_dict)

@router.get("", response_model=List[CameraOut])
async def list_cameras(token_data: dict = Depends(get_current_user_token_data)):
    cameras_col = get_collection("cameras")
    cursor = cameras_col.find().sort("created_at", -1)
    docs = await cursor.to_list(100)
    return [sanitize_camera(c) for c in docs]

@router.post("", response_model=CameraOut, status_code=status.HTTP_201_CREATED)
async def create_camera(
    payload: CameraCreate,
    token_data: dict = Depends(require_role(["admin"]))
):
    cameras_col = get_collection("cameras")
    now_str = datetime.now(timezone.utc).isoformat()
    
    # If IP camera is specified without an active HLS/WebRTC media gateway, reflect proper status
    calc_status = payload.status
    if payload.camera_type == "ip_camera":
        calc_status = "requires_streaming_configuration"

    camera_id = str(uuid.uuid4())
    doc = {
        "_id": camera_id,
        "name": payload.name,
        "location": payload.location,
        "camera_type": payload.camera_type,
        "rtsp_url": payload.rtsp_url, # Stored securely on server, never returned in list/detail
        "status": calc_status,
        "created_at": now_str,
        "updated_at": now_str,
        "last_seen_at": None
    }
    await cameras_col.insert_one(doc)
    return sanitize_camera(doc)

@router.get("/{camera_id}", response_model=CameraOut)
async def get_camera(camera_id: str, token_data: dict = Depends(get_current_user_token_data)):
    cameras_col = get_collection("cameras")
    doc = await cameras_col.find_one({"_id": camera_id})
    if not doc:
        raise HTTPException(status_code=404, detail={"code": "CAMERA_NOT_FOUND", "message": "Camera not found"})
    return sanitize_camera(doc)

@router.patch("/{camera_id}", response_model=CameraOut)
async def update_camera(
    camera_id: str,
    payload: CameraUpdate,
    token_data: dict = Depends(require_role(["admin"]))
):
    cameras_col = get_collection("cameras")
    existing = await cameras_col.find_one({"_id": camera_id})
    if not existing:
        raise HTTPException(status_code=404, detail={"code": "CAMERA_NOT_FOUND", "message": "Camera not found"})
    
    update_data = {}
    if payload.name is not None:
        update_data["name"] = payload.name
    if payload.location is not None:
        update_data["location"] = payload.location
    if payload.camera_type is not None:
        update_data["camera_type"] = payload.camera_type
    if payload.rtsp_url is not None:
        update_data["rtsp_url"] = payload.rtsp_url
    if payload.status is not None:
        update_data["status"] = payload.status
        
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    await cameras_col.update_one({"_id": camera_id}, {"$set": update_data})
    updated = await cameras_col.find_one({"_id": camera_id})
    return sanitize_camera(updated)

@router.delete("/{camera_id}")
async def delete_camera(
    camera_id: str,
    token_data: dict = Depends(require_role(["admin"]))
):
    cameras_col = get_collection("cameras")
    res = await cameras_col.delete_one({"_id": camera_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Camera not found")
    return {"status": "success", "message": "Camera deleted. Historical event records are preserved."}
