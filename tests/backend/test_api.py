import io
import pytest
import base64
from PIL import Image
from app.core.security import hash_password, verify_password

@pytest.fixture
def test_image_bytes():
    img = Image.new("RGB", (320, 240), color=(180, 200, 220))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()

@pytest.fixture
def test_image_base64(test_image_bytes):
    return base64.b64encode(test_image_bytes).decode("utf-8")

@pytest.mark.asyncio
async def test_health_endpoints(client):
    # Basic health
    res = await client.get("/api/v1/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert "timestamp" in data

    # Readiness
    res_ready = await client.get("/api/v1/health/ready")
    assert res_ready.status_code == 200
    data_ready = res_ready.json()
    assert data_ready["status"] == "ready"
    assert "database" in data_ready
    assert "ai_provider" in data_ready

def test_security_passwords():
    raw_pass = "SecureAdmin2026!#"
    hashed = hash_password(raw_pass)
    assert hashed != raw_pass
    assert verify_password(raw_pass, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False

@pytest.mark.asyncio
async def test_auth_flow(client):
    # Invalid login
    res_fail = await client.post("/api/v1/auth/login", json={
        "email": "nonexistent@maskguard.ai",
        "password": "WrongPassword123"
    })
    assert res_fail.status_code == 401
    assert res_fail.json()["detail"]["code"] == "INVALID_CREDENTIALS"

    # Valid login with bootstrapped admin
    res_ok = await client.post("/api/v1/auth/login", json={
        "email": "admin@maskguard.ai",
        "password": "AdminMaskGuard2026!"
    })
    assert res_ok.status_code == 200
    auth_data = res_ok.json()
    assert "access_token" in auth_data
    assert auth_data["user"]["role"] == "admin"
    token = auth_data["access_token"]

    # Access /me
    res_me = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res_me.status_code == 200
    assert res_me.json()["email"] == "admin@maskguard.ai"

@pytest.mark.asyncio
async def test_detection_image_upload(client, test_image_bytes):
    login_res = await client.post("/api/v1/auth/login", json={
        "email": "admin@maskguard.ai",
        "password": "AdminMaskGuard2026!"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    files = {"file": ("test.jpg", test_image_bytes, "image/jpeg")}
    res = await client.post("/api/v1/detections/image", files=files, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "request_id" in data
    assert "detections" in data
    assert "summary" in data
    assert isinstance(data["detections"], list)
    assert "faces_detected" in data["summary"]
    if len(data["detections"]) > 0:
        first = data["detections"][0]
        assert first["label"] in ["mask", "no_mask", "uncertain"]
        assert 0.0 <= first["confidence"] <= 1.0
        assert "bbox" in first
        assert 0.0 <= first["bbox"]["x"] <= 1.0

@pytest.mark.asyncio
async def test_detection_frame_webcam(client, test_image_base64):
    login_res = await client.post("/api/v1/auth/login", json={
        "email": "admin@maskguard.ai",
        "password": "AdminMaskGuard2026!"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "image_base64": f"data:image/jpeg;base64,{test_image_base64}",
        "source_type": "webcam",
        "camera_id": "cam-default-webcam"
    }
    res = await client.post("/api/v1/detections/frame", json=payload, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["source_type"] == "webcam"
    assert data["camera_id"] == "cam-default-webcam"

@pytest.mark.asyncio
async def test_camera_management(client):
    login_res = await client.post("/api/v1/auth/login", json={
        "email": "admin@maskguard.ai",
        "password": "AdminMaskGuard2026!"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # List cameras
    list_res = await client.get("/api/v1/cameras", headers=headers)
    assert list_res.status_code == 200
    cams = list_res.json()
    assert len(cams) >= 1

    # Create new camera
    create_res = await client.post("/api/v1/cameras", json={
        "name": "ICU Entrance Camera",
        "location": "Ward B - 2nd Floor",
        "camera_type": "webcam",
        "status": "active"
    }, headers=headers)
    assert create_res.status_code == 201
    new_cam = create_res.json()
    assert new_cam["name"] == "ICU Entrance Camera"

    # IP camera marks status safely
    ip_res = await client.post("/api/v1/cameras", json={
        "name": "CCTV Hallway",
        "location": "North Corridor",
        "camera_type": "ip_camera",
        "rtsp_url": "rtsp://admin:secret123@192.168.1.100:554/stream1"
    }, headers=headers)
    assert ip_res.status_code == 201
    ip_cam = ip_res.json()
    assert ip_cam["status"] == "requires_streaming_configuration"
    assert "rtsp_url" not in ip_cam

@pytest.mark.asyncio
async def test_events_and_analytics(client):
    login_res = await client.post("/api/v1/auth/login", json={
        "email": "admin@maskguard.ai",
        "password": "AdminMaskGuard2026!"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Query events
    events_res = await client.get("/api/v1/events", headers=headers)
    assert events_res.status_code == 200
    ev_data = events_res.json()
    assert "events" in ev_data
    assert "total" in ev_data

    # Analytics summary
    summary_res = await client.get("/api/v1/analytics/summary", headers=headers)
    assert summary_res.status_code == 200
    summary = summary_res.json()
    assert "mask_percentage" in summary
    assert "total_events" in summary

    # Analytics trends
    trends_res = await client.get("/api/v1/analytics/trends?days=7", headers=headers)
    assert trends_res.status_code == 200
    assert "trends" in trends_res.json()

    # CSV export
    export_res = await client.get("/api/v1/events/export", headers=headers)
    assert export_res.status_code == 200
    assert "text/csv" in export_res.headers.get("content-type", "")

@pytest.mark.asyncio
async def test_user_management_and_admin_protection(client):
    login_res = await client.post("/api/v1/auth/login", json={
        "email": "admin@maskguard.ai",
        "password": "AdminMaskGuard2026!"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create operator user
    user_res = await client.post("/api/v1/users", json={
        "name": "Safety Officer Jane",
        "email": "jane.safety@maskguard.ai",
        "password": "PasswordJane123!",
        "role": "operator"
    }, headers=headers)
    assert user_res.status_code == 201
    jane = user_res.json()
    assert jane["role"] == "operator"

    # Attempt to deactivate the only admin
    admin_id = login_res.json()["user"]["_id"]
    deact_res = await client.patch(f"/api/v1/users/{admin_id}", json={"is_active": False}, headers=headers)
    assert deact_res.status_code == 400
    assert deact_res.json()["detail"]["code"] == "CANNOT_DEACTIVATE_LAST_ADMIN"
