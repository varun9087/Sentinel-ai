# Sentinel AI Deployment Guide

## 1. Production Configuration Checklist

Before deploying Sentinel AI to production:
- [ ] Set `ENVIRONMENT=production` in `.env`.
- [ ] Generate a high-entropy `SECRET_KEY` using `openssl rand -hex 32`.
- [ ] Configure a production PostgreSQL database instance.
- [ ] Update `BACKEND_CORS_ORIGINS` to permit only your production frontend domain.
- [ ] Ensure HTTPS/TLS is configured at your reverse proxy or load balancer.
- [ ] Set up persistent Docker volumes or managed cloud disks for database storage.

---

## 2. Docker Compose Deployment (Recommended)

### Prerequisites
- Docker Engine 24.0+
- Docker Compose v2.20+

### Steps
1. Clone the repository:
   ```bash
   git clone https://github.com/your-org/sentinel-ai.git
   cd sentinel-ai
   ```
2. Copy and customize the production environment file:
   ```bash
   cp .env.example .env
   # Edit .env with your production credentials
   ```
3. Build and launch all services:
   ```bash
   docker compose up -d --build
   ```
4. Verify container health:
   ```bash
   docker compose ps
   curl -f http://localhost:8000/health
   ```
5. Access the web application at `http://localhost:3000`.

---

## 3. Local Bare-Metal / Native Deployment

### Backend Setup
1. Create and activate a Python 3.13 virtual environment:
   ```bash
   python -m venv venv
   # Windows:
   .\venv\Scripts\activate
   # Linux/macOS:
   source venv/bin/activate
   ```
2. Install backend dependencies and SDK:
   ```bash
   pip install -r backend/requirements.txt
   pip install -e sdk
   ```
3. Run database migrations:
   ```bash
   alembic upgrade head
   ```
4. Launch backend API server:
   ```bash
   uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

### Frontend Setup
1. Install Node.js dependencies:
   ```bash
   cd frontend
   npm install
   ```
2. Launch development dev server or production preview:
   ```bash
   npm run dev
   # Production build:
   npm run build
   npm run preview
   ```
3. Open `http://localhost:5173` in your browser.
