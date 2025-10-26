# Voice-Activated Demo Session

## Overview

The Mentora demo session now features **voice-activated sequential reveals** with animated connections. Users start by seeing only the main title card, then can progressively reveal additional content by asking natural questions.

## How It Works

### Initial State
When users first open Mentora, they see:
- **1 visible object**: "Mentora - AI-Powered Tutoring Platform" (main title)
- **7 hidden objects**: Pre-loaded but invisible, ready for instant reveal

### Voice Triggers

#### Trigger 1: "What are you?"
**Phrases that work:**
- "What are you?"
- "Who are you?"
- "Tell me about yourself"
- "What is Mentora?"
- "Tell me about Mentora"
- "Describe yourself"
- "What do you do?"

**Reveals (3 objects):**
1. **Architecture Overview** - Full-stack architecture diagram
2. **Tech Stack** - Complete technology stack
3. **How It Works** - User flow pipeline

**Visual Effect:**
- Objects appear instantly (no delay - they're pre-loaded)
- Animated connections draw from Main Title → each revealed object
- Camera smoothly pans to show all 4 objects together

#### Trigger 2: "What are your features?"
**Phrases that work:**
- "What features?"
- "What are your features?"
- "What can you do?"
- "Show me features"
- "Your capabilities"
- "What capabilities?"
- "Show me what you can do"
- "Tell me your features"

**Reveals (4 objects):**
1. **Key Features** - Voice, AI brains, canvas, MCP tools
2. **Use Cases** - Math, Biology, Code, Design examples
3. **Teaching Modes** - Socratic vs Direct modes
4. **Try It Now!** - Getting started instructions

**Visual Effect:**
- Objects appear instantly
- Animated connections draw from Main Title → each revealed object
- Camera pans to show expanded view with all objects

## Technical Architecture

### File Structure

```
apps/web/
├── types/index.ts                    # Added hidden & demoGroup properties
├── components/
│   ├── canvas-stage.tsx             # Filters hidden objects, uses voice handler
│   └── session-initializer.tsx      # Marks 7 of 8 objects as hidden
├── hooks/
│   └── use-demo-voice-handler.ts    # NEW: Detects voice triggers
└── lib/
    └── session-store.ts             # Added revealDemoObjects action
```

### Data Flow

```
1. User asks question via voice/text
   ↓
2. Message added to session store
   ↓
3. useDemoVoiceHandler detects trigger phrase
   ↓
4. revealDemoObjects() action called
   ↓
5. Objects marked as hidden: false
   ↓
6. Connections created from source to targets
   ↓
7. canvas-stage filters and renders visible objects
   ↓
8. User sees instant reveal with connections
```

## Implementation Details

### CanvasObject Type Extensions

```typescript
type CanvasObject = {
  // ... existing properties
  hidden?: boolean;  // For voice-activated reveals
  demoGroup?: 'intro' | 'architecture' | 'features';  // Grouping
}
```

### Demo Groups

| Group | Objects | Trigger |
|-------|---------|---------|
| **intro** | Main Title | Always visible |
| **architecture** | Architecture, Tech Stack, How It Works | "What are you?" |
| **features** | Key Features, Use Cases, Teaching Modes, Try It Now | "What are your features?" |

### Session Store Actions

**revealDemoObjects(sessionId, demoGroup, sourceObjectId?)**
- Finds all objects in the specified demoGroup that are hidden
- Sets `hidden: false` on each object
- If sourceObjectId provided, creates connections from source to each revealed object
- Connections use 'east' anchor on source, 'west' anchor on targets

### Voice Handler Hook

**useDemoVoiceHandler(sessionId)**
- Listens for new messages in the session
- Detects trigger phrases in user messages
- Prevents duplicate reveals with internal tracking
- Automatically finds source object for connections
- Logs reveals to console for debugging

## User Experience

### Demo Flow

```
📱 App loads
   → User sees: [Main Title]

🎤 "What are you?"
   → AI responds with explanation
   → Objects appear: [Architecture] [Tech Stack] [How It Works]
   → Connections draw from Main Title
   → Camera pans to show all 4 objects

🎤 "What are your features?"
   → AI responds with capabilities
   → Objects appear: [Features] [Use Cases] [Modes] [Try It Now]
   → Connections draw from Main Title
   → Camera expands to show all 8 objects

✅ Complete demo visible
   → User can explore, zoom, pan
   → All 8 objects now interactive
```

### Benefits

✅ **Instant reveals** - No backend API calls needed
✅ **Natural interaction** - Voice-activated, conversational
✅ **Visual storytelling** - Connections show relationships
✅ **Professional animations** - Smooth camera movements
✅ **Flexible triggers** - Multiple phrases work for each reveal
✅ **Prevents duplicates** - Each group only reveals once
✅ **Seamless integration** - Works with existing voice system

## Customization

### Adding New Trigger Phrases

Edit `apps/web/hooks/use-demo-voice-handler.ts`:

```typescript
const architectureTriggers = [
  // Add new phrases here
  'explain your architecture',
  'how are you built',
];

const featureTriggers = [
  // Add new phrases here
  'what do you offer',
  'your functionalities',
];
```

### Adding New Demo Groups

1. Add new group to type in `types/index.ts`:
```typescript
demoGroup?: 'intro' | 'architecture' | 'features' | 'advanced';
```

2. Mark objects in `session-initializer.tsx`:
```typescript
hidden: true,
demoGroup: 'advanced',
```

3. Add trigger detection in `use-demo-voice-handler.ts`:
```typescript
if (lowerText.includes('advanced features')) {
  return 'advanced';
}
```

4. Reveal on trigger:
```typescript
revealDemoObjects(sessionId, 'advanced', sourceObject.id);
```

## Debugging

### Console Logs

When a trigger is detected, you'll see:
```
🎯 Demo trigger detected: "architecture" - revealing objects
```

### Checking Object State

In React DevTools or browser console:
```javascript
// Get session store
const store = useSessionStore.getState();

// Check canvas objects
const objects = store.canvasObjects[sessionId];

// Find hidden objects
objects.filter(obj => obj.hidden);

// Find revealed objects
objects.filter(obj => !obj.hidden);

// Check demo groups
objects.map(obj => ({ label: obj.label, hidden: obj.hidden, group: obj.demoGroup }));
```

### Testing Triggers

You can test triggers without voice by:
1. Opening the prompt bar
2. Typing trigger phrases manually
3. Watching for reveals in the canvas

## Future Enhancements

Potential improvements:

- [ ] Add animation delays between reveals (stagger effect)
- [ ] Add sound effects on reveal
- [ ] Highlight newly revealed objects briefly
- [ ] Add third trigger phrase for "advanced features"
- [ ] Store revealed state in session for persistence
- [ ] Add "reset demo" button to hide objects again
- [ ] Track analytics on which triggers users use most
- [ ] Add visual hint showing what questions to ask next

---

**Status**: ✅ Fully implemented and ready for hackathon demo
**Last Updated**: 2025-10-26
