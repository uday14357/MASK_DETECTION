import io
import time
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple
from PIL import Image
from fastapi import HTTPException, status
from app.core.config import settings
from app.database.connection import get_collection
from app.services.ai_provider import get_ai_provider
from app.schemas.detection import DetectionResponse

# In-memory cooldown tracking per camera/source
_last_alert_timestamps: dict[str, datetime] = {}

class DetectionService:
    @staticmethod
    def validate_image_bytes(image_bytes: bytes) -> Tuple[int, int, str]:
        # Size validation
        max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
        if len(image_bytes) > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail={"code": "FILE_TOO_LARGE", "message": f"Image size exceeds limit of {settings.MAX_UPLOAD_SIZE_MB}MB"}
            )
        try:
            img = Image.open(io.BytesIO(image_bytes))
            img_format = img.format.lower() if img.format else "jpeg"
            if img_format not in ["jpeg", "jpg", "png", "webp"]:
                raise HTTPException(
                    status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                    detail={"code": "UNSUPPORTED_IMAGE_TYPE", "message": "Only JPEG, PNG, and WebP images are supported"}
                )
            return img.width, img.height, img_format
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_IMAGE_DATA", "message": f"Image header or content is corrupted: {str(e)}"}
            )

    @classmethod
    async def process_detection(
        cls,
        image_bytes: bytes,
        source_type: str = "webcam",
        camera_id: Optional[str] = None
    ) -> DetectionResponse:
        # Validate
        cls.validate_image_bytes(image_bytes)

        # Retrieve dynamic settings
        settings_col = get_collection("settings")
        app_settings = await settings_col.find_one({"scope": "global"})
        confidence_thresh = app_settings.get("confidence_threshold", settings.CONFIDENCE_THRESHOLD) if app_settings else settings.CONFIDENCE_THRESHOLD
        cooldown_sec = app_settings.get("alert_cooldown_seconds", settings.ALERT_COOLDOWN_SECONDS) if app_settings else settings.ALERT_COOLDOWN_SECONDS

        provider = get_ai_provider()
        detection_result = await provider.detect_mask(
            image_bytes=image_bytes,
            confidence_threshold=confidence_thresh,
            source_type=source_type,
            camera_id=camera_id
        )

        # Update camera last seen if camera_id exists
        if camera_id:
            cameras_col = get_collection("cameras")
            await cameras_col.update_one(
                {"_id": camera_id},
                {"$set": {"last_seen_at": datetime.now(timezone.utc).isoformat()}}
            )

        # Check if an alert event should be recorded
        # Rule: No-mask detected with confidence >= threshold, and cooldown elapsed
        has_no_mask = False
        highest_conf = 0.0
        for item in detection_result.detections:
            if item.label == "no_mask" and item.confidence >= confidence_thresh:
                has_no_mask = True
                if item.confidence > highest_conf:
                    highest_conf = item.confidence

        if has_no_mask:
            cooldown_key = camera_id or f"source_{source_type}"
            now = datetime.now(timezone.utc)
            last_alert = _last_alert_timestamps.get(cooldown_key)

            if not last_alert or (now - last_alert) >= timedelta(seconds=cooldown_sec):
                _last_alert_timestamps[cooldown_key] = now
                events_col = get_collection("events")

                # Look up camera name if known
                camera_name = "Live Webcam"
                if camera_id:
                    cameras_col = get_collection("cameras")
                    cam = await cameras_col.find_one({"_id": camera_id})
                    if cam:
                        camera_name = cam.get("name", "Camera")

                new_event = {
                    "_id": str(uuid.uuid4()),
                    "request_id": detection_result.request_id,
                    "camera_id": camera_id,
                    "camera_name": camera_name,
                    "source_type": source_type,
                    "processed_at": detection_result.processed_at,
                    "labels_summary": {
                        "mask": detection_result.summary.mask_count,
                        "no_mask": detection_result.summary.no_mask_count,
                        "uncertain": detection_result.summary.uncertain_count
                    },
                    "confidence_summary": highest_conf,
                    "severity": "critical" if detection_result.summary.no_mask_count > 1 else "warning",
                    "acknowledged": False,
                    "acknowledged_at": None,
                    "acknowledged_by": None,
                    "created_at": now.isoformat()
                }
                await events_col.insert_one(new_event)

        return detection_result
