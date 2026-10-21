# Mask Detection System — Smart Face Mask Monitoring

> **“Smarter Monitoring. Safer Spaces.”**

Mask Detection System is a full-stack, enterprise-grade face-mask compliance and computer-vision monitoring application. Engineered for healthcare facilities, research cleanrooms, schools, and commercial workspaces, it pairs high-precision computer vision inference with automated alert management, deduplication cooldowns, audit trails, and compliance reporting.

---

## Key Features

1. **Live Camera Monitoring** (`/live-detection`):
   - Real-time webcam streaming via HTML5 Video and WebRTC MediaDevices API.
   - Dynamic canvas overlays rendering pixel-aligned bounding boxes:
     - **Green (`#16A34A`)**: Mask Detected
     - **Red (`#DC2626`)**: No Mask Detected
     - **Amber (`#F59E0B`)**: Uncertain Classification
   - Sequential, throttled frame transmission preventing network congestion and API quota exhaustion.
   - Mirrored preview toggle with canvas coordinate recalculation.
   - Resource lifecycle management releasing all media tracks upon stop or page navigation.

2. **Image Upload Analysis** (`/image-analysis`):
   - Drag-and-drop file upload for JPEG, PNG, and WebP images up to 10 MB.
   - Per-face bounding boxes and confidence score breakdowns.

3. **Analytics & Compliance Dashboard** (`/dashboard` & `/analytics`):
   - Facility-wide compliance percentage:
     $$\text{Mask Percentage} = \frac{\text{Mask Count}}{\text{Mask Count} + \text{No-Mask Count}} \times 100$$
   - Trend charts using Recharts for daily and weekly volume breakdowns.
   - Camera location comparisons.
   - Single-click CSV audit report export.

4. **Alerts & Event Management** (`/events`):
   - Configurable deduplication cooldown window (default 15s) suppressing alert floods.
   - Date range, status, and acknowledgement filtering with search and pagination.
   - Local timezone formatting from UTC database timestamps.

5. **Security & Role-Based Access Control** (`/users` & `/settings`):
   - Argon2id password hashing and stateless JWT bearer authentication.
   - Roles: `admin` and `operator`.
   - Built-in safeguard preventing deactivation or demotion of the final active administrator.
   - Camera stream credentials (RTSP secrets) never leaked in API responses.

---

## Technology Stack

- **Frontend**: React 18, Vite, Tailwind CSS, React Router, Lucide React, Recharts.
- **Backend**: Python 3.12 / 3.14, FastAPI, Pydantic v2, Uvicorn, Motor, HTTPX, Argon2-cffi, PyJWT.
- **Database**: MongoDB (with zero-configuration high-performance embedded fallback datastore).
- **Testing**: Pytest, Pytest-asyncio, HTTPX.

---

## Quick Start Guide

### 1. Prerequisites
- Node.js v18+ and npm
- Python 3.12+ (Python 3.14 compatible)
- (Optional) MongoDB local service or Docker

### 2. Backend Setup

```bash
# Navigate to backend
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the backend server
uvicorn app.main:app --reload --port 8000
```
The backend API will start at `http://localhost:8000`.
Interactive Swagger API documentation is available at `http://localhost:8000/docs`.

### 3. Frontend Setup

In a new terminal window:
```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```
The frontend application will be live at `http://localhost:5173`.

---

## Default Administrator Credentials

Upon first startup, the application bootstraps a default system administrator account:

- **Email**: `admin@maskguard.ai`
- **Password**: `AdminMaskGuard2026!`
- **Role**: `admin`

*(A 1-click "Autofill Credentials" button is also provided on the `/login` screen for rapid testing).*

---

## AI Computer Vision Configuration

In `backend/.env`, configure the desired AI provider:

```bash
# To use Roboflow's live face mask inference model:
AI_PROVIDER=roboflow
AI_API_BASE_URL=https://detect.roboflow.com
AI_API_KEY=your_roboflow_private_api_key
AI_MODEL=mask-wearing-detection/1

# For rapid offline testing with realistic contrast detection:
AI_PROVIDER=demo
```

---

## Automated Test Execution

Run the backend test suite:
```bash
# From the project root with the virtualenv active:
.\backend\venv\Scripts\pytest tests/backend -v
```

All 8 core test suites will execute, verifying health checks, password hashing, authentication flow, image uploads, webcam frame processing, camera management, event filters, analytics, and last-admin security constraints.

---

## Project Structure

```
maskguard-ai/
├── backend/
│   ├── app/
│   │   ├── api/          # REST route handlers (auth, detections, cameras, events, etc.)
│   │   ├── core/         # Config, security, JWT, Argon2 hashing
│   │   ├── database/     # MongoDB connector with auto-fallback engine
│   │   ├── schemas/      # Pydantic validation schemas
│   │   ├── services/     # Detection service & AI provider adapters
│   │   └── main.py       # FastAPI application and bootstrap lifespan
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/   # BoundingBoxCanvas, StatCard, ProtectedRoute
│   │   ├── context/      # AuthContext
│   │   ├── layouts/      # AppLayout (Responsive sidebar & navigation)
│   │   ├── pages/        # 11 complete application pages
│   │   ├── services/     # Unified ApiClient
│   │   ├── index.css
│   │   └── App.jsx
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── Dockerfile
├── tests/
│   └── backend/          # Pytest test suite
├── docs/                 # Architecture, API reference, AI setup, Security & Privacy
├── docker-compose.yml
└── README.md
```

---

## License & Compliance Disclaimer

Mask Detection System is designed as an assistance and safety monitoring tool. It does not provide medical certification, guarantee compliance, or replace qualified human judgment.
