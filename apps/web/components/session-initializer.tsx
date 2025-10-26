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

        // 1. Main Title (VISIBLE - Root node) - CENTER SCREEN
        {
          id: objectIds.title = `obj-${nanoid(8)}`,
          type: 'note',
          label: 'Mentora Platform',
          x: 400,
          y: 200,
          width: 800,
          height: 300,
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
          x: 1300,
          y: 200,
          width: 500,
          height: 200,
          color: '#3b82f6', // Blue
          selected: false,
          zIndex: 2,
          hidden: true,  // Reveal on trigger 1
          demoGroup: 'architecture',
          data: {
            content: `# **Mentora: Orchestrated Pipeline with Brains**

## **1. Input Processing**
Student speaks → mic audio → OpenAI Whisper → streamed transcript

## **2. Context Building**
Pull chat history + canvas metadata from ChromaDB
Read current canvas state and user selection
Build compact Context Bundle

## **3. Brain Routing**
Claude 3.5 Haiku classifies request → selects Brain
Output: { brain, teaching_style, toolplan }

## **4. Agent Generation**
Claude 4.5 Teaching Agent consumes Context + Brain
Plans pedagogy → executes MCP tools → streams ND-JSON patches

## **5. Canvas Creation**
Equations → KaTeX, Graphs → Python/SVG, Code → syntax highlighted
Infinite-canvas layout engine with auto-grouping

## **6. Live TTS & Sync**
SSML → OpenAI TTS-1 (streamed)
Cues keep narration and object highlights in sync

## **7. Persistence**
ChromaDB stores chat turns, canvas objects, and routing metadata

**Tech Stack**: Next.js 14, React 18, Claude 4.5, MCP Tools, ChromaDB`,
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
          x: 1900,
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

        // 4. Key Features (HIDDEN - Reveal on "what are you") - CONTINUES TREE
        {
          id: objectIds.keyFeatures = `obj-${nanoid(8)}`,
          type: 'note',
          label: 'Key Features',
          x: 2500,
          y: 200,
          width: 500,
          height: 250,
          color: '#10b981', // Green
          selected: false,
          zIndex: 4,
          hidden: true,  // Reveal on trigger 1
          demoGroup: 'architecture',
          data: {
            content: `# **Key Features**

## **Live Tutoring with Interruptions**
- Real-time voice interaction
- Natural conversation flow
- Interrupt and ask follow-ups anytime
- Context-aware responses

## **Interactive Canvas**
- Drag, resize, and manipulate objects
- Real-time visual demonstrations
- Spatial learning environment

## **Context Clues & Memory**
- Remembers previous conversations
- References canvas objects naturally
- Maintains spatial awareness
- Learns from interaction patterns

## **Multi-Subject Support**
- Mathematics with LaTeX
- Physics with simulations
- Biology with diagrams
- Computer Science with code

## **AI-Powered**
- Claude Sonnet 4.5 intelligence
- Context-aware responses
- Adaptive explanations

**Experience learning like never before!**`,
          },
          metadata: {
            description: 'Key features overview',
          },
        },

        // ==================== CONTINUATION OF TREE (STAGE 2) ====================

        // 5. LaTeX Component (HIDDEN - Reveal on "show me what you can do for math") - BRANCHES DOWN
        {
          id: objectIds.latex = `obj-${nanoid(8)}`,
          type: 'latex',
          label: 'Quadratic Formula',
          x: 2500,
          y: 500,
          width: 400,
          height: 200,
          color: '#f59e0b', // Amber
          selected: false,
          zIndex: 5,
          hidden: true,  // Reveal on trigger 2
          demoGroup: 'features',
          data: {
            latex: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
            rendered: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48dGV4dCB4PSIyMDAiIHk9IjUwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0iTWF0aCJzPnggPSA8L3RleHQ+PC9zdmc+'
          },
          metadata: {
            description: 'LaTeX quadratic formula example',
          },
        },

        // 6. Manim Video Component (HIDDEN - Reveal on "show me what you can do for math") - BRANCHES DOWN
        {
          id: objectIds.manim = `obj-${nanoid(8)}`,
          type: 'video',
          label: 'Manim Animation',
          x: 2500,
          y: 600,
          width: 500,
          height: 300,
          color: '#ec4899', // Pink
          selected: false,
          zIndex: 6,
          hidden: true,  // Reveal on trigger 2
          demoGroup: 'features',
          data: {
            type: 'video',
            url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
            alt: 'Manim mathematical animation'
          },
          metadata: {
            mimeType: 'video/mp4',
            size: 1024000,
            originalWidth: 500,
            originalHeight: 300,
            createdAt: Date.now()
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
