# AI Provider Configuration & Computer Vision Setup Guide

MaskGuard AI uses a decoupled provider adapter architecture.

## Supported Providers

### 1. Roboflow Computer Vision API (Production Recommended)
Roboflow hosts dedicated face-mask object detection models trained on tens of thousands of real-world multi-angle face images.

#### Setup Instructions:
1. Register for a free account at [Roboflow](https://roboflow.com).
2. Browse to [Roboflow Universe Face Mask Detection](https://universe.roboflow.com/search?q=face+mask).
3. Retrieve your Private API Key from **Settings > Roboflow API**.
4. Configure your `backend/.env`:
   ```bash
   AI_PROVIDER=roboflow
   AI_API_BASE_URL=https://detect.roboflow.com
   AI_API_KEY=your_actual_roboflow_api_key_here
   AI_MODEL=mask-wearing-detection/1
   AI_REQUEST_TIMEOUT_SECONDS=10.0
   ```
5. Restart the backend service. The application health endpoint (`/api/v1/health/ready`) will indicate `ready: true`.

---

### 2. Isolated Demo Provider (Local Development & Testing)
For rapid local testing without external API quotas or when working offline:
1. In `backend/.env`:
   ```bash
   AI_PROVIDER=demo
   ```
2. The Demo Provider analyzes real image brightness and lower-face contrast, generating realistic classifications.
3. Every response is watermarked with `"is_demo": true` and clearly displays the alert:
   `DEMO — NOT REAL AI DETECTION`
   in strict adherence to the safety specification.

---

### 3. Unconfigured Mode
If credentials are removed and `AI_PROVIDER=unconfigured`:
- The backend raises `503 Service Unavailable` with error code `AI_PROVIDER_NOT_CONFIGURED`.
- The frontend shows a clear diagnostic notice guiding the administrator on how to add their key.
