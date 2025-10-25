'use client';

import { useEffect, useState } from 'react';
import { useSessionStore } from '@/lib/session-store';
import { Button } from '@/components/ui/button';

export function SessionInitializer() {
  const [initialized, setInitialized] = useState(false);
  const sessions = useSessionStore((state) => state.sessions);
  const createSession = useSessionStore((state) => state.createSession);

  const handleCreateSession = async () => {
    try {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      const displayMinutes = minutes.toString().padStart(2, '0');
      const timeString = `${displayHours}:${displayMinutes} ${ampm}`;
      const title = `New Lesson ${timeString}`;
      
      await createSession({ title });
      setInitialized(true);
    } catch (error) {
      console.error("Failed to create session:", error);
    }
  };

  // No longer auto-create sessions - let users create them by typing
  // useEffect(() => {
  //   // Auto-create session after a short delay
  //   const timer = setTimeout(() => {
  //     if (sessions.length === 0) {
  //       handleCreateSession();
  //     }
  //   }, 1000);

  //   return () => clearTimeout(timer);
  // }, [sessions.length]);

  // No longer show welcome screen - users can type directly
  return null;
}
