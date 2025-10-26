'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useSessionStore } from '@/lib/session-store';
import { useOpenAITTS } from './use-openai-tts';

// Cached demo responses - completely hardcoded
const DEMO_RESPONSES = {
  architecture: {
    text: "I'm Mentora, an AI-powered tutoring platform. Let me show you how I work by breaking down my technical foundation.",
  },
  features: {
    text: "Let me show you what I can do for math! I can create beautiful LaTeX equations and generate interactive Manim animations to help you visualize mathematical concepts.",
  }
};

// Audio cache for instant playback (in-memory + localStorage)
const audioCache = new Map<string, HTMLAudioElement>();

// Helper functions for localStorage audio caching
const getCachedAudioUrl = (cacheKey: string): string | null => {
  try {
    return localStorage.getItem(`mentora_tts_${cacheKey}`);
  } catch (error) {
    console.warn('Failed to get cached audio from localStorage:', error);
    return null;
  }
};

const setCachedAudioUrl = (cacheKey: string, audioUrl: string): void => {
  try {
    localStorage.setItem(`mentora_tts_${cacheKey}`, audioUrl);
  } catch (error) {
    console.warn('Failed to cache audio in localStorage:', error);
  }
};

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


  // Pre-generate and cache TTS audio
  const preGenerateTTS = useCallback(async (voice: string) => {
    console.log('🎵 Pre-generating TTS audio for demo responses...');
    
    for (const [key, response] of Object.entries(DEMO_RESPONSES)) {
      const cacheKey = `${response.text}-${voice}`;
      
      // Check if we already have it in memory
      if (audioCache.has(cacheKey)) {
        console.log(`✅ Audio already cached in memory for ${key}`);
        continue;
      }
      
      // Check localStorage first
      const cachedUrl = getCachedAudioUrl(cacheKey);
      if (cachedUrl) {
        try {
          const audio = new Audio();
          audio.src = cachedUrl;
          audioCache.set(cacheKey, audio);
          console.log(`✅ Loaded cached audio from localStorage for ${key}`);
          continue;
        } catch (error) {
          console.warn(`⚠️ Failed to load cached audio for ${key}:`, error);
        }
      }
      
      // Generate new audio if not cached
      try {
        const ttsResponse = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: response.text, voice })
        });
        
        if (ttsResponse.ok) {
          const data = await ttsResponse.json();
          const audio = new Audio();
          
          // Convert base64 to blob URL
          const binaryString = atob(data.audio);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: 'audio/mp3' });
          const audioUrl = URL.createObjectURL(blob);
          
          // Cache in localStorage for persistence
          setCachedAudioUrl(cacheKey, audioUrl);
          
          audio.src = audioUrl;
          audioCache.set(cacheKey, audio);
          console.log(`✅ Generated and cached TTS audio for ${key}`);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to pre-generate TTS for ${key}:`, error);
      }
    }
  }, []);

  // Cached TTS function - uses pre-generated audio
  const speakCached = useCallback((text: string, voice: string, onComplete?: () => void) => {
    const cacheKey = `${text}-${voice}`;
    
    // Check if we have cached audio in memory
    if (audioCache.has(cacheKey)) {
      const audio = audioCache.get(cacheKey)!;
      audio.currentTime = 0;
      audio.play();
      
      if (onComplete) {
        audio.onended = onComplete;
      }
      console.log('🎵 Playing cached audio from memory');
      return;
    }
    
    // Check localStorage as fallback
    const cachedUrl = getCachedAudioUrl(cacheKey);
    if (cachedUrl) {
      try {
        const audio = new Audio();
        audio.src = cachedUrl;
        audio.currentTime = 0;
        audio.play();
        
        if (onComplete) {
          audio.onended = onComplete;
        }
        console.log('🎵 Playing cached audio from localStorage');
        return;
      } catch (error) {
        console.warn('⚠️ Failed to play cached audio from localStorage:', error);
      }
    }

    // Fallback to regular TTS if not cached
    console.warn('⚠️ Audio not cached, using fallback TTS');
    speak(text, voice as any, onComplete);
  }, [speak]);

  // Stable callback for speaking
  const speakCallback = useCallback((text: string, voice: string, onComplete?: () => void) => {
    speak(text, voice as any, onComplete);
  }, [speak]);

  // Detect trigger phrases in text
  const detectTrigger = (text: string): 'architecture' | 'features' | null => {
    const lowerText = text.toLowerCase();
    console.log('🔍 Detecting trigger for text:', lowerText);

    // Trigger 2: "What can you do for math" - reveals math examples with LaTeX and Manim
    // Check this FIRST because "show me what you can do" contains "what are you"
    const featureTriggers = [
      'show me what you can do for math',
      'what can you do for math',
      'show me math examples',
      'math capabilities',
      'mathematical examples',
      'latex examples',
      'manim examples',
      'show me latex',
      'show me manim',
      'math features'
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
         const response = DEMO_RESPONSES[trigger];
         const responseSentences = response.text.split('. ').map(s => s.trim() + (s.endsWith('.') ? '' : '.'));

        // Add "Thinking..." message first (like real system) and get its ID
        const thinkingMessageId = addMessageCallback(sessionId, {
          role: 'assistant',
          content: 'Thinking...',
        });

         // Wait 1 second to simulate processing time (much shorter)
         setTimeout(() => {
           // Update with full response immediately
           updateMessage(sessionId, thinkingMessageId, {
             content: response.text,
           });

           // Start TTS immediately
           if (trigger === 'architecture') {
             // Architecture: TTS for entire response with completion callback
             speakCached(response.text, settings.voice, () => {
               console.log('🎤 TTS completed, revealing architecture components');
               console.log('🏗️ Revealing Architecture component after TTS completes');
               revealDemoObjects(sessionId, 'architecture', sourceObject.id);
               
               // Also reveal Key Features component after a short delay
               setTimeout(() => {
                 console.log('🎯 Revealing Key Features component');
                 const architectureObject = canvasObjects.find(
                   (obj) => obj.demoGroup === 'architecture' && !obj.hidden && obj.label === 'Architecture'
                 );
                 if (architectureObject) {
                   revealDemoObjects(sessionId, 'architecture', architectureObject.id);
                 }
               }, 1000);
             });
           } else if (trigger === 'features') {
             // Features: TTS for entire response with completion callback
             speakCached(response.text, settings.voice, () => {
               console.log('🎤 Features TTS completed, revealing components one by one');
               
               // Find the Key Features object to branch from
               const keyFeaturesObject = canvasObjects.find(
                 (obj) => obj.demoGroup === 'architecture' && !obj.hidden && obj.label === 'Key Features'
               );
               let sourceObjectId = sourceObject.id;
               if (keyFeaturesObject) {
                 sourceObjectId = keyFeaturesObject.id;
                 console.log('🔗 Branching from Key Features object:', keyFeaturesObject.label);
               }
               
               // Reveal components one by one with delays
               setTimeout(() => {
                 console.log('🎯 Revealing LaTeX component');
                 revealDemoObjects(sessionId, 'features', sourceObjectId);
               }, 500);
               
               setTimeout(() => {
                 console.log('🎯 Revealing Manim video component');
                 const latexObject = canvasObjects.find(
                   (obj) => obj.demoGroup === 'features' && !obj.hidden && obj.label === 'Quadratic Formula'
                 );
                 if (latexObject) {
                   revealDemoObjects(sessionId, 'features', latexObject.id);
                 }
               }, 2000);
             });
           }
         }, 1000);
        
        // Reset processing flag after TTS starts to allow for future triggers
        setTimeout(() => {
          isProcessingRef.current = false;
        }, 3000); // 3 second cooldown - reset after TTS starts
      } else {
        console.warn('⚠️ No source object found for demo reveal');
        isProcessingRef.current = false;
      }
    } else if (trigger) {
      console.log(`⏭️ Trigger "${trigger}" blocked - already revealed: ${revealedGroupsRef.current.has(trigger)}, processing: ${isProcessingRef.current}`);
    }
  }, [sessionId, messages, canvasObjects, revealDemoObjects, addMessageCallback, speakCached, settings.voice]);

  // Pre-generate TTS audio when component mounts
  useEffect(() => {
    if (sessionId && settings.voice) {
      preGenerateTTS(settings.voice);
    }
  }, [sessionId, settings.voice, preGenerateTTS]);

  // Reset revealed groups and processed message ID when session changes
  useEffect(() => {
    revealedGroupsRef.current.clear();
    lastProcessedMessageIdRef.current = null;
    isProcessingRef.current = false;
  }, [sessionId]);
}
