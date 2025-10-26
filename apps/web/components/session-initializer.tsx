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

      // Create highly spaced layout - components very spread out, positioned far up and left
      // Layout: positioned in upper-left area of viewport, maximum separation
      const placeholderObjects: CanvasObject[] = [
        // ==================== HIGHLY SPACED LAYOUT ====================
        // Welcome Introduction (Top Left)
        {
          id: objectIds.hero = `obj-${nanoid(8)}`,
          type: 'note',
          label: 'Welcome',
          x: 20, // Much further left
          y: 40, // Much higher up
          width: 280,
          height: 180,
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

        // Acceleration Video (Top Right)
        {
          id: objectIds.acceleration = `obj-${nanoid(8)}`,
          type: 'video',
          label: 'What is Acceleration?',
          x: 500, // Much further right for maximum separation
          y: 40, // Much higher up
          width: 280,
          height: 180,
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

        // Features Overview (Bottom Left)
        {
          id: objectIds.features = `obj-${nanoid(8)}`,
          type: 'note',
          label: 'Key Features',
          x: 20, // Much further left
          y: 300, // Much lower down for maximum vertical separation
          width: 280,
          height: 180,
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

        // Get Started CTA (Bottom Right)
        {
          id: objectIds.cta = `obj-${nanoid(8)}`,
          type: 'note',
          label: 'Get Started',
          x: 500, // Much further right for maximum separation
          y: 300, // Much lower down for maximum vertical separation
          width: 280,
          height: 180,
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
