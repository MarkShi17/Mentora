# Mentora Backend - Setup Checklist

## Pre-Installation Verification

Before you start, make sure you have:

- [ ] Node.js 20 or higher installed
  ```bash
  node --version  # Should be v20.x.x or higher
  ```

- [ ] npm installed
  ```bash
  npm --version
  ```

- [ ] OpenAI API key ready
  - Get one at: https://platform.openai.com/api-keys

- [ ] Anthropic API key ready
  - Get one at: https://console.anthropic.com/

- [ ] (Optional) Docker and Docker Compose installed
  ```bash
  docker --version
  docker-compose --version
  ```

## Installation Steps

### Step 1: Install Dependencies

```bash
cd /Users/aaryanpatil/Desktop/Mentora
npm install
```

Expected output:
- ✓ Installs Next.js, React, OpenAI SDK, Anthropic SDK, TypeScript
- ✓ No errors or warnings

### Step 2: Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:
```env
OPENAI_API_KEY=sk-proj-xxxxx  # Your actual OpenAI key
ANTHROPIC_API_KEY=sk-ant-xxxxx  # Your actual Anthropic key
NODE_ENV=development
LOG_LEVEL=info
```

- [ ] `.env` file created
- [ ] Both API keys added
- [ ] Keys start with correct prefixes (sk-proj- or sk-, and sk-ant-)

### Step 3: Verify TypeScript Compilation

```bash
npm run type-check
```

Expected: No errors (should complete successfully)

If errors appear, check that all files were created correctly.

### Step 4: Start Development Server

```bash
npm run dev
```

Expected output:
```
▲ Next.js 14.2.15
- Local:        http://localhost:3000
✓ Ready in 2.3s
```

- [ ] Server starts without errors
- [ ] Shows "Ready" message
- [ ] Listening on port 3000

### Step 5: Test Health Endpoint

Open a new terminal:

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

- [ ] Response received
- [ ] Status is "ok"
- [ ] No error messages

### Step 6: Test Session Creation

```bash
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Session", "subject": "math"}'
```

Expected response:
```json
{
  "session": {
    "id": "session_...",
    "title": "Test Session",
    "subject": "math",
    ...
  }
}
```

- [ ] Session created successfully
- [ ] Session ID returned
- [ ] No error messages

### Step 7: Test Teaching Endpoint

**IMPORTANT**: Replace `session_xyz` with the actual session ID from Step 6!

```bash
curl -X POST http://localhost:3000/api/qa \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session_xyz",
    "question": "What is 2 plus 2?",
    "mode": "guided"
  }'
```

Expected response:
```json
{
  "turnId": "turn_...",
  "answer": {
    "text": "...",
    "narration": "...",
    "audioUrl": "data:audio/mp3;base64,..."
  },
  "canvasObjects": [...],
  ...
}
```

- [ ] Response received
- [ ] Contains `turnId`
- [ ] Contains `answer.text`
- [ ] Contains `canvasObjects` array
- [ ] No error messages
- [ ] Check terminal logs for Claude API call

### Step 8: Verify All Endpoints

```bash
# List sessions
curl http://localhost:3000/api/sessions

# Get session details (replace session_xyz)
curl http://localhost:3000/api/sessions/session_xyz
```

- [ ] Session list retrieved
- [ ] Session details retrieved
- [ ] All responses are valid JSON

## Common Issues & Solutions

### Issue: "OPENAI_API_KEY environment variable is required"

**Solution**:
- Make sure `.env` file exists in project root
- Verify the key is on the correct line without spaces
- Restart the dev server after editing `.env`

### Issue: "ANTHROPIC_API_KEY environment variable is required"

**Solution**:
- Add your Anthropic API key to `.env`
- Format: `ANTHROPIC_API_KEY=sk-ant-...`
- Restart the dev server

### Issue: TypeScript compilation errors

**Solution**:
```bash
# Clean and reinstall
rm -rf node_modules .next
npm install
npm run type-check
```

### Issue: Port 3000 already in use

**Solution**:
```bash
# Option 1: Change port
echo "PORT=3001" >> .env

# Option 2: Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

### Issue: "Module not found" errors

**Solution**:
```bash
# Reinstall dependencies
rm package-lock.json
rm -rf node_modules
npm install
```

## Docker Setup (Alternative)

If you prefer using Docker:

```bash
# Make sure .env exists with API keys
cp .env.example .env
# Edit .env with your keys

# Start with Docker Compose
docker-compose up
```

- [ ] Docker containers build successfully
- [ ] Backend service starts on port 3000
- [ ] Health endpoint works: `curl http://localhost:3000/api/health`

## Success Criteria

You've successfully set up Mentora backend when:

- ✅ All dependencies installed without errors
- ✅ TypeScript compiles without errors
- ✅ Dev server starts successfully
- ✅ Health check returns `"status": "ok"`
- ✅ Can create sessions
- ✅ Can ask questions and get responses
- ✅ Responses include canvas objects
- ✅ TTS audio is generated (base64 data URL)
- ✅ No API key errors in logs

## Next Steps

Once all checks pass:

1. ✅ Backend is ready for frontend integration
2. 📖 Read `README.md` for detailed API documentation
3. 🧪 Test all canvas object types (LaTeX, graphs, code, etc.)
4. 🎨 Customize teaching prompts in `lib/agent/mentorAgent.ts`
5. 🔗 Connect your frontend to the API endpoints

## File Structure Verification

Make sure these files exist:

```
✓ package.json
✓ tsconfig.json
✓ next.config.js
✓ .env (with your API keys)
✓ Dockerfile
✓ docker-compose.yml
✓ README.md
✓ QUICKSTART.md

✓ app/layout.tsx
✓ app/page.tsx
✓ app/api/health/route.ts
✓ app/api/sessions/route.ts
✓ app/api/sessions/[id]/route.ts
✓ app/api/qa/route.ts
✓ app/api/transcript/route.ts

✓ lib/agent/mentorAgent.ts
✓ lib/agent/sessionManager.ts
✓ lib/agent/contextBuilder.ts
✓ lib/canvas/objectGenerator.ts
✓ lib/canvas/layoutEngine.ts
✓ lib/canvas/types.ts
✓ lib/voice/transcriber.ts
✓ lib/voice/synthesizer.ts
✓ lib/utils/logger.ts
✓ lib/utils/errors.ts
✓ lib/utils/ids.ts

✓ types/api.ts
✓ types/canvas.ts
✓ types/session.ts
✓ types/index.ts
```

All files present? You're good to go! 🚀
