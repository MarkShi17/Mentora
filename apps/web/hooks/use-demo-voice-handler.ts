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
  },
  inspiration: {
    text: "Great question! The inspiration came from watching how humans actually teach. When we learn from a person, they don't just talk - they draw, gesture, highlight, and point to things as they explain. We wanted to recreate that natural dynamic on a digital canvas.",
  }
};

// Audio cache for instant playback (in-memory + localStorage)
const audioCache = new Map<string, HTMLAudioElement>();

// Helper functions for localStorage audio caching
const getCachedAudioData = (cacheKey: string): string | null => {
  try {
    return localStorage.getItem(`mentora_tts_${cacheKey}`);
  } catch (error) {
    console.warn('Failed to get cached audio from localStorage:', error);
    return null;
  }
};

const setCachedAudioData = (cacheKey: string, base64Data: string): void => {
  try {
    // Check if data is too large for localStorage
    const sizeInBytes = new Blob([base64Data]).size;
    if (sizeInBytes > 4 * 1024 * 1024) { // 4MB limit
      console.warn('Audio too large for localStorage, skipping cache');
      return;
    }
    localStorage.setItem(`mentora_tts_${cacheKey}`, base64Data);
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
      const cachedBase64 = getCachedAudioData(cacheKey);
      if (cachedBase64) {
        try {
          const audio = new Audio();
          audio.src = `data:audio/mp3;base64,${cachedBase64}`;
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
          
          // Store base64 data directly
          audio.src = `data:audio/mp3;base64,${data.audio}`;
          
          // Cache base64 data in localStorage for persistence
          setCachedAudioData(cacheKey, data.audio);
          
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
    const cachedBase64 = getCachedAudioData(cacheKey);
    if (cachedBase64) {
      try {
        const audio = new Audio();
        audio.src = `data:audio/mp3;base64,${cachedBase64}`;
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
  const detectTrigger = (text: string): 'architecture' | 'features' | 'inspiration' | null => {
    const lowerText = text.toLowerCase();
    console.log('🔍 Detecting trigger for text:', lowerText);

    // Trigger 3: "How were you made" - reveals inspiration component
    const inspirationTriggers = [
      'how were you made',
      'how were you created',
      'what inspired you',
      'where did the idea come from',
      'how did you come to be',
      'what was the inspiration',
      'tell me about your creation',
      'how did this start'
    ];

    if (inspirationTriggers.some((trigger) => lowerText.includes(trigger))) {
      console.log('✅ Inspiration trigger detected');
      return 'inspiration';
    }

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

    // Determine which step we're on based on revealed groups
    let currentStep = 'architecture';
    if (revealedGroupsRef.current.has('architecture') && !revealedGroupsRef.current.has('features')) {
      currentStep = 'features';
    } else if (revealedGroupsRef.current.has('features') && !revealedGroupsRef.current.has('inspiration')) {
      currentStep = 'inspiration';
    } else if (revealedGroupsRef.current.has('inspiration')) {
      // All steps completed, don't process
      console.log('⏭️ All demo steps completed');
      return;
    }

    console.log('🎯 Auto-proceeding to step:', currentStep, 'for message:', latestUnprocessedUserMessage.content);
    console.log('🎯 Revealed groups:', Array.from(revealedGroupsRef.current));
    console.log('🎯 Is processing:', isProcessingRef.current);

    if (!isProcessingRef.current) {
      // Mark as processing to prevent duplicates
      isProcessingRef.current = true;
      
      // Mark as revealed to prevent duplicate reveals
      revealedGroupsRef.current.add(currentStep);

      console.log(`🎯 Demo step proceeding: "${currentStep}" from message: "${latestUnprocessedUserMessage.content}"`);

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
         const response = DEMO_RESPONSES[currentStep];
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
           if (currentStep === 'architecture') {
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
           } else if (currentStep === 'features') {
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
           } else if (currentStep === 'inspiration') {
             // Inspiration: TTS for entire response with completion callback
             speakCached(response.text, settings.voice, () => {
               console.log('🎤 Inspiration TTS completed, revealing inspiration component');
               
               // Find the Manim video object to branch from
               const manimObject = canvasObjects.find(
                 (obj) => obj.demoGroup === 'features' && !obj.hidden && obj.label === 'Manim Animation'
               );
               let sourceObjectId = sourceObject.id;
               if (manimObject) {
                 sourceObjectId = manimObject.id;
                 console.log('🔗 Branching from Manim object:', manimObject.label);
               }
               
               // Reveal inspiration component
               setTimeout(() => {
                 console.log('🎯 Revealing Inspiration component');
                 revealDemoObjects(sessionId, 'inspiration', sourceObjectId);
               }, 500);
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
