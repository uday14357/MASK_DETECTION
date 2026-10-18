# Production Deployment & Operations Guide

## 1. Prerequisites
- Docker & Docker Compose **or** Python 3.12+ and Node.js 18+
- MongoDB instance (MongoDB 6.0+ or MongoDB Atlas)
- SSL/TLS Certificate (Reverse proxy / Nginx / Traefik)

## 2. Docker Compose Deployment (Recommended)

1. Clone or extract the repository:
   ```bash
   cd "MASK DETECTION WEB APPLICATION"
   ```
2. Configure environment variables in `backend/.env` and `frontend/.env`.
3. Launch services:
   ```bash
   docker-compose up -d --build
   ```
4. Verify running containers:
   ```bash
   docker-compose ps
   ```
5. Access the application:
   - Frontend: `http://localhost:5173`
   - Backend API: `http://localhost:8000/api/v1`
   - API Docs: `http://localhost:8000/docs`

## 3. Manual Local Production Serving

### Backend
```bash
cd backend
python -m venv venv
.\venv\Scripts\activate     # Windows
source venv/bin/activate    # Linux/macOS
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Frontend
```bash
cd frontend
npm install
npm run build
npx serve -s dist -l 5173
```

## 4. Production Security Checklist
- Set `ENVIRONMENT=production` and `DEBUG=false`.
- Replace `SECRET_KEY` with a cryptographically generated 256-bit key:
  `openssl rand -hex 32`
- Ensure HTTPS termination on the reverse proxy.
- Restrict `CORS_ORIGINS` to the exact production domain.
- Implement automated MongoDB backup snapshots.
