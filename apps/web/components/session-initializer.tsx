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

      // Create two placeholder canvas objects
      const placeholderObjects: CanvasObject[] = [
        {
          id: `obj-${nanoid(8)}`,
          type: 'note' as any, // Using 'note' which maps to 'text' rendering
          label: 'Getting Started',
          x: -200,
          y: -100,
          width: 400,
          height: 200,
          color: '#3b82f6', // Blue
          selected: false,
          zIndex: 1,
          data: {
            content: 'Welcome to Mentora! 🎓\n\n• Ask me any question to get started\n• I can create diagrams, equations, and code examples\n• Try selecting objects on the canvas',
          },
          metadata: {
            description: 'Welcome message with instructions',
          },
        },
        {
          id: `obj-${nanoid(8)}`,
          type: 'diagram' as any,
          label: 'Example Diagram',
          x: 200,
          y: -100,
          width: 300,
          height: 300,
          color: '#8b5cf6', // Purple
          selected: false,
          zIndex: 2,
          data: {
            svg: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
              <circle cx="100" cy="100" r="80" fill="#8b5cf6" fill-opacity="0.2" stroke="#8b5cf6" stroke-width="2"/>
              <text x="100" y="105" text-anchor="middle" font-size="16" fill="#1e293b" font-family="Arial">Click to select</text>
            </svg>`,
          },
          metadata: {
            description: 'Example placeholder diagram',
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
