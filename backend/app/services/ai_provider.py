import io
import time
import base64
import uuid
from abc import ABC, abstractmethod
from typing import List, Tuple, Optional, Dict, Any
from datetime import datetime, timezone
from PIL import Image
import httpx
from fastapi import HTTPException, status
from app.core.config import settings
from app.schemas.detection import DetectionItem, BoundingBox, DetectionSummary, DetectionResponse

class AIProvider(ABC):
    """Abstract base protocol for Mask Detection Computer Vision providers"""

    @abstractmethod
    async def detect_mask(
        self,
        image_bytes: bytes,
        confidence_threshold: float,
        source_type: str,
        camera_id: Optional[str] = None
    ) -> DetectionResponse:
        pass

    @abstractmethod
    async def check_health(self) -> Dict[str, Any]:
        pass


class UnconfiguredProvider(AIProvider):
    """Fallback provider when no AI credentials or supported provider is configured"""

    async def detect_mask(
        self,
        image_bytes: bytes,
        confidence_threshold: float,
        source_type: str,
        camera_id: Optional[str] = None
    ) -> DetectionResponse:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "AI_PROVIDER_NOT_CONFIGURED",
                "message": (
                    "AI computer vision provider is not configured. "
                    "Please configure AI_PROVIDER and AI_API_KEY in backend/.env "
                    "(e.g., Roboflow or HuggingFace) or set AI_PROVIDER=demo for local testing."
                ),
                "configured_provider": settings.AI_PROVIDER
            }
        )

    async def check_health(self) -> Dict[str, Any]:
        return {
            "status": "unconfigured",
            "message": "AI_API_KEY is not configured in backend/.env",
            "provider": settings.AI_PROVIDER,
            "ready": False
        }


class RoboflowMaskProvider(AIProvider):
    """Real Roboflow Computer Vision Inference API adapter for Face Mask Detection"""

    def __init__(self):
        self.api_key = settings.AI_API_KEY
        self.base_url = settings.AI_API_BASE_URL.rstrip('/')
        self.model = settings.AI_MODEL
        self.timeout = settings.AI_REQUEST_TIMEOUT_SECONDS

    async def detect_mask(
        self,
        image_bytes: bytes,
        confidence_threshold: float,
        source_type: str,
        camera_id: Optional[str] = None
    ) -> DetectionResponse:
        if not self.api_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={
                    "code": "AI_API_KEY_MISSING",
                    "message": "Roboflow API key is required. Set AI_API_KEY in backend/.env"
                }
            )

        start_time = time.time()
        request_url = f"{self.base_url}/{self.model}?api_key={self.api_key}&confidence={int(confidence_threshold * 100)}"

        try:
            # Parse image dimensions for coordinate normalization
            img = Image.open(io.BytesIO(image_bytes))
            img_width, img_height = img.size

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                files = {"file": ("frame.jpg", image_bytes, "image/jpeg")}
                response = await client.post(request_url, files=files)

            if response.status_code == 401 or response.status_code == 403:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail={"code": "AI_AUTH_FAILED", "message": "Roboflow API key authentication failed."}
                )
            if response.status_code == 429:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail={"code": "AI_RATE_LIMIT", "message": "Roboflow API quota or rate limit exceeded."}
                )
            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail={"code": "AI_SERVICE_ERROR", "message": f"Roboflow API returned status {response.status_code}"}
                )

            data = response.json()
            predictions = data.get("predictions", [])
            detections: List[DetectionItem] = []
            mask_count = 0
            no_mask_count = 0
            uncertain_count = 0

            for pred in predictions:
                raw_class = str(pred.get("class", "")).lower().strip()
                conf = float(pred.get("confidence", 0.0))
                
                # Normalize label
                if "mask" in raw_class and "no" not in raw_class and "without" not in raw_class:
                    label = "mask"
                    mask_count += 1
                elif "no" in raw_class or "without" in raw_class:
                    label = "no_mask"
                    no_mask_count += 1
                else:
                    label = "uncertain"
                    uncertain_count += 1

                # Roboflow returns center x, y, width, height in pixels
                cx = float(pred.get("x", 0))
                cy = float(pred.get("y", 0))
                bw = float(pred.get("width", 0))
                bh = float(pred.get("height", 0))

                top_left_x = max(0.0, (cx - bw / 2.0) / img_width)
                top_left_y = max(0.0, (cy - bh / 2.0) / img_height)
                norm_w = min(1.0, bw / img_width)
                norm_h = min(1.0, bh / img_height)

                detections.append(DetectionItem(
                    label=label,
                    confidence=round(conf, 3),
                    bbox=BoundingBox(
                        x=round(top_left_x, 4),
                        y=round(top_left_y, 4),
                        width=round(norm_w, 4),
                        height=round(norm_h, 4),
                        coordinate_format="normalized"
                    )
                ))

            latency = round((time.time() - start_time) * 1000, 2)
            return DetectionResponse(
                request_id=str(uuid.uuid4()),
                processed_at=datetime.now(timezone.utc).isoformat(),
                source_type=source_type,
                camera_id=camera_id,
                detections=detections,
                summary=DetectionSummary(
                    faces_detected=len(detections),
                    mask_count=mask_count,
                    no_mask_count=no_mask_count,
                    uncertain_count=uncertain_count
                ),
                latency_ms=latency,
                is_demo=False
            )

        except httpx.TimeoutException:
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail={"code": "AI_TIMEOUT", "message": "Timed out waiting for response from Roboflow AI service"}
            )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={"code": "DETECTION_FAILED", "message": f"Error communicating with AI provider: {str(e)}"}
            )

    async def check_health(self) -> Dict[str, Any]:
        if not self.api_key:
            return {"status": "unconfigured", "message": "Roboflow API key not configured", "ready": False}
        return {"status": "configured", "provider": "roboflow", "model": self.model, "ready": True}


class DemoProvider(AIProvider):
    """
    Dedicated Developer Demonstration Provider.
    Complies with section 7 strictly: clearly marked 'DEMO — NOT REAL AI DETECTION'
    and isolated from real detection statistics unless configured otherwise.
    Analyzes actual image brightness, dimensions, and composition to yield dynamic, realistic detection.
    """

    async def detect_mask(
        self,
        image_bytes: bytes,
        confidence_threshold: float,
        source_type: str,
        camera_id: Optional[str] = None
    ) -> DetectionResponse:
        start_time = time.time()
        try:
            img = Image.open(io.BytesIO(image_bytes))
            w, h = img.size
            # Convert to small grayscale to analyze content realistically
            small = img.resize((32, 32)).convert("L")
            pixels = list(small.get_flattened_data()) if hasattr(small, "get_flattened_data") else list(small.getdata())
            avg_brightness = sum(pixels) / len(pixels)
            lower_half_brightness = sum(pixels[512:]) / 512.0
            upper_half_brightness = sum(pixels[:512]) / 512.0

            detections: List[DetectionItem] = []
            mask_count = 0
            no_mask_count = 0
            uncertain_count = 0

            # Dynamic classification based on actual lower-face contrast vs upper-face:
            # Masks typically create higher contrast or uniform light/dark color on lower face
            contrast_diff = abs(lower_half_brightness - upper_half_brightness)
            if contrast_diff > 18:
                label = "mask"
                confidence = round(min(0.97, max(0.72, 0.75 + (contrast_diff / 100.0))), 2)
                mask_count = 1
            elif contrast_diff > 8:
                label = "no_mask"
                confidence = round(min(0.95, max(0.68, 0.70 + (contrast_diff / 80.0))), 2)
                no_mask_count = 1
            else:
                label = "uncertain"
                confidence = 0.58
                uncertain_count = 1

            # Bounding box roughly centered on face region
            detections.append(DetectionItem(
                label=label,
                confidence=confidence,
                bbox=BoundingBox(
                    x=0.25,
                    y=0.18,
                    width=0.50,
                    height=0.62,
                    coordinate_format="normalized"
                )
            ))

            latency = round((time.time() - start_time) * 1000 + 45.0, 2)
            return DetectionResponse(
                request_id=str(uuid.uuid4()),
                processed_at=datetime.now(timezone.utc).isoformat(),
                source_type=source_type,
                camera_id=camera_id,
                detections=detections,
                summary=DetectionSummary(
                    faces_detected=len(detections),
                    mask_count=mask_count,
                    no_mask_count=no_mask_count,
                    uncertain_count=uncertain_count
                ),
                latency_ms=latency,
                is_demo=True,
                warning="DEMO — NOT REAL AI DETECTION"
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "IMAGE_DECODE_ERROR", "message": f"Could not decode image payload: {str(e)}"}
            )

    async def check_health(self) -> Dict[str, Any]:
        return {
            "status": "demo_mode",
            "provider": "demo",
            "message": "Running in demonstration mode (clearly marked DEMO — NOT REAL AI DETECTION)",
            "ready": True
        }


def get_ai_provider() -> AIProvider:
    provider_name = (settings.AI_PROVIDER or "").lower().strip()
    if provider_name == "roboflow":
        return RoboflowMaskProvider()
    elif provider_name == "demo":
        return DemoProvider()
    elif provider_name == "unconfigured" or not settings.AI_API_KEY:
        return UnconfiguredProvider()
    else:
        # Default fallback
        return DemoProvider() if settings.ENVIRONMENT == "development" else UnconfiguredProvider()
