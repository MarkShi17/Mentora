# Mentora Current Architecture Flow

**Last Updated:** October 25, 2025

---

## 🔄 Complete Data Flow

### Current State: **MCPs are NOT integrated with Claude yet**

The MCPs are **built and running**, but they're **separate systems** right now. Here's what's happening:

---

## 📊 Actual Current Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     USER INTERACTION                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Voice Input (User speaks)                                │
│     • Browser captures audio                                 │
│     • Base64 encoded audio sent to backend                   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  2. OpenAI Whisper (Speech-to-Text)                         │
│     • POST /api/transcript                                   │
│     • Whisper transcribes audio → text                       │
│     • Returns: { text: "What is photosynthesis?" }          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Teaching Request Processing                              │
│     • POST /api/qa                                           │
│     • Body: {                                                │
│         sessionId: "session_123",                            │
│         question: "What is photosynthesis?",                 │
│         highlightedObjects: ["obj_456"],                     │
│         mode: "guided"                                       │
│       }                                                      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Context Building (lib/agent/contextBuilder.ts)          │
│     • Retrieves session history (last 10 turns)             │
│     • Gets highlighted canvas objects                        │
│     • Builds spatial awareness context                       │
│     • Extracts conversation topics                           │
│                                                              │
│     Output: {                                                │
│       canvasState: "Objects on canvas: [equation 1]...",    │
│       highlightedObjects: "User selected equation 1...",    │
│       conversationHistory: "Previous Q&A..."                │
│     }                                                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  5. Claude Sonnet 4.5 (Teaching Agent)                      │
│     • Model: claude-sonnet-4-5-20250929                     │
│     • Max tokens: 4096                                       │
│                                                              │
│     System Prompt:                                           │
│       - "You are Mentora, an AI tutor..."                   │
│       - Teaching mode (Socratic vs Direct)                   │
│       - Canvas state awareness                               │
│       - Visual creation instructions                         │
│       - JSON response format                                 │
│                                                              │
│     ❌ MCPs NOT called here (not integrated yet!)           │
│                                                              │
│     Claude Response (JSON):                                  │
│     {                                                        │
│       "explanation": "Photosynthesis is...",                │
│       "narration": "Let me explain with diagram above...",  │
│       "objects": [                                           │
│         {                                                    │
│           "type": "diagram",                                 │
│           "content": "Chloroplast structure...",            │
│           "metadata": { "description": "..." }              │
│         },                                                   │
│         {                                                    │
│           "type": "latex",                                   │
│           "content": "6CO_2 + 6H_2O \\rightarrow ...",     │
│           "referenceName": "equation 1"                     │
│         }                                                    │
│       ],                                                     │
│       "references": [                                        │
│         {                                                    │
│           "mention": "as shown in equation 1",              │
│           "objectId": "obj_789"                             │
│         }                                                    │
│       ]                                                      │
│     }                                                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  6. Canvas Object Generation                                 │
│     • lib/canvas/objectGenerator.ts                         │
│     • For each object in Claude's response:                 │
│                                                              │
│     LaTeX:                                                   │
│       → Renders via codecogs.com API                        │
│       → Returns PNG URL                                      │
│                                                              │
│     Graph:                                                   │
│       → Evaluates function                                   │
│       → Generates SVG                                        │
│                                                              │
│     Code:                                                    │
│       → Creates code block with syntax metadata             │
│                                                              │
│     Text:                                                    │
│       → Formats as text annotation                          │
│                                                              │
│     Diagram:                                                 │
│       → Creates SVG placeholder                              │
│       → (Could use MCP here in future!)                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  7. Layout Engine (lib/canvas/layoutEngine.ts)              │
│     • Calculates positions for new objects                  │
│     • Strategies:                                            │
│       - Center: First object                                 │
│       - Below-last: Stack vertically                         │
│       - Right-of-last: Horizontal layout                     │
│       - Grouped: Related objects together                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  8. OpenAI TTS-1 (Text-to-Speech)                           │
│     • lib/voice/synthesizer.ts                              │
│     • Input: Claude's narration text                         │
│     • Voice: alloy (OpenAI TTS voice)                       │
│     • Format: MP3                                            │
│     • Output: Base64 encoded audio                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  9. Session Storage (lib/agent/sessionManager.ts)           │
│     • Saves user turn + assistant turn                       │
│     • Stores canvas objects                                  │
│     • Maintains conversation history                         │
│     • Storage: In-memory Map (session lost on restart)      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  10. API Response to Frontend                                │
│      {                                                       │
│        "turnId": "turn_123",                                │
│        "answer": {                                           │
│          "text": "Photosynthesis is...",                    │
│          "narration": "Let me explain...",                  │
│          "audioUrl": "data:audio/mp3;base64,..."            │
│        },                                                    │
│        "canvasObjects": [                                    │
│          {                                                   │
│            "id": "obj_789",                                 │
│            "type": "latex",                                  │
│            "content": "...",                                 │
│            "position": { "x": 100, "y": 200 },              │
│            "size": { "width": 400, "height": 100 }          │
│          },                                                  │
│          { ... }                                             │
│        ],                                                    │
│        "objectPlacements": [...],                           │
│        "references": [...]                                   │
│      }                                                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  11. Frontend Rendering                                      │
│      • Plays TTS audio                                       │
│      • Renders canvas objects with D3.js                    │
│      • Animates object placement                             │
│      • Highlights references in sync with audio             │
│      • Auto-links new objects with sequential connection threads for left-to-right reading │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚧 MCP Servers: Built but NOT Integrated

### What's Running (Standalone):

```
┌─────────────────────────────────────────────────────────────┐
│              MCP SERVERS (Isolated System)                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ✅ Sequential Thinking MCP                                 │
│     • Port: stdio (npx)                                     │
│     • Status: Connected                                      │
│     • Tool: sequentialthinking                              │
│     • NOT called by Claude                                   │
│                                                              │
│  ✅ GitHub MCP                                              │
│     • Port: stdio (npx)                                     │
│     • Status: Connected                                      │
│     • Tools: 26 (search_code, create_issue, etc.)          │
│     • NOT called by Claude                                   │
│                                                              │
│  ✅ Python Execution MCP                                    │
│     • Port: 8001 → 8000 (Docker HTTP)                      │
│     • Status: Connected                                      │
│     • Tool: execute_python                                   │
│     • Can generate matplotlib diagrams                       │
│     • NOT called by Claude                                   │
│                                                              │
│  ✅ Manim Animation MCP                                     │
│     • Port: 8002 → 8000 (Docker HTTP)                      │
│     • Status: Connected                                      │
│     • Tool: render_animation                                 │
│     • Can create math animations                             │
│     • NOT called by Claude                                   │
│                                                              │
│  ⚠️ Figma MCP                                               │
│     • Status: Error (expected)                               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### How to Test MCPs Directly:

```bash
# Test Python MCP
curl -X POST http://localhost:3000/api/mcp/call \
  -H "Content-Type: application/json" \
  -d '{
    "serverId": "python",
    "toolName": "execute_python",
    "arguments": {
      "code": "import matplotlib.pyplot as plt\nplt.plot([1,2,3])\nplt.savefig('plot.png')"
    }
  }'

# Test Sequential Thinking
curl -X POST http://localhost:3000/api/mcp/call \
  -H "Content-Type: application/json" \
  -d '{
    "serverId": "sequential-thinking",
    "toolName": "sequentialthinking",
    "arguments": {
      "thought": "Step 1 of solving the problem",
      "thoughtNumber": 1,
      "totalThoughts": 3,
      "nextThoughtNeeded": true
    }
  }'
```

---

## 🎯 What's Missing: Claude ↔ MCP Integration

### To Complete the Integration:

**Option 1: Agentic Tool Use (Recommended)**
Claude needs to be able to call MCPs as tools during response generation.

**Implementation:**
```typescript
// In mentorAgent.ts - Add tools to Claude API call
const response = await this.anthropic.messages.create({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 4096,
  system: systemPrompt,
  tools: [
    {
      name: "execute_python",
      description: "Execute Python code to generate diagrams",
      input_schema: {
        type: "object",
        properties: {
          code: { type: "string", description: "Python code to execute" }
        }
      }
    },
    // ... other MCP tools
  ],
  messages: [{ role: 'user', content: userPrompt }],
});

// Handle tool calls
if (response.stop_reason === 'tool_use') {
  for (const content of response.content) {
    if (content.type === 'tool_use') {
      // Call MCP server
      const mcpResult = await mcpManager.callTool({
        serverId: 'python',
        toolName: content.name,
        arguments: content.input
      });

      // Send result back to Claude
      // Continue conversation with tool results
    }
  }
}
```

**Option 2: Pre/Post Processing**
Use MCPs before or after Claude calls:
- **Before:** Use Sequential Thinking to structure complex problems
- **After:** Use Python/Manim to enhance Claude's visual outputs

---

## 📈 Current System Capabilities

### ✅ What Works Now:
1. Voice input → Whisper transcription
2. Context-aware teaching with Claude
3. Canvas object generation (LaTeX, graphs, code, text, diagrams)
4. Spatial layout on infinite canvas
5. TTS narration with OpenAI
6. Session/conversation management
7. **MCP servers running standalone**

### ❌ What's Not Connected:
1. Claude doesn't call MCP tools
2. Python diagrams not auto-generated
3. Manim animations not triggered
4. Sequential thinking not used for problem decomposition
5. GitHub integration not leveraged for code examples

---

## 🚀 Next Steps to Full Integration

### Phase 1: Basic Tool Integration
```typescript
// Add to mentorAgent.ts
1. Register MCP tools with Claude's tools API
2. Handle tool_use responses
3. Execute MCP calls via mcpManager
4. Feed results back to Claude
```

### Phase 2: Specialized Brains
```typescript
// Create brain router
1. MathBrain: Sequential Thinking + Manim
2. BioBrain: Python (diagrams) + Sequential Thinking
3. CodeBrain: GitHub + Python execution
4. DesignBrain: Figma integration
```

### Phase 3: Multimodal Memory
```
1. ChromaDB for vector storage
2. Store conversation embeddings
3. Semantic search for context
4. Long-term student profile
```

---

## 🔍 Summary

**Current State:**
- **Input:** Voice → Whisper → Text ✅
- **Processing:** Claude generates teaching response ✅
- **Output:** Canvas objects + TTS audio ✅
- **MCPs:** Built and running, but isolated ⚠️

**What You Have:**
- Complete voice pipeline
- Claude-powered teaching
- Canvas visualization
- 4 working MCP servers

**What's Missing:**
- Claude → MCP tool calling
- Automatic diagram generation via Python MCP
- Math animations via Manim MCP
- Agentic workflow orchestration

**Bottom Line:**
The MCPs are like having a workshop full of tools, but Claude (the craftsman) doesn't know they exist yet. The next step is to give Claude the ability to pick up and use these tools when needed.
