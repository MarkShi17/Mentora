'use client';

import { useEffect, useState } from 'react';
import { useSessionStore } from '@/lib/session-store';
import { nanoid } from '@/lib/utils';
import type { CanvasObject } from '@/types';

export function SessionInitializer() {
  const [initialized, setInitialized] = useState(false);
  const sessions = useSessionStore((state) => state.sessions);
  const createSession = useSessionStore((state) => state.createSession);
  const updateCanvasObject = useSessionStore((state) => state.updateCanvasObject);
  const setDemoMode = useSessionStore((state) => state.setDemoMode);

  const createDefaultLesson = async () => {
    try {
      // Create demo session for hackathon presentation
      const title = 'Mentora Demo - Hackathon Showcase';
      const sessionId = await createSession({ title });
      
      // Set demo mode for this session
      setDemoMode(true, sessionId);
      console.log('🎭 Demo mode set for session:', sessionId);

      // Store object IDs for creating connections
      const objectIds: Record<string, string> = {};

      // DEMO SESSION: Showcasing Mentora's architecture, tech stack, and capabilities
      // Organized as a horizontal tree (left to right) for 2-minute hackathon presentation
      const placeholderObjects: CanvasObject[] = [
        // ==================== HORIZONTAL TREE LAYOUT (LEFT TO RIGHT) ====================

        // 1. Main Title (VISIBLE - Root node) - CENTER LEFT
        {
          id: objectIds.title = `obj-${nanoid(8)}`,
          type: 'note',
          label: 'Mentora Platform',
          x: 100,
          y: 300,
          width: 400,
          height: 150,
          color: '#6366f1', // Indigo
          selected: false,
          zIndex: 1,
          hidden: false,  // Always visible
          demoGroup: 'intro',
          data: {
            content: `# **MENTORA**

## AI-Powered Tutoring Platform

Voice-interactive learning with infinite canvas workspace

Ask me questions to explore the platform!`,
          },
          metadata: {
            description: 'Main title and tagline',
          },
        },

        // 2. Architecture Overview (HIDDEN - Reveal on "what are you?") - RIGHT OF TITLE
        {
          id: objectIds.architecture = `obj-${nanoid(8)}`,
          type: 'note',
          label: 'Architecture',
          x: 600,
          y: 200,
          width: 500,
          height: 200,
          color: '#3b82f6', // Blue
          selected: false,
          zIndex: 2,
          hidden: true,  // Reveal on trigger 1
          demoGroup: 'architecture',
          data: {
            content: `# **Full-Stack Architecture**

## **Frontend Layer** (Port 3001)
React 18 + Next.js 14 + D3.js
Infinite canvas with drag, zoom, pan

## **Backend Layer** (Port 3000)
Next.js API Routes + TypeScript
RESTful endpoints for sessions & AI

## **AI Engine**
Claude Sonnet 4.5 (Teaching Agent)
OpenAI Whisper (Speech-to-Text)
OpenAI TTS-1 (Text-to-Speech)

**Container**: Docker + Docker Compose`,
          },
          metadata: {
            description: 'Three-layer architecture diagram',
          },
        },

        // ==================== CLUSTER 2: FEATURES & HOW IT WORKS (CENTER) ====================

        // 3. How It Works (HIDDEN - Reveal on "what are you?") - RIGHT OF ARCHITECTURE
        {
          id: objectIds.howItWorks = `obj-${nanoid(8)}`,
          type: 'note',
          label: 'How It Works',
          x: 1200,
          y: 200,
          width: 500,
          height: 200,
          color: '#8b5cf6', // Purple
          selected: false,
          zIndex: 3,
          hidden: true,  // Reveal on trigger 1
          demoGroup: 'architecture',
          data: {
            content: `# **How It Works**

**1. Student asks question** (voice or text)
   ↓
**2. AI processes with context** (conversation history + canvas state)
   ↓
**3. Generate visual objects** (equations, diagrams, code, graphs)
   ↓
**4. Speak response** (natural TTS with spatial references)
   ↓
**5. Continuous feedback loop** (ask follow-ups, explore deeper)

**AI maintains spatial awareness** - references objects on canvas naturally!`,
          },
          metadata: {
            description: 'Platform capabilities',
          },
        },

        // ==================== CONTINUATION OF TREE (STAGE 2) ====================

        // 4. Key Features (HIDDEN - Reveal on "what are your features?") - CONTINUES TREE
        {
          id: objectIds.features = `obj-${nanoid(8)}`,
          type: 'note',
          label: 'Key Features',
          x: 1800,
          y: 200,
          width: 500,
          height: 200,
          color: '#f59e0b', // Amber
          selected: false,
          zIndex: 4,
          hidden: true,  // Reveal on trigger 2
          demoGroup: 'features',
          data: {
            content: `# **Key Features**

## **Voice-Interactive Learning**
- Real-time speech-to-text (Whisper)
- Natural text-to-speech responses
- Conversational teaching experience

## **Specialized AI Brains**
- **Math**: LaTeX equations, graphs, proofs
- **Biology**: Diagrams, pathways, molecular structures
- **Code**: Syntax highlighting, algorithms, data structures
- **Design**: Visual concepts, patterns, workflows

## **Infinite Canvas Workspace**
- Create & arrange objects spatially
- LaTeX, graphs, code, diagrams, text, videos
- Drag, zoom, pan interactions
- Contextual object references

## **MCP Tool Integration**
- Python for biology visualizations
- Mermaid for flowcharts
- ChatMol for molecular structures
- Extensible architecture for new tools`,
          },
          metadata: {
            description: 'Application scenarios',
          },
        },

        // 5. Use Cases (HIDDEN - Reveal on "what are your features?") - CONTINUES TREE
        {
          id: objectIds.useCases = `obj-${nanoid(8)}`,
          type: 'note',
          label: 'Use Cases',
          x: 2400,
          y: 200,
          width: 500,
          height: 200,
          color: '#ec4899', // Pink
          selected: false,
          zIndex: 5,
          hidden: true,  // Reveal on trigger 2
          demoGroup: 'features',
          data: {
            content: `# **Real-World Use Cases**

## **Math Tutoring**
"Explain the quadratic formula"
- LaTeX equation + interactive graph + step-by-step derivation

## **Biology Learning**
"Show me cellular respiration"
- Pathway diagram + molecular structures + spoken explanation

## **Code Education**
"How does recursion work?"
- Code examples + tree visualization + execution walkthrough

## **Design Concepts**
"Explain design patterns"
- Visual diagrams + real examples + best practices

**Perfect for STEM education, coding bootcamps, and self-study!**`,
          },
          metadata: {
            description: 'Teaching approaches',
          },
        },

        // 6. Teaching Modes (HIDDEN - Reveal on "what are your features?") - CONTINUES TREE
        {
          id: objectIds.teachingModes = `obj-${nanoid(8)}`,
          type: 'note',
          label: 'Teaching Modes',
          x: 3000,
          y: 200,
          width: 500,
          height: 200,
          color: '#06b6d4', // Cyan
          selected: false,
          zIndex: 6,
          hidden: true,  // Reveal on trigger 2
          demoGroup: 'features',
          data: {
            content: `# **Two Teaching Modes**

## **Socratic Mode** (Guided Discovery)
- Asks guiding questions
- Breaks concepts into small steps
- Checks understanding at checkpoints
- Perfect for deep learning

## **Direct Mode** (Quick Answers)
- Clear explanations
- Step-by-step solutions
- Fast reference
- Perfect for review`,
          },
          metadata: {
            description: 'Teaching approaches',
          },
        },

        // 7. Try It Now! (HIDDEN - Reveal on "what are your features?") - COMPLETES TREE
        {
          id: objectIds.demo = `obj-${nanoid(8)}`,
          type: 'note',
          label: 'Try It Now!',
          x: 3600,
          y: 200,
          width: 500,
          height: 200,
          color: '#10b981', // Green
          selected: false,
          zIndex: 7,
          hidden: true,  // Reveal on trigger 2
          demoGroup: 'features',
          data: {
            content: `# **Try It Now!**

**Getting Started:**
1. Click "New Session" to start fresh
2. Choose a subject (Math/Bio/Code/Design)
3. Ask a question via text or voice
4. Watch AI create visual objects on canvas
5. Interact with objects (drag, zoom, pan)
6. Ask follow-up questions

**Example Questions:**
- "What's the derivative of x squared?"
- "Explain photosynthesis with diagrams"
- "Show me how bubble sort works"
- "What is recursion?"

**The AI references existing canvas objects and maintains spatial awareness!**`,
          },
          metadata: {
            description: 'Quick start guide',
          },
        },
      ];

      // Add objects to the session
      placeholderObjects.forEach((obj) => {
        updateCanvasObject(sessionId, obj);
      });

      setInitialized(true);
    } catch (error) {
      console.error('Failed to create default lesson:', error);
    }
  };

  useEffect(() => {
    // Auto-create default lesson on page load if no sessions exist
    if (!initialized && sessions.length === 0) {
      const timer = setTimeout(() => {
        createDefaultLesson();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [initialized, sessions.length]);

  return null;
}
