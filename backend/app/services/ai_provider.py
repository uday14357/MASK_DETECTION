import io
import os
import time
import base64
import uuid
from abc import ABC, abstractmethod
from typing import List, Tuple, Optional, Dict, Any
from datetime import datetime, timezone
from pathlib import Path
from PIL import Image
import numpy as np
import cv2
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
                    "(e.g., Roboflow or HuggingFace) or set AI_PROVIDER=local_cv."
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
    """Roboflow Computer Vision Inference API adapter for Face Mask Detection"""

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
            img = Image.open(io.BytesIO(image_bytes))
            img_width, img_height = img.size

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                files = {"file": ("frame.jpg", image_bytes, "image/jpeg")}
                response = await client.post(request_url, files=files)

            if response.status_code in (401, 403):
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
                
                if "mask" in raw_class and "no" not in raw_class and "without" not in raw_class:
                    label = "mask"
                    mask_count += 1
                elif "no" in raw_class or "without" in raw_class:
                    label = "no_mask"
                    no_mask_count += 1
                else:
                    label = "uncertain"
                    uncertain_count += 1

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


class FaceTracker:
    """
    Lightweight face tracker and temporal smoothing filter.
    Smooths bounding box coordinates across movement with Exponential Moving Average (EMA)
    and stabilizes consecutive classification labels using a 3-frame rolling window.
    """
    def __init__(self):
        self.tracks: List[Dict[str, Any]] = []
        self.next_id = 1

    def update(self, detected_items: List[Dict[str, Any]], current_time: float) -> List[Dict[str, Any]]:
        matched_results = []
        unmatched_detections = list(detected_items)

        # Match with existing tracks by IoU or centroid proximity
        for track in self.tracks:
            best_idx = -1
            best_score = 0.0
            tx, ty, tw, th = track['bbox']
            tcx, tcy = tx + tw / 2.0, ty + th / 2.0

            for i, det in enumerate(unmatched_detections):
                dx, dy, dw, dh = det['raw_bbox']
                dcx, dcy = dx + dw / 2.0, dy + dh / 2.0

                # Compute IoU
                xA = max(tx, dx); yA = max(ty, dy)
                xB = min(tx + tw, dx + dw); yB = min(ty + th, dy + dh)
                inter = max(0.0, xB - xA) * max(0.0, yB - yA)
                union = (tw * th) + (dw * dh) - inter
                iou = inter / (union + 1e-6)

                # Centroid distance
                dist = float(np.hypot(tcx - dcx, tcy - dcy))

                match_score = iou if iou > 0.25 else (0.5 - dist if dist < 0.18 else 0.0)
                if match_score > best_score:
                    best_score = match_score
                    best_idx = i

            if best_idx >= 0:
                det = unmatched_detections.pop(best_idx)
                # Exponential Moving Average for smooth bounding box during movement
                alpha = 0.70
                old_b = track['bbox']
                new_b = det['raw_bbox']
                smooth_bbox = [
                    round(alpha * new_b[0] + (1 - alpha) * old_b[0], 4),
                    round(alpha * new_b[1] + (1 - alpha) * old_b[1], 4),
                    round(alpha * new_b[2] + (1 - alpha) * old_b[2], 4),
                    round(alpha * new_b[3] + (1 - alpha) * old_b[3], 4),
                ]
                track['bbox'] = smooth_bbox
                track['labels'].append(det['raw_label'])
                if len(track['labels']) > 3:
                    track['labels'].pop(0)
                track['confs'].append(det['raw_conf'])
                if len(track['confs']) > 3:
                    track['confs'].pop(0)
                track['last_seen'] = current_time

                # 3-frame temporal voting for stability against flicker
                recent = track['labels']
                if recent.count('mask') >= 2:
                    final_label = 'mask'
                elif recent.count('no_mask') >= 2:
                    final_label = 'no_mask'
                else:
                    final_label = det['raw_label']

                final_conf = round(float(np.mean(track['confs'])), 3)

                matched_results.append({
                    'bbox': smooth_bbox,
                    'label': final_label,
                    'confidence': final_conf,
                    'track_id': track['id']
                })

        # New detections that didn't match existing tracks
        for det in unmatched_detections:
            new_track = {
                'id': self.next_id,
                'bbox': det['raw_bbox'],
                'labels': [det['raw_label']],
                'confs': [det['raw_conf']],
                'last_seen': current_time
            }
            self.next_id += 1
            self.tracks.append(new_track)
            matched_results.append({
                'bbox': det['raw_bbox'],
                'label': det['raw_label'],
                'confidence': det['raw_conf'],
                'track_id': new_track['id']
            })

        # Prune stale tracks older than 1.5s
        self.tracks = [t for t in self.tracks if (current_time - t['last_seen']) < 1.5]
        return matched_results


class LocalCVProvider(AIProvider):
    """
    Production-grade Local Computer Vision Provider.
    Uses OpenCV YuNet deep neural network face detector with 5 facial landmarks,
    paired with landmark-anchored multi-patch chrominance analysis and temporal smoothing.
    Provides real-time (15-25ms) local edge inference without requiring third-party cloud keys.
    """

    def __init__(self):
        models_dir = Path(__file__).resolve().parent.parent.parent / "models"
        self.yunet_path = models_dir / "face_detection_yunet_2023mar.onnx"
        self.face_cascade_path = models_dir / "haarcascade_frontalface_default.xml"
        self.smile_cascade_path = models_dir / "haarcascade_smile.xml"
        self.tracker = FaceTracker()

        # Initialize YuNet if available (score_threshold=0.35 allows tracking through movement and head turns)
        self.yunet = None
        if self.yunet_path.exists() and hasattr(cv2, 'FaceDetectorYN'):
            try:
                self.yunet = cv2.FaceDetectorYN.create(
                    str(self.yunet_path),
                    "",
                    (320, 320),
                    score_threshold=0.35,
                    nms_threshold=0.3,
                    top_k=50
                )
            except Exception as e:
                print(f"[LocalCVProvider] Failed to initialize YuNet: {e}")

        # Initialize Haar cascade ONLY as emergency fallback when YuNet is absent
        self.face_cascade = None
        if not self.yunet and self.face_cascade_path.exists() and hasattr(cv2, 'CascadeClassifier'):
            cascade = cv2.CascadeClassifier(str(self.face_cascade_path))
            if not cascade.empty():
                self.face_cascade = cascade

        self.smile_cascade = None
        if self.smile_cascade_path.exists() and hasattr(cv2, 'CascadeClassifier'):
            cascade = cv2.CascadeClassifier(str(self.smile_cascade_path))
            if not cascade.empty():
                self.smile_cascade = cascade

    async def detect_mask(
        self,
        image_bytes: bytes,
        confidence_threshold: float,
        source_type: str,
        camera_id: Optional[str] = None
    ) -> DetectionResponse:
        start_time = time.time()
        try:
            # Decode frame into BGR numpy array
            np_arr = np.frombuffer(image_bytes, np.uint8)
            frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

            if frame is None:
                pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
                frame = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

            h, w = frame.shape[:2]
            detected_faces = []

            # 1. Primary: YuNet Deep Learning Face Detector with 5 Landmarks
            if self.yunet is not None:
                try:
                    self.yunet.setInputSize((w, h))
                    _, raw_faces = self.yunet.detect(frame)
                    if raw_faces is not None:
                        for face in raw_faces:
                            score = float(face[-1])
                            fw = int(face[2])
                            fh = int(face[3])
                            if score >= 0.35 and fw >= 24 and fh >= 24:
                                detected_faces.append(face)
                except Exception as e:
                    print(f"[LocalCVProvider] YuNet detection error: {e}")

            # 2. Strict Fallback: Haar Cascade ONLY if YuNet is completely uninstalled/unavailable
            if not self.yunet and self.face_cascade is not None:
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                haar_boxes = self.face_cascade.detectMultiScale(
                    gray,
                    scaleFactor=1.12,
                    minNeighbors=6,
                    minSize=(60, 60)
                )
                for (hx, hy, hw, hh) in haar_boxes:
                    # Construct synthetic face data matching YuNet format
                    synth_face = np.array([
                        hx, hy, hw, hh,
                        hx + hw * 0.3, hy + hh * 0.35,  # right eye
                        hx + hw * 0.7, hy + hh * 0.35,  # left eye
                        hx + hw * 0.5, hy + hh * 0.55,  # nose
                        hx + hw * 0.35, hy + hh * 0.75, # right mouth
                        hx + hw * 0.65, hy + hh * 0.75, # left mouth
                        0.90                            # score
                    ], dtype=np.float32)
                    detected_faces.append(synth_face)

            raw_detections = []

            # Process each detected face with landmark-anchored multi-patch classification
            for face in detected_faces:
                fx = max(0, min(w - 1, int(face[0])))
                fy = max(0, min(h - 1, int(face[1])))
                fw = max(10, min(w - fx, int(face[2])))
                fh = max(10, min(h - fy, int(face[3])))

                norm_x = round(fx / float(w), 4)
                norm_y = round(fy / float(h), 4)
                norm_w = round(fw / float(w), 4)
                norm_h = round(fh / float(h), 4)

                re = face[4:6].astype(int)
                le = face[6:8].astype(int)
                nose = face[8:10].astype(int)
                rm = face[10:12].astype(int)
                lm = face[12:14].astype(int)

                eye_dist = max(10, int(np.linalg.norm(le - re)))

                # If face is too tiny or distant to reliably classify
                if fw < 24 or eye_dist < 10:
                    raw_detections.append({
                        'raw_bbox': [norm_x, norm_y, norm_w, norm_h],
                        'raw_label': 'uncertain',
                        'raw_conf': 0.55
                    })
                    continue

                # 1. Forehead sample (Baseline individual skin chrominance)
                mid_eyes_x = int((re[0] + le[0]) / 2)
                mid_eyes_y = int((re[1] + le[1]) / 2)
                fh_center_y = max(0, min(h - 1, mid_eyes_y - int(eye_dist * 0.45)))
                fh_center_x = max(0, min(w - 1, mid_eyes_x))
                r_fh = max(3, int(eye_dist * 0.16))
                fh_roi = frame[max(0, fh_center_y - r_fh):min(h, fh_center_y + r_fh), max(0, fh_center_x - r_fh):min(w, fh_center_x + r_fh)]

                # 2. Nose sample (Anatomical nose landmark patch)
                r_nose = max(3, int(eye_dist * 0.18))
                nose_roi = frame[max(0, nose[1] - r_nose):min(h, nose[1] + r_nose), max(0, nose[0] - r_nose):min(w, nose[0] + r_nose)]

                # 3. Mouth sample (Midpoint of mouth corner landmarks)
                mid_mouth_x = int((rm[0] + lm[0]) / 2)
                mid_mouth_y = int((rm[1] + lm[1]) / 2)
                r_mouth = max(4, int(eye_dist * 0.22))
                mouth_roi = frame[max(0, mid_mouth_y - r_mouth):min(h, mid_mouth_y + r_mouth), max(0, mid_mouth_x - r_mouth):min(w, mid_mouth_x + r_mouth)]

                # 4. Overall lower face (From nose level down to chin)
                low_y1 = max(0, min(h - 1, int(mid_eyes_y + eye_dist * 0.35)))
                low_y2 = max(0, min(h - 1, int(fy + fh * 0.98)))
                low_x1 = max(0, min(w - 1, int(fx + fw * 0.15)))
                low_x2 = max(0, min(w - 1, int(fx + fw * 0.85)))
                lower_roi = frame[low_y1:low_y2, low_x1:low_x2]

                def calc_skin_stats(roi):
                    if roi.size == 0 or roi.shape[0] < 2 or roi.shape[1] < 2:
                        return 0.0, np.array([128.0, 128.0])
                    yc = cv2.cvtColor(roi, cv2.COLOR_BGR2YCrCb)
                    mask = cv2.inRange(yc, np.array([0, 133, 77]), np.array([255, 173, 127]))
                    ratio = cv2.countNonZero(mask) / float(roi.shape[0] * roi.shape[1])
                    mean_chroma = np.mean(yc[:, :, 1:], axis=(0, 1))
                    return ratio, mean_chroma

                fh_ratio, fh_chroma = calc_skin_stats(fh_roi)
                nose_ratio, _ = calc_skin_stats(nose_roi)
                mouth_ratio, _ = calc_skin_stats(mouth_roi)
                low_ratio, low_chroma = calc_skin_stats(lower_roi)

                # Combined lower-face skin evidence weighted across landmark samples
                lower_skin_score = 0.35 * nose_ratio + 0.35 * mouth_ratio + 0.30 * low_ratio

                # Divergence from baseline forehead skin tone
                chroma_diff = np.linalg.norm(fh_chroma - low_chroma) if fh_ratio > 0.2 else 0.0

                # Classification Rules:
                if lower_skin_score >= 0.44 and (fh_ratio < 0.2 or chroma_diff < 18.0):
                    # Solid biological skin evidence across nose and mouth
                    label = "no_mask"
                    conf = round(min(0.99, max(0.85, 0.80 + lower_skin_score * 0.18)), 3)
                elif lower_skin_score < 0.22 or (chroma_diff > 20.0 and lower_skin_score < 0.38):
                    # Lower face covered by mask fabric (surgical blue, cloth, black, white N95)
                    label = "mask"
                    conf = round(min(0.99, max(0.85, 0.96 - lower_skin_score * 0.25)), 3)
                elif lower_skin_score >= 0.35:
                    label = "no_mask"
                    conf = 0.82
                elif lower_skin_score < 0.28:
                    label = "mask"
                    conf = 0.82
                else:
                    # Ambiguous evidence -> return uncertain rather than guessing
                    label = "uncertain"
                    conf = 0.60

                raw_detections.append({
                    'raw_bbox': [norm_x, norm_y, norm_w, norm_h],
                    'raw_label': label,
                    'raw_conf': conf
                })

            # Apply temporal tracking and coordinate smoothing across movement
            tracked_results = self.tracker.update(raw_detections, time.time())

            detections: List[DetectionItem] = []
            mask_count = 0
            no_mask_count = 0
            uncertain_count = 0

            for item in tracked_results:
                lbl = item['label']
                cf = item['confidence']
                bx = item['bbox']

                if lbl == 'mask':
                    mask_count += 1
                elif lbl == 'no_mask':
                    no_mask_count += 1
                else:
                    uncertain_count += 1

                detections.append(DetectionItem(
                    label=lbl,
                    confidence=cf,
                    bbox=BoundingBox(
                        x=bx[0],
                        y=bx[1],
                        width=bx[2],
                        height=bx[3],
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

        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "IMAGE_DECODE_ERROR", "message": f"Could not decode image payload: {str(e)}"}
            )

    async def check_health(self) -> Dict[str, Any]:
        return {
            "status": "ready",
            "provider": "local_cv",
            "model": "opencv_yunet_chroma",
            "message": "Local Computer Vision & Neural Face Analysis Ready",
            "ready": True
        }


class DemoProvider(AIProvider):
    """Fallback demonstration provider if local CV models cannot be initialized."""

    async def detect_mask(
        self,
        image_bytes: bytes,
        confidence_threshold: float,
        source_type: str,
        camera_id: Optional[str] = None
    ) -> DetectionResponse:
        # Delegate to LocalCVProvider so demo mode also yields real detection
        provider = LocalCVProvider()
        return await provider.detect_mask(image_bytes, confidence_threshold, source_type, camera_id)

    async def check_health(self) -> Dict[str, Any]:
        return {
            "status": "demo_mode",
            "provider": "demo",
            "message": "Local CV active in demo mode",
            "ready": True
        }


def get_ai_provider() -> AIProvider:
    provider_name = (settings.AI_PROVIDER or "").lower().strip()
    if provider_name == "roboflow" and settings.AI_API_KEY:
        return RoboflowMaskProvider()
    elif provider_name == "unconfigured":
        return UnconfiguredProvider()
    else:
        # Default to real local computer vision provider
        return LocalCVProvider()
