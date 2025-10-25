# Mentora Backend Tester

An interactive end-to-end testing tool for the Mentora backend streaming API.

## What It Tests

The backend tester validates the complete teaching pipeline:

1. **Brain Selection** - Shows which specialized brain is chosen (math, biology, code, design, or general) and which Claude model it uses (Haiku for fast responses, Sonnet for complex reasoning)
2. **Real-time Text Streaming** - Displays narration as it's generated, sentence by sentence
3. **Canvas Component Generation** - Shows each visual component (LaTeX equations, code blocks, diagrams, etc.) as they're created
4. **Audio Synthesis** - Indicates when TTS audio chunks are being generated

## How to Use

### Start the Backend

Make sure the Mentora backend is running:

```bash
docker-compose up backend
```

Or if running locally:

```bash
npm run dev
```

The backend should be accessible at `http://localhost:3000`.

### Run the Tester

```bash
node backend-tester.js
```

### Ask Questions

Type any question and press Enter. The tester will show:

```
🧠 Brain Selected: MATH
   Model: claude-3-5-haiku-20241022
   Confidence: 95.0%
   Reasoning: Question involves derivative calculation

The derivative of x² is 2x. Let me explain why...

📦 Component #1: LATEX
   ID: obj_abc123
   Label: equation 1
   Position: (50, 50)
   Size: 400x100

🔊🔊🔊

✅ Stream complete

Summary:
  Components created: 1
```

### Example Questions

- **Math (→ Haiku)**: "What is the derivative of x^2?"
- **Biology (→ Haiku)**: "Explain photosynthesis"
- **Code (→ Haiku)**: "How do you implement a binary search?"
- **Design (→ Haiku)**: "What are the principles of good UI design?"
- **General (→ Sonnet)**: "What is artificial intelligence?"

### Exit

Type `exit` or `quit` to stop the tester.

## Brain + Model Mapping

| Brain Type | Claude Model | Use Case |
|------------|-------------|----------|
| Math | Haiku | Fast equation solving, LaTeX generation |
| Biology | Haiku | Quick explanations with diagrams |
| Code | Haiku | Rapid code examples and explanations |
| Design | Haiku | UI/UX principles and examples |
| General | Sonnet | Complex reasoning, interdisciplinary topics |

**Haiku**: `claude-3-5-haiku-20241022` - Fast, efficient for specialized domains
**Sonnet**: `claude-sonnet-4-5-20250929` - Powerful reasoning for complex queries

## Output Color Coding

- **Blue** - Math brain
- **Green** - Biology brain
- **Yellow** - Code brain
- **Magenta** - Design brain
- **Cyan** - General brain
- **🔊** - Audio generation in progress

## Troubleshooting

### "API Error: 500"

Check backend logs:
```bash
docker logs mentora-backend --tail 50
```

Common issues:
- Missing `ANTHROPIC_API_KEY` environment variable
- Missing `OPENAI_API_KEY` for TTS
- Backend not running

### No Brain Selection Shown

Make sure you're running the latest version of the backend with brain selection support in the streaming endpoint.

### Connection Refused

Ensure the backend is running on port 3000:
```bash
curl http://localhost:3000/api/health
```

## Development

The tester uses Server-Sent Events (SSE) to consume the `/api/qa-stream` endpoint. It parses each event type:

- `brain_selected` - First event with brain choice
- `text_chunk` - Narration text chunks
- `canvas_object` - Visual components
- `audio_chunk` - TTS audio data
- `reference` - Cross-references between text and objects
- `complete` - Stream finished

See `backend-tester.js` for implementation details.
