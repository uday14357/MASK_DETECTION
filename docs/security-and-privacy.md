# Security, Authorization & Privacy Policy Specification

## 1. Authentication & Session Integrity
- **Password Protection**: Passwords are hashed using the state-of-the-art **Argon2id** algorithm (`argon2-cffi`), highly resilient against GPU and ASIC cracking attacks.
- **Stateless Tokens**: Signed using HS256 JWT tokens containing expiration (`exp`) and role claims.
- **Client Security**: Tokens are maintained in session memory or `sessionStorage`, cleared upon logout or expiration.

## 2. Role-Based Access Control (RBAC)
Two standard roles are supported:
- `admin`: Full administrative control (manage users, configure cameras, adjust system settings, manage events).
- `operator`: Monitoring control (view live cameras, inspect detection events, acknowledge alert incidents).

Backend endpoints explicitly enforce RBAC with `require_role(["admin"])`. Hiding buttons on the client is never considered a substitute for backend authorization.

### Last Administrator Protection
The system enforces strict safeguards preventing deactivation or demotion of the final active administrator account.

## 3. Privacy by Design
- **No Biometric Face Indexing**: The system does NOT perform facial identification, biometric landmark storage, or cross-camera tracking.
- **Volatile Processing**: Frames sent for live webcam detection are processed in memory and released immediately. Raw image snapshot retention is disabled by default (`IMAGE_RETENTION_ENABLED=false`).
- **Camera Access Controls**: The MediaDevices API is accessed only after explicit user intent (clicking "Start Camera"). Every active track is stopped upon stopping or navigating away.

## 4. Protected Camera Credentials
RTSP connection URLs containing passwords (`rtsp://user:pass@host/`) are never returned in public API responses. The API sanitizes all camera objects to return only metadata and connection status.
