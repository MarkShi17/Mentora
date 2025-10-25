# Frontend Development with Docker - Quick Guide

This guide shows you how to develop the Mentora frontend using Docker with hot-reload enabled.

## Prerequisites

- Docker Desktop installed and running
- API keys for OpenAI and Anthropic

## Quick Start (5 Minutes)

### Step 1: Set Up Environment Variables

The `.env` file has been created in the project root. **You need to add your API keys:**

```bash
# Edit .env file
nano .env  # or use your preferred editor
```

Add your actual API keys:
```env
# Required API Keys
OPENAI_API_KEY=sk-proj-...           # Your OpenAI API key
ANTHROPIC_API_KEY=sk-ant-api03-...   # Your Anthropic API key

# Optional Configuration (already set)
NODE_ENV=development
PORT=3000
LOG_LEVEL=info
```

### Step 2: Start the Full Stack

From the project root directory:

```bash
docker-compose up
```

**What this does:**
- Builds Docker images for frontend and backend (first time only)
- Starts both services with hot-reload enabled
- Creates a shared network for communication
- Mounts your code as volumes (changes reflect immediately)

**You'll see output like:**
```
mentora-backend  | ready - started server on 0.0.0.0:3000
mentora-frontend | ready - started server on 0.0.0.0:3001
```

### Step 3: Access the Application

Open your browser:
- **Frontend UI:** http://localhost:3001
- **Backend API:** http://localhost:3000/api/health

## Making Changes to Frontend

### Hot-Reload is Enabled

**Any changes you make to frontend files will automatically reflect in the browser!**

**Files that trigger hot-reload:**
- `apps/web/app/**` - Pages and layouts
- `apps/web/components/**` - React components
- `apps/web/lib/**` - State management, utilities
- `apps/web/hooks/**` - Custom React hooks
- `apps/web/styles/**` - CSS and Tailwind styles

**Example workflow:**

1. Edit a file:
   ```bash
   # Edit a component
   code apps/web/components/canvas-stage.tsx
   ```

2. Save the file (Cmd+S / Ctrl+S)

3. Browser automatically refreshes with your changes

4. Check the terminal for any errors:
   ```bash
   docker-compose logs -f frontend
   ```

### Files that DON'T auto-reload

If you change these, you need to restart:

- `apps/web/package.json` - Dependencies
- `apps/web/next.config.js` - Next.js config
- `apps/web/.env.example` - Environment variables

**To restart:**
```bash
# Press Ctrl+C to stop
# Then start again
docker-compose up
```

## Common Development Tasks

### View Logs

**View all logs:**
```bash
docker-compose logs -f
```

**View frontend logs only:**
```bash
docker-compose logs -f frontend
```

**View backend logs only:**
```bash
docker-compose logs -f backend
```

### Stop the Services

**Press `Ctrl+C` in the terminal where docker-compose is running**

Or in a new terminal:
```bash
docker-compose down
```

### Restart Services

**If you need to restart (e.g., after package.json changes):**

```bash
# Stop
docker-compose down

# Start fresh
docker-compose up
```

### Rebuild After Dependency Changes

**If you added new npm packages:**

```bash
# Stop containers
docker-compose down

# Rebuild with no cache
docker-compose build --no-cache frontend

# Start again
docker-compose up
```

### Install New Frontend Package

```bash
# Enter the frontend container
docker exec -it mentora-frontend sh

# Install package (inside container)
npm install package-name

# Exit container
exit

# Rebuild to persist changes
docker-compose down
docker-compose build frontend
docker-compose up
```

**Or install on host and rebuild:**
```bash
# On your local machine
cd apps/web
npm install package-name
cd ../..

# Rebuild
docker-compose build frontend
docker-compose up
```

### Run Frontend Tests

```bash
# Enter frontend container
docker exec -it mentora-frontend sh

# Run Playwright tests
npm run test:e2e

# Exit
exit
```

### Clean Start (Nuclear Option)

**If things are broken and you want to start fresh:**

```bash
# Stop and remove everything
docker-compose down -v

# Remove built images
docker-compose build --no-cache

# Start fresh
docker-compose up
```

## Troubleshooting

### Port 3001 Already in Use

**Error:** "port is already allocated"

**Solution:**
```bash
# Kill process using port 3001
lsof -ti:3001 | xargs kill -9

# Or change the port in docker-compose.yml
# Edit line 40-41 to use different port:
ports:
  - "3002:3001"  # Maps host 3002 to container 3001
```

### Changes Not Showing Up

**Problem:** I made changes but they're not reflected

**Solutions:**

1. **Check if file is in the right location:**
   - Files should be in `apps/web/`
   - Not in the backend root directory

2. **Hard refresh browser:**
   - Chrome/Edge: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
   - Firefox: Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)

3. **Check for errors:**
   ```bash
   docker-compose logs -f frontend
   ```

4. **Restart container:**
   ```bash
   docker-compose restart frontend
   ```

### Frontend Can't Connect to Backend

**Error:** "Failed to fetch" or network errors

**Check backend is running:**
```bash
curl http://localhost:3000/api/health
```

**Should return:**
```json
{
  "status": "ok",
  "timestamp": "...",
  "version": "0.1.0"
}
```

**If backend is down:**
```bash
# Check backend logs
docker-compose logs backend

# Ensure API keys are set in .env
cat .env | grep API_KEY
```

### Module Not Found Errors

**Error:** "Module not found: Can't resolve '...'"

**Solution:**
```bash
# Rebuild with fresh node_modules
docker-compose down
docker-compose build --no-cache frontend
docker-compose up
```

### TypeScript Errors

**Error:** Type errors in console

**Solution:**
```bash
# Enter container
docker exec -it mentora-frontend sh

# Run type check
npm run lint

# Exit
exit
```

### Docker Out of Space

**Error:** "no space left on device"

**Solution:**
```bash
# Clean up Docker system
docker system prune -a

# Remove unused volumes
docker volume prune

# Remove old images
docker image prune -a
```

## Development Workflow Tips

### Recommended Setup

1. **Terminal 1:** Run `docker-compose up` (keep this running)
2. **Terminal 2:** For commands like `docker exec`, `git`, etc.
3. **Browser:** http://localhost:3001 with DevTools open
4. **Code Editor:** VSCode/Cursor with files open

### Fast Iteration

The Docker setup is configured for maximum development speed:

- **Hot-reload:** Changes appear in ~1-2 seconds
- **Volume mounts:** No need to rebuild for code changes
- **Fast Refresh:** React Fast Refresh preserves component state
- **Source maps:** Full debugging support in browser DevTools

### When to Use Docker vs npm run dev

**Use Docker when:**
- Testing full integration with backend
- Need consistent environment with team
- Preparing for deployment
- Testing Docker-specific configurations

**Use `npm run dev` (without Docker) when:**
- Focusing purely on frontend UI
- Need faster startup time
- Running backend separately
- Debugging Node.js issues

**To run frontend without Docker:**
```bash
cd apps/web

# Copy .env.example to .env
cp .env.example .env

# Edit .env if needed
# NEXT_PUBLIC_API_URL=http://localhost:3000

# Install dependencies (if not done)
npm install

# Run dev server
npm run dev
```

Then open http://localhost:3001

## Project Structure (Frontend)

```
apps/web/
├── app/                  # Next.js App Router pages
│   ├── layout.tsx       # Root layout
│   ├── page.tsx         # Home page (main canvas)
│   └── globals.css      # Global styles
├── components/          # React components
│   ├── canvas-stage.tsx        # Main infinite canvas
│   ├── object-layer.tsx        # Canvas objects renderer
│   ├── pin-layer.tsx           # Pin markers
│   ├── selection-layer.tsx     # Lasso selection
│   ├── prompt-bar.tsx          # Input form
│   ├── active-session-header.tsx
│   ├── sidebar-history.tsx
│   ├── timeline-panel.tsx
│   ├── sources-drawer.tsx
│   ├── captions-overlay.tsx
│   └── ui/                     # Radix UI components
├── hooks/               # Custom React hooks
│   └── use-speech-recognition.ts
├── lib/                # Frontend utilities
│   ├── session-store.ts       # Zustand state management
│   ├── mock-data.ts          # Demo data
│   ├── cn.ts                 # Tailwind utilities
│   └── utils.ts              # General utilities
├── types/              # TypeScript definitions
├── tests/              # Playwright E2E tests
├── public/             # Static assets
├── package.json        # Dependencies
├── next.config.js      # Next.js config
├── tailwind.config.ts  # Tailwind config
├── tsconfig.json       # TypeScript config
└── Dockerfile          # Frontend Docker config
```

## Next Steps

1. **Make a test change:**
   - Edit `apps/web/app/page.tsx`
   - Add a comment or change some text
   - Save and watch it reload in browser

2. **Explore components:**
   - Check out `canvas-stage.tsx` for infinite canvas
   - Look at `session-store.ts` for state management
   - Review `prompt-bar.tsx` for user input handling

3. **Read the docs:**
   - `DOCKER_GUIDE.md` - Full Docker documentation
   - `README.md` - API documentation
   - `QUICKSTART.md` - General quick start

4. **Test the API:**
   - Create a session
   - Ask a question
   - See canvas objects appear

## Summary

**To start developing:**
```bash
# 1. Make sure .env has your API keys
# 2. Start services
docker-compose up

# 3. Open browser
open http://localhost:3001

# 4. Make changes to files in apps/web/
# 5. Watch them reload automatically
```

**Your development loop:**
1. Edit files → Save
2. Browser auto-refreshes
3. Check logs if errors
4. Repeat

**Hot-reload works for:**
- ✅ React components
- ✅ Pages and layouts
- ✅ Styles (CSS/Tailwind)
- ✅ TypeScript files
- ✅ Hooks and utilities

**Need rebuild for:**
- ❌ package.json changes
- ❌ next.config.js changes
- ❌ Dockerfile changes

Happy coding! 🚀
