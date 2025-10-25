# Mentora Docker Setup Guide

## Architecture Overview

Mentora uses a multi-service Docker architecture with frontend and backend services communicating over a shared network.

```
┌──────────────────────────────────────────────────────────────┐
│                      Docker Environment                       │
│                    (mentora-network)                         │
│                                                              │
│  ┌─────────────────────────┐    ┌─────────────────────────┐ │
│  │   Frontend Container    │    │   Backend Container     │ │
│  │  (mentora-frontend)     │    │  (mentora-backend)      │ │
│  │                         │    │                         │ │
│  │  Port: 3001             │───▶│  Port: 3000            │ │
│  │                         │    │                         │ │
│  │  Tech Stack:            │    │  Tech Stack:            │ │
│  │  - Next.js 14           │    │  - Next.js 14           │ │
│  │  - React 18             │    │  - API Routes           │ │
│  │  - D3.js (canvas)       │    │  - Claude Sonnet 4.5    │ │
│  │  - Zustand (state)      │    │  - OpenAI Whisper       │ │
│  │  - TanStack Query       │    │  - OpenAI TTS           │ │
│  │                         │    │  - In-memory storage    │ │
│  │  API Calls:             │    │                         │ │
│  │  GET/POST to backend    │    │  Endpoints:             │ │
│  │  http://backend:3000    │    │  /api/health            │ │
│  │                         │    │  /api/sessions          │ │
│  │                         │    │  /api/qa                │ │
│  │                         │    │  /api/transcript        │ │
│  └─────────────────────────┘    └─────────────────────────┘ │
│           ▲                              ▲                    │
└───────────┼──────────────────────────────┼────────────────────┘
            │                              │
       Port 3001                      Port 3000
            │                              │
    ┌───────▼──────────────────────────────▼──────────┐
    │              Host Machine                       │
    │         (Your Development Computer)             │
    │                                                  │
    │  http://localhost:3001  →  Frontend UI          │
    │  http://localhost:3000  →  Backend API          │
    └──────────────────────────────────────────────────┘
```

## Service Configuration

### Frontend Service

**Container Name:** `mentora-frontend`
**Port:** 3001 (host) → 3001 (container)
**Build Context:** `./apps/web`
**Dockerfile:** `apps/web/Dockerfile`

**Environment Variables:**
```env
NEXT_PUBLIC_API_URL=http://localhost:3000  # Backend API URL
NODE_ENV=development
PORT=3001
```

**Features:**
- Hot-reload enabled in development
- Volume mounts for live code changes
- Depends on backend (waits for backend to be ready)
- Auto-restart on crash

### Backend Service

**Container Name:** `mentora-backend`
**Port:** 3000 (host) → 3000 (container)
**Build Context:** `.` (root directory)
**Dockerfile:** `./Dockerfile`

**Environment Variables:**
```env
OPENAI_API_KEY=${OPENAI_API_KEY}        # From .env file
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}  # From .env file
NODE_ENV=development
LOG_LEVEL=info
PORT=3000
```

**Features:**
- Health check endpoint (`/api/health`)
- Hot-reload enabled in development
- Volume mounts for live code changes
- Auto-restart on crash

## Docker Files

### 1. docker-compose.yml (Development)

**Purpose:** Development environment with hot-reload

**Key Features:**
- Both services mount source code as volumes
- Changes reflected immediately without rebuild
- Development build targets
- Verbose logging

**Usage:**
```bash
docker-compose up
```

### 2. docker-compose.prod.yml (Production)

**Purpose:** Optimized production deployment

**Key Features:**
- Production build targets (optimized, minified)
- No volume mounts (uses built artifacts)
- Health check-based startup ordering
- Always restart policy
- Resource optimization

**Usage:**
```bash
docker-compose -f docker-compose.prod.yml up
```

### 3. Backend Dockerfile

**Multi-stage build with 4 stages:**

1. **base**: Node.js 20 Alpine base image
2. **deps**: Install dependencies only
3. **dev**: Development stage with source code
4. **builder**: Build production artifacts
5. **runner**: Production runtime (minimal)

**Build Targets:**
```bash
# Development
docker build --target dev -t mentora-backend:dev .

# Production
docker build --target runner -t mentora-backend:prod .
```

### 4. Frontend Dockerfile

**Multi-stage build with 4 stages:**

1. **base**: Node.js 20 Alpine base image
2. **deps**: Install dependencies only
3. **dev**: Development stage with source code
4. **builder**: Build production artifacts
5. **runner**: Production runtime (minimal)

**Build Targets:**
```bash
# Development
cd apps/web
docker build --target dev -t mentora-frontend:dev .

# Production
docker build --target runner -t mentora-frontend:prod .
```

## Network Configuration

**Network Name:** `mentora-network`
**Driver:** Bridge

**How It Works:**
- Both containers join the same Docker network
- Frontend can reach backend via `http://backend:3000`
- Backend can reach frontend via `http://frontend:3001`
- Host can reach both via `localhost:3000` and `localhost:3001`

**DNS Resolution:**
- Container names are used as hostnames
- `backend` resolves to backend container IP
- `frontend` resolves to frontend container IP

## Common Commands

### Start Services

```bash
# Development (hot-reload)
docker-compose up

# Production
docker-compose -f docker-compose.prod.yml up

# Detached mode (background)
docker-compose up -d

# View logs
docker-compose logs -f

# View logs for specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Stop Services

```bash
# Stop containers
docker-compose down

# Stop and remove volumes
docker-compose down -v

# Stop production
docker-compose -f docker-compose.prod.yml down
```

### Build & Rebuild

```bash
# Build all services
docker-compose build

# Build specific service
docker-compose build backend
docker-compose build frontend

# Rebuild without cache
docker-compose build --no-cache

# Build and start
docker-compose up --build
```

### Inspect Services

```bash
# List running containers
docker-compose ps

# View container logs
docker logs mentora-backend
docker logs mentora-frontend

# Enter container shell
docker exec -it mentora-backend sh
docker exec -it mentora-frontend sh

# Inspect network
docker network inspect mentora_mentora-network

# View resource usage
docker stats mentora-backend mentora-frontend
```

## Health Checks

### Backend Health Check

**Endpoint:** `http://localhost:3000/api/health`

**Docker Configuration:**
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

**Test Manually:**
```bash
# From host
curl http://localhost:3000/api/health

# From frontend container
docker exec mentora-frontend curl http://backend:3000/api/health
```

## Volume Mounts (Development)

### Backend Volumes

```yaml
volumes:
  - .:/app                    # Mount entire backend directory
  - /app/node_modules         # Prevent overwriting node_modules
  - /app/.next                # Prevent overwriting .next build
```

**What This Means:**
- Changes to backend code reflect immediately
- No need to rebuild on code changes
- Node modules installed in container stay in container

### Frontend Volumes

```yaml
volumes:
  - ./apps/web:/app           # Mount frontend directory
  - /app/node_modules         # Prevent overwriting node_modules
  - /app/.next                # Prevent overwriting .next build
```

**What This Means:**
- Changes to frontend code reflect immediately
- No need to rebuild on code changes
- Node modules installed in container stay in container

## Environment Variables

### Required for Backend

```env
OPENAI_API_KEY=sk-...       # OpenAI API key (Whisper + TTS)
ANTHROPIC_API_KEY=sk-ant-...  # Anthropic Claude API key
```

### Optional for Backend

```env
NODE_ENV=development        # development or production
LOG_LEVEL=info             # debug, info, warn, error
PORT=3000                  # Backend port
```

### Required for Frontend

```env
NEXT_PUBLIC_API_URL=http://localhost:3000  # Backend API URL
```

### Optional for Frontend

```env
NODE_ENV=development        # development or production
PORT=3001                  # Frontend port
```

## Troubleshooting

### Frontend Can't Connect to Backend

**Problem:** Frontend shows "Failed to fetch" errors

**Solutions:**
1. Check backend is running:
   ```bash
   curl http://localhost:3000/api/health
   ```

2. Check Docker network:
   ```bash
   docker network inspect mentora_mentora-network
   ```

3. Check frontend environment variable:
   ```bash
   docker exec mentora-frontend env | grep API_URL
   ```

### Port Already in Use

**Problem:** "Port 3000 is already allocated"

**Solutions:**
1. Stop conflicting process:
   ```bash
   lsof -ti:3000 | xargs kill -9
   ```

2. Change port in docker-compose.yml:
   ```yaml
   ports:
     - "3002:3000"  # Map to different host port
   ```

### Containers Keep Restarting

**Problem:** Containers restart in a loop

**Solutions:**
1. Check logs:
   ```bash
   docker-compose logs backend
   ```

2. Check health status:
   ```bash
   docker-compose ps
   ```

3. Verify environment variables are set:
   ```bash
   docker exec mentora-backend env
   ```

### Changes Not Reflected

**Problem:** Code changes don't appear in running app

**Solutions:**
1. Verify volume mounts:
   ```bash
   docker inspect mentora-backend | grep -A 10 Mounts
   ```

2. Restart containers:
   ```bash
   docker-compose restart
   ```

3. Rebuild if needed:
   ```bash
   docker-compose up --build
   ```

### Out of Disk Space

**Problem:** "no space left on device"

**Solutions:**
1. Clean up Docker:
   ```bash
   docker system prune -a
   ```

2. Remove unused volumes:
   ```bash
   docker volume prune
   ```

3. Remove old images:
   ```bash
   docker image prune -a
   ```

## Production Deployment

### Build Production Images

```bash
docker-compose -f docker-compose.prod.yml build
```

### Run Production Stack

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Check Production Health

```bash
# Backend health
curl http://localhost:3000/api/health

# Frontend UI
open http://localhost:3001
```

### View Production Logs

```bash
docker-compose -f docker-compose.prod.yml logs -f
```

## Best Practices

### Development

1. **Use docker-compose up:** Easier than managing individual containers
2. **Keep .env updated:** Sync with .env.example
3. **Monitor logs:** Use `docker-compose logs -f` to debug
4. **Clean regularly:** Run `docker system prune` weekly

### Production

1. **Use production compose file:** Optimized builds
2. **Set resource limits:** Add memory/CPU limits to compose file
3. **Enable auto-restart:** Already configured with `restart: always`
4. **Monitor health checks:** Ensure services are healthy
5. **Use secrets:** Don't hardcode API keys in compose files

## Security Notes

### Development

- API keys in .env file (not committed to git)
- Local network only (ports not exposed to internet)
- Hot-reload enabled (convenient but less secure)

### Production

- Use Docker secrets for API keys
- Use reverse proxy (nginx) for SSL
- Disable hot-reload (use production builds)
- Implement rate limiting
- Add authentication

## Summary

This Docker setup provides:
- ✅ Full-stack development environment in one command
- ✅ Hot-reload for both frontend and backend
- ✅ Isolated network for service communication
- ✅ Health checks and auto-restart
- ✅ Production-ready builds
- ✅ Easy debugging and inspection

Start developing:
```bash
docker-compose up
```

Open browser:
- Frontend: http://localhost:3001
- Backend: http://localhost:3000

Happy coding! 🚀
