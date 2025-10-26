# Demo Session - Hackathon Showcase

## Overview

The Mentora platform now includes a **pre-loaded demo session** that automatically appears when the application starts. This demo session showcases the platform's architecture, tech stack, features, and use cases - perfect for hackathon presentations!

## What's Included

### Session Details
- **Session ID**: `demo_session` (fixed ID for easy access)
- **Title**: 🚀 Mentora Demo - Hackathon Showcase
- **Subject**: Design (general showcase)
- **Auto-loaded**: Yes (loads on server startup)

### Canvas Objects (9 total)

The demo session contains 9 strategically placed canvas objects organized in 3 visual clusters:

#### Cluster 1: Architecture & Tech Stack (Left Side)
1. **Main Title** (50, 50) - Text
   - "Mentora - AI-Powered Tutoring Platform"

2. **Architecture Diagram** (50, 150) - Diagram
   - Full-stack architecture visualization
   - Shows Frontend → Backend → AI layers
   - Interactive SVG with color-coded components

3. **Tech Stack** (50, 650) - Text
   - Comprehensive technology list
   - Frontend, Backend, AI, Voice, Canvas, Storage, Deployment

#### Cluster 2: Features & How It Works (Center)
4. **Key Features** (700, 50) - Text
   - Voice-Interactive Learning
   - Specialized AI Brains
   - Infinite Canvas Workspace
   - MCP Tool Integration

5. **How It Works Flowchart** (700, 600) - Diagram
   - User flow: Voice → AI → Canvas Objects
   - Interactive SVG showing the teaching pipeline

#### Cluster 3: Use Cases & Examples (Right Side)
6. **Use Cases** (1400, 50) - Text
   - Math Tutoring examples
   - Biology Learning examples
   - Code Education examples
   - Design Concepts examples

7. **Teaching Modes** (1400, 550) - Text
   - Socratic Mode (Guided)
   - Direct Mode

8. **API Example** (1400, 880) - Code Block
   - Sample TypeScript code showing API usage
   - Session creation and Q&A endpoints

9. **Demo Instructions** (50, 980) - Text
   - Step-by-step guide for trying the platform
   - Interactive usage tips

## Accessing the Demo Session

### Via API

```bash
# Get all sessions (demo will be in the list)
curl http://localhost:3000/api/sessions

# Get demo session directly
curl http://localhost:3000/api/sessions/demo_session
```

### Via Frontend

When you start the application, the demo session will automatically appear in the session list with the title "🚀 Mentora Demo - Hackathon Showcase". Click on it to view the pre-loaded canvas!

## Features

### Auto-initialization
- Demo session is created when the SessionManager is instantiated
- Happens automatically on server startup
- No manual setup required

### Protected Session
- Cannot be deleted (deletion is blocked in SessionManager)
- Always available for demos and showcases
- Reloads on every server restart

### Visual Layout
- Objects are positioned for optimal viewing
- Three distinct clusters for easy navigation
- Professional spacing and sizing
- Ready for zoom/pan interactions

## Usage for Hackathon Demos

### 2-Minute Demo Flow

1. **Open the app** → Demo session appears automatically
2. **Overview (30 sec)**: Show the main title and architecture diagram
3. **Features (45 sec)**: Walk through key features and how it works
4. **Use Cases (30 sec)**: Highlight real-world applications
5. **Live Demo (15 sec)**: Show interaction with the canvas

### Presentation Tips

- Start with the demo session already loaded
- Use zoom to focus on specific clusters
- Highlight the visual diagrams (architecture, flow)
- Mention the tech stack to show technical depth
- Point out MCP integration as a differentiator
- End by showing how to create a new session

## Technical Implementation

### Files Created/Modified

1. **`lib/demo/demoSession.ts`** (NEW)
   - Creates the demo session with all canvas objects
   - Generates professional SVG diagrams
   - Helper functions for creating objects

2. **`lib/agent/sessionManager.ts`** (MODIFIED)
   - Auto-loads demo session in constructor
   - Adds `getDemoSession()` helper method
   - Prevents demo session deletion

### Canvas Object Types Used

- **Text Objects**: 6 (titles, features, instructions)
- **Diagram Objects**: 2 (architecture, flow)
- **Code Objects**: 1 (API example)

All objects use:
- Professional color schemes
- Proper sizing and positioning
- Descriptive labels and reference names
- Metadata tags for organization

## Customization

To modify the demo content, edit `/lib/demo/demoSession.ts`:

```typescript
// Add a new text object
canvasObjects.push(createTextObject(
  'Your content here',
  x, y, width, height, fontSize, turnId, 'Label'
));

// Add a new diagram
canvasObjects.push(createDiagramObject(
  'Description',
  x, y, width, height, turnId, 'Label'
));

// Add code examples
canvasObjects.push(createCodeObject(
  'code here',
  x, y, width, height, turnId, 'Label'
));
```

## Benefits

✅ **Demo-Ready**: No setup required, just start the app
✅ **Professional**: Polished visuals for presentations
✅ **Comprehensive**: Covers all aspects of the platform
✅ **Interactive**: Can zoom, pan, and interact with objects
✅ **Reusable**: Perfect for multiple demo sessions

## Future Enhancements

Potential improvements for the demo session:

- [ ] Add video objects showing the platform in action
- [ ] Include sample LaTeX equations from math tutoring
- [ ] Add biology diagram examples
- [ ] Include interactive graph visualizations
- [ ] Add animation/transition effects
- [ ] Create multiple demo sessions for different subjects

---

**Last Updated**: 2025-10-26
**Status**: ✅ Complete and ready for hackathon demos
