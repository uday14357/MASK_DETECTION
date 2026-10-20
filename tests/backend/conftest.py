# pyrefly: ignore[missing-import]
import pytest
import os
import sys
from httpx import AsyncClient, ASGITransport

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backend"))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# pyrefly: ignore[missing-import]
from app.core.config import settings
# pyrefly: ignore[missing-import]
from app.database.connection import DatabaseManager
# pyrefly: ignore[missing-import]
from app.main import app, bootstrap_initial_data

settings.ENVIRONMENT = "test"
settings.AI_PROVIDER = "demo"

@pytest.fixture
async def client():
    await DatabaseManager.connect()
    await bootstrap_initial_data()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
