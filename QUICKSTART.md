# Mentora Full-Stack - Quick Start Guide

## 5-Minute Setup

### 1. Install Dependencies

```bash
# Backend dependencies
npm install

# Frontend dependencies (if running separately)
cd apps/web
npm install
cd ../..
```

### 2. Set Up Environment

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:
```env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Start the Application

**Option A: Full Stack with Docker (Recommended)**
```bash
docker-compose up
```
This starts both frontend and backend:
- **Frontend UI**: http://localhost:3001
- **Backend API**: http://localhost:3000

**Option B: Backend Only**
```bash
npm run dev
```
Backend runs at: `http://localhost:3000`

**Option C: Frontend Only**
```bash
cd apps/web
npm run dev
```
Frontend runs at: `http://localhost:3001`

### 4. Access the Application

**Frontend UI:**
Open your browser to: http://localhost:3001

**Backend API:**
Open your browser to: http://localhost:3000

### 5. Test the API

```bash
# Health check
curl http://localhost:3000/api/health

# Create a session
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Session", "subject": "math"}'

# Ask a question (replace session_xyz with actual session ID)
curl -X POST http://localhost:3000/api/qa \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session_xyz",
    "question": "What is the derivative of x squared?",
    "mode": "guided"
  }'
```

## What You Get

**Frontend:**
- **Infinite Canvas**: D3-powered workspace for visual learning
- **Voice Controls**: Speak or type your questions
- **Real-time Updates**: Canvas objects appear as AI generates them
- **Session History**: Access previous lessons
- **Interactive Objects**: Highlight and reference canvas items

**Backend:**
- **6 API Endpoints**: Health, Sessions, QA, Transcript
- **Claude-Powered Teaching**: Socratic method by default
- **Canvas Objects**: LaTeX, graphs, code, diagrams, text
- **Voice Support**: Whisper transcription + TTS audio
- **Spatial Awareness**: Objects positioned intelligently
- **Session Memory**: Full conversation history

## API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health` | GET | Server health check |
| `/api/sessions` | POST | Create teaching session |
| `/api/sessions` | GET | List all sessions |
| `/api/sessions/:id` | GET | Get session details |
| `/api/qa` | POST | Ask question (main teaching) |
| `/api/transcript` | POST | Transcribe audio |

## Application Flow

**How It Works:**
1. **Frontend** loads at http://localhost:3001
2. **User** asks a question (voice or text)
3. **Frontend** sends to `/api/qa` endpoint
4. **Backend** processes with Claude AI
5. **Backend** generates canvas objects + TTS audio
6. **Frontend** displays objects on canvas
7. **Frontend** plays audio narration

**Full Stack Integration:**
- Frontend automatically connects to backend at `localhost:3000`
- Both services communicate over Docker network
- Health checks ensure backend is ready before frontend starts

See `README.md` for full API documentation and examples.

## Troubleshooting

**TypeScript errors?**
```bash
npm run type-check
```

**Port 3000 in use?**
```bash
# Change PORT in .env
PORT=3001
```

**API keys not working?**
- Verify keys are in `.env` (not `.env.example`)
- Restart server after changing `.env`

**Docker issues?**
```bash
# Rebuild containers
docker-compose down
docker-compose build --no-cache
docker-compose up
```

## Next Steps

1. Read `README.md` for detailed API documentation
2. Test all endpoints with the provided curl commands
3. Integrate with your frontend
4. Customize teaching prompts in `lib/agent/mentorAgent.ts`
5. Add more canvas object types as needed

Happy teaching! 🎓
