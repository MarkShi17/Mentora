# Mentora - AI Tutoring Platform

Complete full-stack AI-powered tutoring platform with voice interaction and infinite canvas workspace.

## Architecture

**Full-Stack Application:**
- **Frontend**: React + Next.js + D3.js (Port 3001)
- **Backend**: Next.js API Routes + Claude AI (Port 3000)
- **Docker**: Multi-service containerized deployment

## Features

- **Voice-Interactive Teaching Agent**: Powered by Claude Sonnet 4.5
- **Canvas Object Management**: Create and manage LaTeX equations, graphs, code blocks, diagrams, and text
- **Session Management**: Track teaching sessions with full conversation history
- **Context-Aware**: References highlighted objects and maintains spatial awareness
- **TTS & Transcription**: OpenAI Whisper for speech-to-text and TTS-1 for text-to-speech
- **Socratic Teaching**: Guides students with questions rather than direct answers (configurable)

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict mode)
- **LLM**: Claude Sonnet 4.5 (Anthropic)
- **Transcription**: OpenAI Whisper API
- **TTS**: OpenAI TTS-1
- **Storage**: In-memory (Map)
- **Docker**: Multi-stage builds for dev and production

## Prerequisites

- Node.js 20+
- Docker and Docker Compose (optional)
- OpenAI API key
- Anthropic API key

## Quick Start

### 1. Clone and Install

```bash
cd Mentora
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:

```env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
NODE_ENV=development
LOG_LEVEL=info
```

### 3. Run Full Stack Application

**Option A: Full Stack with Docker (Recommended)**
```bash
docker-compose up
```
This starts both frontend and backend:
- Frontend: http://localhost:3001
- Backend API: http://localhost:3000

**Option B: Backend Only (for API development)**
```bash
npm run dev
```
Backend API runs at http://localhost:3000

**Option C: Frontend Separately (for UI development)**
```bash
cd mentora/apps/web
npm install
npm run dev
```
Frontend runs at http://localhost:3001

### 4. Test Health Check

```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": 1234567890,
  "version": "0.1.0"
}
```

## API Documentation

### Base URL

```
http://localhost:3000/api
```

### Endpoints

#### 1. Health Check

**GET** `/health`

Check if the server is running.

**Response:**
```json
{
  "status": "ok",
  "timestamp": 1234567890,
  "version": "0.1.0"
}
```

---

#### 2. Create Session

**POST** `/sessions`

Create a new teaching session.

**Request Body:**
```json
{
  "title": "Calculus Lesson",
  "subject": "math"
}
```

**Parameters:**
- `title` (string, optional): Session title
- `subject` (string, required): One of `"math"`, `"bio"`, `"code"`, `"design"`

**Response (201):**
```json
{
  "session": {
    "id": "session_xyz",
    "title": "Calculus Lesson",
    "subject": "math",
    "createdAt": 1234567890,
    "updatedAt": 1234567890,
    "turns": [],
    "canvasObjects": []
  }
}
```

---

#### 3. List Sessions

**GET** `/sessions`

Get all teaching sessions.

**Response:**
```json
{
  "sessions": [
    {
      "id": "session_xyz",
      "title": "Calculus Lesson",
      "subject": "math",
      "updatedAt": 1234567890,
      "preview": "How do you integrate..."
    }
  ]
}
```

---

#### 4. Get Session Details

**GET** `/sessions/:id`

Get full session details including conversation history and canvas objects.

**Response:**
```json
{
  "session": {
    "id": "session_xyz",
    "title": "Calculus Lesson",
    "subject": "math",
    "createdAt": 1234567890,
    "updatedAt": 1234567890,
    "turns": [
      {
        "id": "turn_abc",
        "role": "user",
        "content": "How do you integrate 2 over 3x squared?",
        "timestamp": 1234567890,
        "highlightedContext": {
          "objectIds": ["obj_123"],
          "summary": "Student highlighted equation 1"
        }
      },
      {
        "id": "turn_def",
        "role": "assistant",
        "content": "Let's break this down step by step...",
        "timestamp": 1234567891,
        "audioUrl": "data:audio/mp3;base64,...",
        "objectsCreated": ["obj_456"],
        "objectsReferenced": ["obj_123"]
      }
    ],
    "canvasObjects": [...]
  },
  "canvasSnapshot": {
    "objects": [...],
    "viewport": { "x": 0, "y": 0, "zoom": 1 }
  }
}
```

---

#### 5. Ask Question (Main Teaching Endpoint)

**POST** `/qa`

Submit a question and receive a teaching response with canvas objects.

**Request Body:**
```json
{
  "sessionId": "session_xyz",
  "question": "How do you integrate 2 over 3x squared?",
  "highlightedObjects": ["obj_123"],
  "mode": "guided"
}
```

**Parameters:**
- `sessionId` (string, required): Session ID
- `question` (string, required): Student's question
- `highlightedObjects` (string[], optional): IDs of canvas objects the student selected
- `mode` (string, optional): `"guided"` (Socratic) or `"direct"`, default: `"guided"`

**Response:**
```json
{
  "turnId": "turn_ghi",
  "answer": {
    "text": "Let's break this down step by step. First, can you identify the form of this integral?",
    "narration": "Let's start by writing the integral on the canvas below...",
    "audioUrl": "data:audio/mp3;base64,..."
  },
  "canvasObjects": [
    {
      "id": "obj_789",
      "type": "latex",
      "position": { "x": 0, "y": 0 },
      "size": { "width": 400, "height": 100 },
      "zIndex": 1,
      "data": {
        "type": "latex",
        "latex": "\\int \\frac{2}{3x^2} dx",
        "rendered": "https://latex.codecogs.com/png.latex?..."
      },
      "metadata": {
        "createdAt": 1234567890,
        "turnId": "turn_ghi",
        "referenceName": "equation 1",
        "tags": ["math", "equation"]
      }
    }
  ],
  "objectPlacements": [
    {
      "objectId": "obj_789",
      "position": { "x": 0, "y": 0 },
      "animateIn": "fade",
      "timing": 0
    }
  ],
  "references": [
    {
      "objectId": "obj_789",
      "mention": "as shown in equation 1",
      "timestamp": 2000
    }
  ]
}
```

---

#### 6. Transcribe Audio

**POST** `/transcript`

Convert audio to text using OpenAI Whisper.

**Request Body:**
```json
{
  "audio": "data:audio/webm;base64,...",
  "sessionId": "session_xyz"
}
```

**Parameters:**
- `audio` (string, required): Base64-encoded audio (webm, mp4, wav formats supported)
- `sessionId` (string, required): Session ID

**Response:**
```json
{
  "text": "How do you integrate 2 over 3x squared?",
  "confidence": 0.98
}
```

---

## Canvas Object Types

### 1. LaTeX Object

Mathematical equations rendered via LaTeX.

```json
{
  "type": "latex",
  "data": {
    "type": "latex",
    "latex": "\\int \\frac{2}{3x^2} dx",
    "rendered": "https://latex.codecogs.com/png.latex?..."
  }
}
```

### 2. Graph Object

Visual graphs of mathematical functions.

```json
{
  "type": "graph",
  "data": {
    "type": "graph",
    "equation": "y = x^2",
    "svg": "<svg>...</svg>",
    "dataPoints": [[0,0], [1,1], [2,4]]
  }
}
```

### 3. Code Object

Syntax-highlighted code blocks.

```json
{
  "type": "code",
  "data": {
    "type": "code",
    "code": "def binary_search(arr, target): ...",
    "language": "python"
  }
}
```

### 4. Text Object

Plain text notes and annotations.

```json
{
  "type": "text",
  "data": {
    "type": "text",
    "content": "Remember: The derivative gives the slope",
    "fontSize": 16
  }
}
```

### 5. Diagram Object

Visual diagrams and illustrations.

```json
{
  "type": "diagram",
  "data": {
    "type": "diagram",
    "svg": "<svg>...</svg>",
    "description": "Cell structure diagram"
  }
}
```

---

## Teaching Modes

### Guided Mode (Socratic Method)

Default teaching style that:
- Guides with questions rather than answers
- Breaks explanations into small steps
- Provides hints before solutions
- Checks understanding at checkpoints

**Example:**
```json
{
  "mode": "guided"
}
```

### Direct Mode

Provides clear, complete explanations:
- Gives direct answers
- Still breaks into logical steps
- Thorough but concise

**Example:**
```json
{
  "mode": "direct"
}
```

---

## Project Structure

```
Mentora/
├── app/                          # BACKEND: Next.js App Router
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Backend homepage
│   └── api/                     # API Routes
│       ├── health/
│       │   └── route.ts         # Health check
│       ├── sessions/
│       │   ├── route.ts         # List/create sessions
│       │   └── [id]/
│       │       └── route.ts     # Get session details
│       ├── transcript/
│       │   └── route.ts         # Audio transcription
│       └── qa/
│           └── route.ts         # Main teaching endpoint
│
├── lib/                          # BACKEND: Core Logic
│   ├── agent/
│   │   ├── mentorAgent.ts       # Main teaching logic (Claude)
│   │   ├── contextBuilder.ts    # Build context from highlights
│   │   └── sessionManager.ts    # Manage sessions (in-memory)
│   │
│   ├── canvas/
│   │   ├── objectGenerator.ts   # Create canvas objects
│   │   ├── layoutEngine.ts      # Position objects spatially
│   │   └── types.ts             # Canvas object types
│   │
│   ├── voice/
│   │   ├── transcriber.ts       # Whisper API wrapper
│   │   └── synthesizer.ts       # TTS API wrapper
│   │
│   └── utils/
│       ├── logger.ts            # Logging utility
│       ├── errors.ts            # Error classes
│       └── ids.ts               # ID generation
│
├── types/                        # SHARED: TypeScript Types
│   ├── session.ts               # Session/turn types
│   ├── canvas.ts                # Canvas object types
│   ├── api.ts                   # API request/response types
│   └── index.ts                 # Re-exports
│
├── mentora/apps/web/             # FRONTEND: React Application
│   ├── app/                     # Next.js App Router
│   ├── components/              # React components
│   │   ├── canvas-stage.tsx    # Infinite canvas
│   │   ├── prompt-bar.tsx      # Input interface
│   │   ├── voice-toggle.tsx    # Voice controls
│   │   └── ...                 # Other UI components
│   ├── hooks/                   # Custom React hooks
│   ├── lib/                     # Frontend utilities
│   ├── Dockerfile              # Frontend Docker config
│   └── package.json            # Frontend dependencies
│
├── Dockerfile                    # Backend Docker build
├── docker-compose.yml            # Multi-service dev setup
├── docker-compose.prod.yml       # Multi-service prod setup
├── .dockerignore                 # Docker ignore patterns
├── package.json                  # Backend dependencies
├── tsconfig.json                 # TypeScript configuration
├── next.config.js                # Backend Next.js config
├── .env.example                  # Environment template
└── CLAUDE.md                     # Changelog and updates
```

---

## Development

### Type Checking

```bash
npm run type-check
```

### Build for Production

```bash
npm run build
npm start
```

### Docker Commands

**Development (with hot-reload):**
```bash
docker-compose up
```

**Production Build:**
```bash
docker-compose -f docker-compose.prod.yml up
```

**Backend Only:**
```bash
docker build --target runner -t mentora-backend .
docker run -p 3000:3000 --env-file .env mentora-backend
```

**Rebuild Containers:**
```bash
docker-compose build --no-cache
docker-compose up
```

---

## Error Handling

All endpoints return errors in the following format:

```json
{
  "error": "Error message here",
  "code": "ERROR_CODE",
  "statusCode": 400
}
```

### Common Error Codes

- `VALIDATION_ERROR` (400): Invalid request parameters
- `NOT_FOUND` (404): Resource not found
- `EXTERNAL_SERVICE_ERROR` (502): OpenAI or Anthropic API failure
- `INTERNAL_ERROR` (500): Unexpected server error

---

## Spatial Layout Logic

Objects are positioned intelligently on the infinite canvas:

1. **First object**: Placed at center (0, 0)
2. **Subsequent objects**: Placed below previous with 150px spacing
3. **Related objects**: Grouped nearby horizontally
4. **Referenced objects**: Close to what's being discussed

The layout engine automatically calculates positions to maintain visual coherence.

---

## Limitations

This is a hackathon/demo implementation with intentional simplifications:

- **In-memory storage**: Sessions are lost when server restarts
- **No authentication**: All sessions are publicly accessible
- **No rate limiting**: API can be called without restrictions
- **Simple graph generation**: Basic function plotting only
- **No caching**: Every request regenerates responses

For production use, add:
- Persistent database (PostgreSQL, MongoDB)
- Authentication and authorization
- Rate limiting and quotas
- Redis caching for sessions
- Advanced graph rendering
- Monitoring and analytics

---

## Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `OPENAI_API_KEY` | Yes | OpenAI API key for Whisper and TTS | - |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for Claude | - |
| `NODE_ENV` | No | Environment mode | `development` |
| `PORT` | No | Server port | `3000` |
| `LOG_LEVEL` | No | Logging level (debug, info, warn, error) | `info` |

---

## Testing Examples

### Create a Math Session

```bash
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Calculus 101",
    "subject": "math"
  }'
```

### Ask a Question

```bash
curl -X POST http://localhost:3000/api/qa \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session_xyz",
    "question": "How do you integrate 2 over 3x squared?",
    "mode": "guided"
  }'
```

### Get Session History

```bash
curl http://localhost:3000/api/sessions/session_xyz
```

---

## License

MIT

---

## Support

For issues and questions, please open an issue on the GitHub repository.
