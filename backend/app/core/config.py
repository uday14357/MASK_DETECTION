import os
from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    PORT: int = 8000
    HOST: str = "0.0.0.0"

    # Database
    MONGODB_URI: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "maskguard_db"

    # Security
    SECRET_KEY: str = "maskguard-production-secret-change-in-prod-super-secure-key-2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000"

    # AI Computer Vision Provider Configuration
    # Supported: 'roboflow', 'huggingface', 'local_cv', 'unconfigured', 'demo'
    AI_PROVIDER: str = "demo"
    AI_API_BASE_URL: str = "https://detect.roboflow.com"
    AI_API_KEY: Optional[str] = None
    AI_MODEL: str = "mask-wearing-detection/1"
    AI_REQUEST_TIMEOUT_SECONDS: float = 10.0

    # Detection & Event Settings
    CONFIDENCE_THRESHOLD: float = 0.60
    ALERT_COOLDOWN_SECONDS: int = 15
    FRAME_INTERVAL_MS: int = 800
    RETENTION_DAYS: int = 30
    IMAGE_RETENTION_ENABLED: bool = False
    MAX_UPLOAD_SIZE_MB: int = 10

    # Admin Bootstrap
    BOOTSTRAP_ADMIN_EMAIL: str = "admin@maskguard.ai"
    BOOTSTRAP_ADMIN_PASSWORD: str = "AdminMaskGuard2026!"
    BOOTSTRAP_ADMIN_NAME: str = "System Administrator"

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()
