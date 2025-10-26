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
        // ==================== HERO SECTION ====================
        // Main Hero Introduction
        {
          id: objectIds.hero = `obj-${nanoid(8)}`,
          type: 'note',
          label: '',
          x: -650,
          y: -350,
          width: 520,
          height: 250,
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

        // ==================== DEMO CONTAINER ====================
        // Demo Introduction Label
        {
          id: objectIds.demoHeader = `obj-${nanoid(8)}`,
          type: 'note',
          label: 'Live Example',
          x: 80,
          y: -350,
          width: 500,
          height: 180,
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

        // Demo: LaTeX Formula for acceleration
        {
          id: objectIds.formula = `obj-${nanoid(8)}`,
          type: 'latex',
          label: 'Physics Formula',
          x: 80,
          y: -150,
          width: 500,
          height: 200,
          color: '#f59e0b', // Amber
          selected: false,
          zIndex: 5,
          data: {
            latex: 'a = \\frac{\\Delta v}{\\Delta t} = \\frac{v_f - v_i}{t}',
          },
          metadata: {
            description: 'Acceleration formula in demo',
          },
        },

        // Demo: Pre-generated Manim Acceleration Animation
        {
          id: objectIds.video = `obj-${nanoid(8)}`,
          type: 'video',
          label: 'Acceleration Animation',
          x: 620,
          y: -350,
          width: 600,
          height: 400,
          color: '#ec4899', // Pink
          selected: false,
          zIndex: 6,
          data: {
            url: '/acceleration.gif',
            alt: 'Pre-generated Manim animation explaining acceleration'
          },
          metadata: {
            description: 'Pre-generated Manim MCP visualization showing acceleration concepts',
          },
        },

        // ==================== FEATURES SECTION ====================
        // Features Overview
        {
          id: objectIds.features = `obj-${nanoid(8)}`,
          type: 'note',
          label: '',
          x: -650,
          y: 20,
          width: 520,
          height: 380,
          color: '#06b6d4', // Cyan
          selected: false,
          zIndex: 7,
          data: {
            content: `# **Key Features**


## **Live Voice Tutor**
Speak naturally and get spoken responses. Contextual teaching that listens and adapts.

## **Interactive Canvas**
Organize, connect, and explore ideas spatially. Build your knowledge map visually.

**Visual Learning**
Dynamic diagrams, equations, animations, and code. Concepts come alive as you learn.

**Multi-Subject Expertise**
Mathematics, physics, biology, programming, design, and more.`,
          },
          metadata: {
            description: 'Feature highlights and instructions',
          },
        },

        // ==================== CALL TO ACTION ====================
        // Get Started CTA
        {
          id: objectIds.cta = `obj-${nanoid(8)}`,
          type: 'note',
          label: '',
          x: -650,
          y: 420,
          width: 520,
          height: 180,
          color: '#10b981', // Green
          selected: false,
          zIndex: 8,
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

      // Create intuitive connections between related components
      // Hero → Demo Header (showing flow from intro to example)
      createConnection(sessionId, objectIds.hero, objectIds.demoHeader, 'east', 'west');

      // Demo Header → Formula (example includes formula)
      createConnection(sessionId, objectIds.demoHeader, objectIds.formula, 'south', 'north');

      // Demo Header → Video (example includes animation)
      createConnection(sessionId, objectIds.demoHeader, objectIds.video, 'east', 'west');

      // Formula → Video (formula visualized in video)
      createConnection(sessionId, objectIds.formula, objectIds.video, 'east', 'west');

      // Hero → Features (hero mentions features)
      createConnection(sessionId, objectIds.hero, objectIds.features, 'south', 'north');

      // Features → CTA (features lead to getting started)
      createConnection(sessionId, objectIds.features, objectIds.cta, 'south', 'north');

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
