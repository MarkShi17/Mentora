# Streaming Debug Guide

## Quick Diagnostics

### 1. Check Backend Logs (Real-time)
```bash
docker-compose logs backend -f
```

**What to look for:**
- `[INFO] Processing streaming QA request` - Request received
- `[INFO] Starting streaming response` - Claude stream starting
- `[INFO] Streaming response completed` - Success!
- Any `[ERROR]` messages

### 2. Check Frontend Browser Console

Open browser DevTools (F12) and look for:

**Input Detection:**
- 🎯 `Question detected: [your question]` - Voice input captured
- 🆕 `Creating new session...` - Session creation
- ✅ `Session created: session_xxx` - Session ready
- 🚀 `Starting streaming response...` - Request starting

**Streaming Events:**
- 📡 `Streaming to: http://localhost:3000/api/qa-stream` - API endpoint
- ✅ `Response status: 200 OK` - Connection established
- 📝 `Text chunk: [text]` - Claude generating text
- 🔊 `Audio chunk: [index] - [text]` - TTS audio received
- 🎨 `Canvas object: [type]` - Canvas object created
- ✅ `Stream complete!` - Success!

**Errors:**
- ❌ `Stream error:` - Backend error
- ❌ `Failed to create session:` - Session creation failed
- `HTTP error! status: [code]` - Network/API error

### 3. Quick Test Commands

**Test backend health:**
```bash
curl http://localhost:3000/api/health
```

**Test session creation:**
```bash
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"subject":"general","title":"Test Session"}'
```

**Test streaming endpoint:**
```bash
curl -X POST http://localhost:3000/api/qa-stream \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test","question":"Explain recursion"}' \
  --no-buffer
```

## Common Issues & Solutions

### Issue: "Nothing happens when I speak"

**Check:**
1. Browser console shows `Question detected`?
   - ❌ No → Microphone permission or voice detection issue
   - ✅ Yes → Continue...

2. Browser console shows `Session created`?
   - ❌ No → Backend connection issue
   - ✅ Yes → Continue...

3. Browser console shows `Streaming to: ...`?
   - ❌ No → Frontend not calling streaming API
   - ✅ Yes → Continue...

4. Backend logs show `Processing streaming QA request`?
   - ❌ No → Network issue between frontend/backend
   - ✅ Yes → Continue...

5. Backend logs show `Streaming response completed`?
   - ❌ No → Check for errors in backend logs
   - ✅ Yes → Frontend not processing events correctly

### Issue: "Backend unhealthy"

**Solution:**
```bash
# Check environment variables
docker-compose exec backend env | grep -E "(OPENAI|ANTHROPIC)"

# Restart backend
docker-compose restart backend

# View full logs
docker-compose logs backend --tail=100
```

### Issue: "Network errors in browser"

**Check API URL:**
```bash
# Should show: NEXT_PUBLIC_API_URL=http://localhost:3000
docker-compose exec frontend env | grep NEXT_PUBLIC_API_URL
```

**If not set:**
```bash
# Create .env file in apps/web/
echo "NEXT_PUBLIC_API_URL=http://localhost:3000" > apps/web/.env

# Restart frontend
docker-compose restart frontend
```

### Issue: "Audio not playing"

**Browser console checks:**
- 🔊 `Audio chunk:` messages appearing? → Audio being received
- Check browser audio settings
- Check system volume
- Try different browser (Chrome works best)

### Issue: "Backend takes too long"

**Backend logs should show:**
```
[INFO] Streaming response completed {"totalSentences":8,"totalObjects":3}
```

**If taking >60 seconds:**
- Check Anthropic API key is valid
- Check OpenAI API key is valid
- Check network connection to AI APIs

## Environment Variables Checklist

### Backend (.env in root)
```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
NODE_ENV=development
LOG_LEVEL=info
PORT=3000
```

### Frontend (apps/web/.env)
```bash
NEXT_PUBLIC_API_URL=http://localhost:3000
NODE_ENV=development
PORT=3001
```

## Full Debug Session Example

```bash
# Terminal 1: Backend logs
docker-compose logs backend -f

# Terminal 2: Frontend logs
docker-compose logs frontend -f

# Browser: Open DevTools Console (F12)

# Speak: "Mentora, explain recursion"

# Expected Output:

# Browser Console:
# 🎯 Question detected: Mentora, explain recursion
# 🆕 Creating new session...
# ✅ Session created: session_abc123
# 🚀 Starting streaming response...
# 📡 Streaming to: http://localhost:3000/api/qa-stream
# ✅ Response status: 200 OK
# 📝 Text chunk: Let me explain
# 🔊 Audio chunk: 0 - Let me explain recursion.
# 🎨 Canvas object: code recursion example
# 📝 Text chunk: recursion works by
# 🔊 Audio chunk: 1 - A recursive function calls itself...
# ✅ Stream complete!

# Backend Logs:
# [INFO] Processing streaming QA request {"sessionId":"session_abc123"}
# [INFO] Starting streaming response {"turnId":"turn_xyz789"}
# [INFO] Added 3 canvas objects to session
# [INFO] Streaming response completed {"totalSentences":8,"totalObjects":3}
# POST /api/qa-stream 200 in 28592ms
```

## Performance Expectations

- **First audio chunk**: 300-800ms after question
- **Full response**: 15-30 seconds (depends on length)
- **Backend status**: 200 OK
- **No audio gaps**: Seamless playback

## Getting Help

If issues persist after checking above:

1. Copy full browser console output
2. Copy backend logs: `docker-compose logs backend --tail=200 > backend.log`
3. Check network tab in DevTools for failed requests
4. Verify Docker containers are healthy: `docker-compose ps`
