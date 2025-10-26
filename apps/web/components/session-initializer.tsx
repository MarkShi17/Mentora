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

  const createDefaultLesson = async () => {
    try {
      // Create default session
      const title = 'Welcome to Mentora';
      const sessionId = await createSession({ title });

      // Store object IDs for creating connections
      const objectIds: Record<string, string> = {};

      // Create landing page layout - components spaced horizontally across the screen
      // Layout: positioned between left sidebar and right edge, centered vertically
      // Each component has its own space - like a proper landing page
      const placeholderObjects: CanvasObject[] = [
        // ==================== HORIZONTAL LANDING PAGE LAYOUT ====================
        // Welcome Introduction (Left)
        {
          id: objectIds.hero = `obj-${nanoid(8)}`,
          type: 'note',
          label: 'Welcome',
          x: 200, // Centered in screen
          y: 200, // Centered vertically
          width: 300,
          height: 200,
          color: '#6366f1', // Indigo
          selected: false,
          zIndex: 1,
          data: {
            content: `# **Welcome to Mentora**

Your personal AI tutor that speaks, visualizes, and guides you through any subject.

Ask questions naturally and get instant spoken explanations with dynamic visual aids.`,
          },
          metadata: {
            description: 'Hero section introducing Mentora',
          },
        },

        // Acceleration Video (Center Left)
        {
          id: objectIds.acceleration = `obj-${nanoid(8)}`,
          type: 'video',
          label: 'What is Acceleration?',
          x: 550, // Centered
          y: 200,
          width: 300,
          height: 200,
          color: '#f59e0b', // Amber
          selected: false,
          zIndex: 2,
          data: {
            type: 'video',
            url: '/acceleration.gif', // Pre-loaded Manim animation
            alt: 'Manim animation explaining acceleration concept'
          },
          metadata: {
            description: 'Interactive Manim video explaining acceleration concept',
            createdAt: Date.now()
          },
        },

        // Features Overview (Center Right)
        {
          id: objectIds.features = `obj-${nanoid(8)}`,
          type: 'note',
          label: 'Key Features',
          x: 900, // Centered
          y: 200,
          width: 300,
          height: 200,
          color: '#06b6d4', // Cyan
          selected: false,
          zIndex: 3,
          data: {
            content: `# **Key Features**

## **Live Voice Tutor**
Speak naturally and get spoken responses.

## **Interactive Canvas**
Organize and explore ideas spatially.

## **Visual Learning**
Dynamic diagrams, equations, and animations.`,
          },
          metadata: {
            description: 'Feature highlights',
          },
        },

        // Get Started CTA (Right)
        {
          id: objectIds.cta = `obj-${nanoid(8)}`,
          type: 'note',
          label: 'Get Started',
          x: 1250, // Right side
          y: 200,
          width: 300,
          height: 200,
          color: '#10b981', // Green
          selected: false,
          zIndex: 4,
          data: {
            content: `# **Ready to Start Learning?**

Click the microphone button to begin your conversation with Mentora.

**Example questions to try:**
- "What is acceleration?"
- "Explain the water cycle"
- "Show me how binary search works" 
- "What is photosynthesis?"

Start speaking now!`,
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
