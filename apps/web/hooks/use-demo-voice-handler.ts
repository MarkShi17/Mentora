'use client';

import { useEffect, useRef } from 'react';
import { useSessionStore } from '@/lib/session-store';

/**
 * Hook for detecting voice triggers in the demo session and revealing canvas objects.
 *
 * Trigger Patterns:
 * - "what are you" / "who are you" / "tell me about yourself" → Reveals 'architecture' group
 * - "what features" / "what can you do" / "show me features" → Reveals 'features' group
 */
export function useDemoVoiceHandler(sessionId: string | null) {
  const revealDemoObjects = useSessionStore((state) => state.revealDemoObjects);
  const messages = useSessionStore((state) =>
    sessionId ? state.messages[sessionId] || [] : []
  );
  const canvasObjects = useSessionStore((state) =>
    sessionId ? state.canvasObjects[sessionId] || [] : []
  );

  // Track which groups have been revealed
  const revealedGroupsRef = useRef<Set<string>>(new Set());

  // Track the last processed message ID to avoid re-processing
  const lastProcessedMessageIdRef = useRef<string | null>(null);

  // Detect trigger phrases in text
  const detectTrigger = (text: string): 'architecture' | 'features' | null => {
    const lowerText = text.toLowerCase();

    // Trigger 1: "What are you?" - reveals architecture & how it works
    const architectureTriggers = [
      'what are you',
      'who are you',
      'tell me about yourself',
      'what is mentora',
      'tell me about mentora',
      'describe yourself',
      'what do you do'
    ];

    if (architectureTriggers.some((trigger) => lowerText.includes(trigger))) {
      return 'architecture';
    }

    // Trigger 2: "What are your features?" - reveals features, use cases, try it now
    const featureTriggers = [
      'features',
      'what features',
      'what are your features',
      'what can you do',
      'show me features',
      'your capabilities',
      'what capabilities',
      'show me what you can do',
      'tell me your features',
      'capabilities'
    ];

    if (featureTriggers.some((trigger) => lowerText.includes(trigger))) {
      return 'features';
    }

    return null;
  };

  // Listen for new messages and detect triggers
  useEffect(() => {
    console.log('🔍 Voice handler running:', {
      sessionId,
      messageCount: messages.length,
      hasMessages: messages.length > 0,
      canvasObjectCount: canvasObjects.length
    });

    if (!sessionId || messages.length === 0) {
      console.log('⏭️ Skipping: no session or no messages');
      return;
    }

    // Find the most recent user message that we haven't processed yet
    // We need to iterate backwards because assistant messages come after user messages
    let latestUnprocessedUserMessage = null;

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];

      // Stop if we've reached a message we already processed
      if (msg.id === lastProcessedMessageIdRef.current) {
        break;
      }

      // Found a user message we haven't processed
      if (msg.role === 'user') {
        latestUnprocessedUserMessage = msg;
        break;
      }
    }

    console.log('📩 Latest unprocessed user message:', latestUnprocessedUserMessage?.content || 'none');

    if (!latestUnprocessedUserMessage) {
      console.log('⏭️ Skipping: no new user messages');
      return;
    }

    // Mark this message as processed
    lastProcessedMessageIdRef.current = latestUnprocessedUserMessage.id;

    const trigger = detectTrigger(latestUnprocessedUserMessage.content);
    console.log('🎯 Trigger detection result:', trigger);

    if (trigger && !revealedGroupsRef.current.has(trigger)) {
      // Mark as revealed to prevent duplicate reveals
      revealedGroupsRef.current.add(trigger);

      console.log(`🎯 Demo trigger detected: "${trigger}" from message: "${latestUnprocessedUserMessage.content}"`);

      // Find the source object (main title) to create connections from
      const sourceObject = canvasObjects.find(
        (obj) => obj.demoGroup === 'intro' && !obj.hidden
      );

      console.log('🔍 Canvas objects:', canvasObjects.map(o => ({
        label: o.label,
        demoGroup: o.demoGroup,
        hidden: o.hidden
      })));

      if (sourceObject) {
        console.log(`✅ Found source object: ${sourceObject.id}, revealing objects...`);
        revealDemoObjects(sessionId, trigger, sourceObject.id);
      } else {
        console.warn('⚠️ No source object found for demo reveal');
      }
    } else if (trigger) {
      console.log(`⏭️ Trigger "${trigger}" already revealed`);
    }
  }, [sessionId, messages, canvasObjects, revealDemoObjects]);

  // Reset revealed groups and processed message ID when session changes
  useEffect(() => {
    revealedGroupsRef.current.clear();
    lastProcessedMessageIdRef.current = null;
  }, [sessionId]);
}
