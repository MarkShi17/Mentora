'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useSessionStore } from '@/lib/session-store';
import { useOpenAITTS } from './use-openai-tts';

/**
 * Hook for detecting voice triggers in the demo session and revealing canvas objects.
 *
 * Trigger Patterns:
 * - "what are you" / "who are you" / "tell me about yourself" → Reveals 'architecture' group
 * - "what features" / "what can you do" / "show me features" → Reveals 'features' group
 */
export function useDemoVoiceHandler(sessionId: string | null) {
  const revealDemoObjects = useSessionStore((state) => state.revealDemoObjects);
  const addMessage = useSessionStore((state) => state.addMessage);
  const updateMessage = useSessionStore((state) => state.updateMessage);
  const messages = useSessionStore((state) =>
    sessionId ? state.messages[sessionId] || [] : []
  );
  const canvasObjects = useSessionStore((state) =>
    sessionId ? state.canvasObjects[sessionId] || [] : []
  );
  const settings = useSessionStore((state) => state.settings);
  
  // TTS for speaking the hardcoded response
  const { speak } = useOpenAITTS();

  // Track which groups have been revealed
  const revealedGroupsRef = useRef<Set<string>>(new Set());

  // Track the last processed message ID to avoid re-processing
  const lastProcessedMessageIdRef = useRef<string | null>(null);

  // Track if we're currently processing a response to prevent duplicates
  const isProcessingRef = useRef<boolean>(false);

  // Stable callback for adding messages
  const addMessageCallback = useCallback((sessionId: string, message: any) => {
    return addMessage(sessionId, message);
  }, [addMessage]);

  // Stable callback for speaking
  const speakCallback = useCallback((text: string, voice: string) => {
    speak(text, voice);
  }, [speak]);

  // Detect trigger phrases in text
  const detectTrigger = (text: string): 'architecture' | 'features' | null => {
    const lowerText = text.toLowerCase();
    console.log('🔍 Detecting trigger for text:', lowerText);

    // Trigger 2: "What are your features?" - reveals features, use cases, try it now
    // Check this FIRST because "what are your features" contains "what are you"
    const featureTriggers = [
      'what are your features',
      'what features',
      'features',
      'what can you do',
      'show me features',
      'your capabilities',
      'what capabilities',
      'show me what you can do',
      'tell me your features',
      'capabilities'
    ];

    if (featureTriggers.some((trigger) => lowerText.includes(trigger))) {
      console.log('✅ Features trigger detected');
      return 'features';
    }

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
      console.log('✅ Architecture trigger detected');
      return 'architecture';
    }

    console.log('❌ No trigger detected');
    return null;
  };

  // Listen for new messages and detect triggers
  useEffect(() => {
    console.log('🔍 Voice handler running:', {
      sessionId,
      messageCount: messages.length,
      hasMessages: messages.length > 0,
      canvasObjectCount: canvasObjects.length,
      demoMode: useSessionStore.getState().demoMode
    });

    if (!sessionId || messages.length === 0) {
      console.log('⏭️ Skipping: no session or no messages');
      return;
    }

    // Check if we're in demo mode
    const demoMode = useSessionStore.getState().demoMode;
    if (!demoMode.isDemoMode || demoMode.demoSessionId !== sessionId) {
      console.log('⏭️ Skipping: not in demo mode or wrong session', { demoMode, sessionId });
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
    console.log('🎯 Trigger detection result:', trigger, 'for message:', latestUnprocessedUserMessage.content);
    console.log('🎯 Revealed groups:', Array.from(revealedGroupsRef.current));
    console.log('🎯 Is processing:', isProcessingRef.current);

    if (trigger && !revealedGroupsRef.current.has(trigger) && !isProcessingRef.current) {
      // Mark as processing to prevent duplicates
      isProcessingRef.current = true;
      
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

        // In demo mode, we add the hardcoded response to chat AND speak it
        console.log('🎭 Demo mode - adding hardcoded response to chat and speaking it');
        
        // Get the hardcoded response
        const responseMessage = trigger === 'architecture'
          ? "I can definitely help with that! I'm Mentora, an AI tutor designed to help you learn through interactive, visual explanations on this infinite canvas workspace. Think of me as your personal teaching assistant who can create visual content in real-time to help concepts click. Let me show you what makes me unique by breaking down my core capabilities."
          : "I have several powerful features to help you learn effectively! I offer live voice tutoring with real-time conversation, create interactive visual content like diagrams and equations, integrate with specialized MCP tools for different subjects, and use advanced brain systems to adapt my teaching style. I support multiple subjects and can generate everything from mathematical graphs to molecular structures to help you understand complex topics.";

        // Add "Thinking..." message first (like real system) and get its ID
        const thinkingMessageId = addMessageCallback(sessionId, {
          role: 'assistant',
          content: 'Thinking...',
        });

        // Wait 2.5 seconds to simulate processing time
        setTimeout(() => {
          // Update the same message with the actual response
          updateMessage(sessionId, thinkingMessageId, {
            content: responseMessage,
          });

          // Speak the hardcoded response using TTS immediately (no delay)
          speakCallback(responseMessage, settings.voice);
          
          // For features trigger, find the last revealed object to continue the chain
          let sourceObjectId = sourceObject.id;
          if (trigger === 'features') {
            // Find the last revealed object (How It Works) to continue the chain from
            const lastRevealedObject = canvasObjects.find(
              (obj) => obj.demoGroup === 'architecture' && !obj.hidden && obj.label === 'How It Works'
            );
            if (lastRevealedObject) {
              sourceObjectId = lastRevealedObject.id;
              console.log('🔗 Continuing tree from last revealed object:', lastRevealedObject.label);
            }
          }
          
          // Reveal the demo objects with connections
          revealDemoObjects(sessionId, trigger, sourceObjectId);
        }, 2500);
        
        // Reset processing flag after a delay to allow for future triggers
        setTimeout(() => {
          isProcessingRef.current = false;
        }, 5000); // 5 second cooldown
      } else {
        console.warn('⚠️ No source object found for demo reveal');
        isProcessingRef.current = false;
      }
    } else if (trigger) {
      console.log(`⏭️ Trigger "${trigger}" already revealed or processing`);
    }
  }, [sessionId, messages, canvasObjects, revealDemoObjects, addMessageCallback, speakCallback, settings.voice]);

  // Reset revealed groups and processed message ID when session changes
  useEffect(() => {
    revealedGroupsRef.current.clear();
    lastProcessedMessageIdRef.current = null;
    isProcessingRef.current = false;
  }, [sessionId]);
}
