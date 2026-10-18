# MaskGuard AI — API Contract & Endpoint Reference

All endpoints are versioned with the prefix `/api/v1`.

## 1. Authentication

### `POST /api/v1/auth/login`
- **Request Body**:
  ```json
  {
    "email": "admin@maskguard.ai",
    "password": "AdminMaskGuard2026!"
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "access_token": "eyJhbGciOi...",
    "token_type": "bearer",
    "expires_in": 28800,
    "user": {
      "_id": "uuid",
      "name": "System Administrator",
      "email": "admin@maskguard.ai",
      "role": "admin",
      "is_active": true,
      "created_at": "2026-10-18T00:00:00Z"
    }
  }
  ```

### `GET /api/v1/auth/me`
- **Headers**: `Authorization: Bearer <token>`
- **Response**: Current user profile.

---

## 2. Health & Diagnostics

### `GET /api/v1/health`
- **Response** (`200 OK`):
  ```json
  {
    "status": "healthy",
    "service": "MaskGuard AI API",
    "timestamp": "2026-10-18T06:00:00Z",
    "environment": "development"
  }
  ```

### `GET /api/v1/health/ready`
- **Response** (`200 OK`):
  ```json
  {
    "status": "ready",
    "database": { "status": "connected", "engine": "live_mongodb" },
    "ai_provider": { "name": "roboflow", "status": "configured", "ready": true, "model": "mask-wearing-detection/1" },
    "streaming_service": { "status": "requires_streaming_configuration", "rtsp_pipeline_ready": false }
  }
  ```

---

## 3. Detection Endpoints

### `POST /api/v1/detections/image`
- **Content-Type**: `multipart/form-data`
- **Form Fields**: `file` (image binary), `camera_id` (optional).
- **Normalized Response** (`200 OK`):
  ```json
  {
    "request_id": "8fa8d103-6cb2-491f-b528-9e585f9eb6e2",
    "processed_at": "2026-10-18T06:12:00Z",
    "source_type": "image_upload",
    "camera_id": null,
    "detections": [
      {
        "label": "mask",
        "confidence": 0.94,
        "bbox": {
          "x": 0.28,
          "y": 0.15,
          "width": 0.44,
          "height": 0.58,
          "coordinate_format": "normalized"
        }
      }
    ],
    "summary": {
      "faces_detected": 1,
      "mask_count": 1,
      "no_mask_count": 0,
      "uncertain_count": 0
    },
    "latency_ms": 112.5,
    "is_demo": false
  }
  ```

### `POST /api/v1/detections/frame`
- **Content-Type**: `application/json`
- **Request Body**:
  ```json
  {
    "image_base64": "data:image/jpeg;base64,/9j/4AAQ...",
    "source_type": "webcam",
    "camera_id": "cam-default-webcam"
  }
  ```
- **Response**: Normalized `DetectionResponse`.

---

## 4. Camera Management

### `GET /api/v1/cameras`
- Returns sanitized list of cameras. Credentials (`rtsp_url`) are stripped.

### `POST /api/v1/cameras`
- **Role Required**: `admin`
- **Request Body**: `name`, `location`, `camera_type`, `rtsp_url` (optional), `status`.

---

## 5. Events & Alerts

### `GET /api/v1/events`
- **Query Parameters**: `page`, `limit`, `status`, `acknowledged`, `start_date`, `end_date`, `search`.

### `PATCH /api/v1/events/{event_id}/acknowledge`
- Marks the alert as acknowledged by the current user.

### `GET /api/v1/events/export`
- Streams a filtered `.csv` file.

---

## 6. Analytics

- `GET /api/v1/analytics/summary?days=7`
- `GET /api/v1/analytics/trends?days=7`
- `GET /api/v1/analytics/cameras`
