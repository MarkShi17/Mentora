'use client';

import { useEffect, useState } from 'react';
import { useSessionStore } from '@/lib/session-store';
import { nanoid } from '@/lib/utils';
import type { CanvasObject, ConnectionAnchor } from '@/types';

export function SessionInitializer() {
  const [initialized, setInitialized] = useState(false);
  const sessions = useSessionStore((state) => state.sessions);
  const createSession = useSessionStore((state) => state.createSession);
  const updateCanvasObject = useSessionStore((state) => state.updateCanvasObject);
  const createConnection = useSessionStore((state) => state.createConnection);

  const createDefaultLesson = async () => {
    try {
      // Create default session
      const title = 'Welcome to Mentora';
      const sessionId = await createSession({ title });

      // Store object IDs for creating connections
      const objectIds: Record<string, string> = {};

      // Create landing page style introduction with organized sections
      // Layout designed to fit on screen (viewport ~1920x1080) without zooming
      const placeholderObjects: CanvasObject[] = [
        // ==================== TOP ROW ====================
        // Main Hero Introduction (Top Left)
        {
          id: objectIds.hero = `obj-${nanoid(8)}`,
          type: 'note',
          label: '',
          x: -650,
          y: -250,
          width: 400,
          height: 190,
          color: '#6366f1', // Indigo
          selected: false,
          zIndex: 1,
          data: {
            content: `# **Welcome to Mentora**

Your personal AI tutor that speaks, visualizes, and guides you through any subject.

Ask questions naturally and get instant spoken explanations with dynamic visual aids. Build your knowledge on an infinite canvas where concepts connect and grow.

Perfect for students, professionals, and lifelong learners.`,
          },
          metadata: {
            description: 'Hero section introducing Mentora',
          },
        },

        // Live Example Demo (Top Center)
        {
          id: objectIds.demoHeader = `obj-${nanoid(8)}`,
          type: 'note',
          label: 'Live Example',
          x: 150,
          y: -250,
          width: 380,
          height: 130,
          color: '#8b5cf6', // Purple
          selected: false,
          zIndex: 2,
          data: {
            content: `# Example: Acceleration

"Explain how acceleration works"

Mentora will speak the explanation while generating visual aids in real-time. Experience teaching that adapts to how you learn.`,
          },
          metadata: {
            description: 'Demo section introduction',
          },
        },

        // Acceleration Animation (Top Right)
        {
          id: objectIds.video = `obj-${nanoid(8)}`,
          type: 'video',
          label: 'Acceleration Animation',
          x: 950,
          y: -250,
          width: 460,
          height: 300,
          color: '#ec4899', // Pink
          selected: false,
          zIndex: 5,
          data: {
            url: '/acceleration.gif',
            alt: 'Pre-generated Manim animation explaining acceleration'
          },
          metadata: {
            description: 'Pre-generated Manim MCP visualization showing acceleration concepts',
          },
        },

        // ==================== MIDDLE ROW ====================
        // Features Overview (Middle Left)
        {
          id: objectIds.features = `obj-${nanoid(8)}`,
          type: 'note',
          label: '',
          x: -650,
          y: 80,
          width: 400,
          height: 280,
          color: '#06b6d4', // Cyan
          selected: false,
          zIndex: 3,
          data: {
            content: `# **Key Features**

## **Live Voice Tutor**
Speak naturally and get spoken responses. Contextual teaching that listens and adapts.

## **Interactive Canvas**
Organize, connect, and explore ideas spatially. Build your knowledge map visually.

**Visual Learning** Dynamic diagrams, equations, animations, and code. Concepts come alive as you learn.

**Multi-Subject Expertise** Mathematics, physics, biology, programming, design, and more.`,
          },
          metadata: {
            description: 'Feature highlights and instructions',
          },
        },

        // Physics Formula (Middle Center)
        {
          id: objectIds.formula = `obj-${nanoid(8)}`,
          type: 'latex',
          label: 'Physics Formula',
          x: 150,
          y: 80,
          width: 380,
          height: 130,
          color: '#f59e0b', // Amber
          selected: false,
          zIndex: 4,
          data: {
            latex: 'a = \\frac{\\Delta v}{\\Delta t} = \\frac{v_f - v_i}{t}',
          },
          metadata: {
            description: 'Acceleration formula in demo',
          },
        },

        // ==================== BOTTOM ROW ====================
        // Get Started CTA (Bottom Center)
        {
          id: objectIds.cta = `obj-${nanoid(8)}`,
          type: 'note',
          label: '',
          x: 150,
          y: 390,
          width: 380,
          height: 160,
          color: '#10b981', // Green
          selected: false,
          zIndex: 6,
          data: {
            content: `# **Get Started**

Click the microphone to begin your conversation with Mentora.

**Example questions to try:**

- Explain the water cycle
- Show me how binary search works
- What is photosynthesis?

Start speaking now and experience interactive learning.`,
          },
          metadata: {
            description: 'Call to action with example questions',
          },
        },
      ];

      // Add objects to the session
      placeholderObjects.forEach((obj) => {
        updateCanvasObject(sessionId, obj);
      });

      // Create intuitive connections following the layout flow
      // Top row: Hero → Demo Header
      createConnection(sessionId, objectIds.hero, objectIds.demoHeader, 'east', 'west');

      // Demo Header → Video (demo includes animation)
      createConnection(sessionId, objectIds.demoHeader, objectIds.video, 'east', 'north');

      // Hero → Features (vertical flow down left side)
      createConnection(sessionId, objectIds.hero, objectIds.features, 'south', 'north');

      // Demo Header → Formula (vertical flow down center)
      createConnection(sessionId, objectIds.demoHeader, objectIds.formula, 'south', 'north');

      // Formula → Video (formula visualized in animation)
      createConnection(sessionId, objectIds.formula, objectIds.video, 'east', 'south');

      // Formula → CTA (center flow downward)
      createConnection(sessionId, objectIds.formula, objectIds.cta, 'south', 'north');

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
