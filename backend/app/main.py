import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.security import hash_password
from app.database.connection import DatabaseManager, get_collection

# Import routers
from app.api.auth import router as auth_router
from app.api.health import router as health_router
from app.api.detections import router as detections_router
from app.api.cameras import router as cameras_router
from app.api.events import router as events_router
from app.api.analytics import router as analytics_router
from app.api.users import router as users_router
from app.api.settings import router as settings_router

async def bootstrap_initial_data():
    """Bootstrap admin account and initial camera if database is empty"""
    users_col = get_collection("users")
    admin_count = await users_col.count_documents({"role": "admin"})
    now_str = datetime.now(timezone.utc).isoformat()

    if admin_count == 0:
        admin_doc = {
            "_id": str(uuid.uuid4()),
            "name": settings.BOOTSTRAP_ADMIN_NAME,
            "email": settings.BOOTSTRAP_ADMIN_EMAIL.lower().strip(),
            "password_hash": hash_password(settings.BOOTSTRAP_ADMIN_PASSWORD),
            "role": "admin",
            "is_active": True,
            "created_at": now_str,
            "updated_at": now_str,
            "last_login_at": None
        }
        await users_col.insert_one(admin_doc)
        print(f"[Bootstrap] Initial admin created: {settings.BOOTSTRAP_ADMIN_EMAIL}")

    # Bootstrap default camera
    cameras_col = get_collection("cameras")
    cam_count = await cameras_col.count_documents({})
    if cam_count == 0:
        default_cam = {
            "_id": "cam-default-webcam",
            "name": "Front Desk Laptop Camera",
            "location": "Main Entrance Lobby",
            "camera_type": "webcam",
            "status": "active",
            "rtsp_url": None,
            "created_at": now_str,
            "updated_at": now_str,
            "last_seen_at": None
        }
        await cameras_col.insert_one(default_cam)

    # Bootstrap settings
    settings_col = get_collection("settings")
    existing_settings = await settings_col.find_one({"scope": "global"})
    if not existing_settings:
        await settings_col.insert_one({
            "_id": "global-settings",
            "scope": "global",
            "confidence_threshold": settings.CONFIDENCE_THRESHOLD,
            "alert_cooldown_seconds": settings.ALERT_COOLDOWN_SECONDS,
            "frame_interval_ms": settings.FRAME_INTERVAL_MS,
            "retention_days": settings.RETENTION_DAYS,
            "image_retention_enabled": settings.IMAGE_RETENTION_ENABLED,
            "created_at": now_str,
            "updated_at": now_str
        })

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await DatabaseManager.connect()
    await bootstrap_initial_data()
    yield
    # Shutdown
    await DatabaseManager.close()

app = FastAPI(
    title="Mask Detection System API",
    description="Enterprise Smart Face Mask Monitoring & Computer Vision System",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers under /api/v1
API_PREFIX = "/api/v1"
app.include_router(health_router, prefix=API_PREFIX)
app.include_router(auth_router, prefix=API_PREFIX)
app.include_router(detections_router, prefix=API_PREFIX)
app.include_router(cameras_router, prefix=API_PREFIX)
app.include_router(events_router, prefix=API_PREFIX)
app.include_router(analytics_router, prefix=API_PREFIX)
app.include_router(users_router, prefix=API_PREFIX)
app.include_router(settings_router, prefix=API_PREFIX)
