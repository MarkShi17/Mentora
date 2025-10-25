# Mentora Backend - Quick Reference Card

## 🚀 Installation (30 seconds)

```bash
cd /Users/aaryanpatil/Desktop/Mentora
npm install
cp .env.example .env
# Edit .env with your API keys
npm run dev
```

## 🔑 Required API Keys

```env
OPENAI_API_KEY=sk-proj-...        # Get from: https://platform.openai.com/api-keys
ANTHROPIC_API_KEY=sk-ant-...      # Get from: https://console.anthropic.com/
```

## 📡 API Endpoints

```bash
# Base URL
http://localhost:3000/api

# Health Check
GET /health

# Sessions
POST   /sessions           # Create
GET    /sessions           # List all
GET    /sessions/:id       # Get details

# Teaching
POST   /qa                 # Main teaching endpoint

# Voice
POST   /transcript         # Audio to text
```

## 💡 Common API Calls

### Create Session
```bash
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"title": "Math Lesson", "subject": "math"}'
```

### Ask Question
```bash
curl -X POST http://localhost:3000/api/qa \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session_xyz",
    "question": "What is the derivative of x squared?",
    "mode": "guided"
  }'
```

### Transcribe Audio
```bash
curl -X POST http://localhost:3000/api/transcript \
  -H "Content-Type: application/json" \
  -d '{
    "audio": "data:audio/webm;base64,...",
    "sessionId": "session_xyz"
  }'
```

## 🎨 Canvas Object Types

| Type | Description | Use Case |
|------|-------------|----------|
| `latex` | LaTeX equations | Math formulas, expressions |
| `graph` | SVG graphs | Function plots, visualizations |
| `code` | Code blocks | Programming examples |
| `text` | Text notes | Annotations, explanations |
| `diagram` | Diagrams | Biology, design, flowcharts |

## 🎓 Teaching Modes

| Mode | Behavior | When to Use |
|------|----------|-------------|
| `guided` | Socratic method, questions | Default - helps students think |
| `direct` | Clear explanations | When student needs quick answer |

## 📝 Request/Response Examples

### QA Request
```json
{
  "sessionId": "session_abc",
  "question": "How do you integrate 2/3x^2?",
  "highlightedObjects": ["obj_123"],
  "mode": "guided"
}
```

### QA Response
```json
{
  "turnId": "turn_xyz",
  "answer": {
    "text": "Let's break this down...",
    "narration": "I'll write the integral below...",
    "audioUrl": "data:audio/mp3;base64,..."
  },
  "canvasObjects": [
    {
      "id": "obj_456",
      "type": "latex",
      "position": {"x": 0, "y": 0},
      "data": {"latex": "\\int \\frac{2}{3x^2} dx"}
    }
  ],
  "objectPlacements": [...],
  "references": [...]
}
```

## 🐳 Docker Commands

```bash
# Start development
docker-compose up

# Rebuild
docker-compose build --no-cache

# Stop
docker-compose down

# View logs
docker-compose logs -f backend
```

## 🛠 Development Commands

```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm start            # Start production server
npm run type-check   # Check TypeScript
```

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| API key errors | Check `.env` file, restart server |
| Port 3000 in use | Change `PORT` in `.env` or kill process |
| TypeScript errors | Run `npm install`, then `npm run type-check` |
| Module not found | Delete `node_modules`, run `npm install` |

## 📂 Important Files

```
app/api/qa/route.ts              # Main teaching logic
lib/agent/mentorAgent.ts         # Claude integration
lib/canvas/objectGenerator.ts    # Create canvas objects
lib/voice/transcriber.ts         # Audio transcription
lib/voice/synthesizer.ts         # TTS generation
```

## 🎯 Key Features

- ✅ Claude Sonnet 4.5 powered teaching
- ✅ Canvas-aware (references objects spatially)
- ✅ Voice input/output (Whisper + TTS)
- ✅ LaTeX, graphs, code generation
- ✅ Session management with history
- ✅ Socratic teaching method
- ✅ Docker support

## 📖 Full Documentation

- **README.md** - Complete API docs
- **QUICKSTART.md** - 5-min setup
- **SETUP_CHECKLIST.md** - Verification steps
- **PROJECT_SUMMARY.md** - Architecture

## 🆘 Support

- Check logs in terminal
- Review `.env` configuration
- Verify API keys are valid
- See README.md for examples

---

**Server Status**: http://localhost:3000
**API Base**: http://localhost:3000/api
**Health Check**: http://localhost:3000/api/health
