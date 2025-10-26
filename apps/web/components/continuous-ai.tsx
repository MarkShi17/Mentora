'use client';

import { useEffect, useState, useCallback, useRef } from "react";
import { cn } from "@/lib/cn";
import { useContinuousAI } from "@/hooks/use-continuous-ai";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { useSessionStore } from "@/lib/session-store";
import { useStreamingQA } from "@/hooks/use-streaming-qa";
import { useSequentialConnections } from "@/hooks/use-sequential-connections";
import { Brain } from "lucide-react";

export function ContinuousAI() {
  const [isActive, setIsActive] = useState(false);
  const [wasListeningBeforeSpeech, setWasListeningBeforeSpeech] = useState(false);
  const [interrupted, setInterrupted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const sessions = useSessionStore((state) => state.sessions);
  const allMessages = useSessionStore((state) => state.messages);
  const voiceInputState = useSessionStore((state) => state.voiceInputState);

  // Live Tutor mode (continuous AI with question detection)
  const {
    isListening: liveTutorListening,
    currentTranscript: liveTutorTranscript,
    conversationContext,
    supported: liveTutorSupported,
    error: liveTutorError,
    startListening: startLiveTutor,
    stopListening: stopLiveTutor,
    pauseListening,
    resumeListening,
    setQuestionCallback,
    forceProcessTranscript,
    setLastAIMessage
  } = useContinuousAI();

  // Simple spacebar push-to-talk mode (no question detection)
  const spacebarRecognition = useSpeechRecognition();

  // Determine which mode is active
  const isListening = voiceInputState.isLiveTutorOn ? liveTutorListening : spacebarRecognition.listening;
  const currentTranscript = voiceInputState.isLiveTutorOn ? liveTutorTranscript : spacebarRecognition.transcript;
  const supported = liveTutorSupported || spacebarRecognition.supported;
  const error = liveTutorError || spacebarRecognition.error;
  const createSession = useSessionStore((state) => state.createSession);
  const addMessage = useSessionStore((state) => state.addMessage);
  const updateMessage = useSessionStore((state) => state.updateMessage);
  const removeMessage = useSessionStore((state) => state.removeMessage);
  const appendTimelineEvent = useSessionStore((state) => state.appendTimelineEvent);
  const setLiveTutorOn = useSessionStore((state) => state.setLiveTutorOn);
  const setSpacebarTranscript = useSessionStore((state) => state.setSpacebarTranscript);
  const setIsPushToTalkActive = useSessionStore((state) => state.setIsPushToTalkActive);
  const setStopStreamingCallback = useSessionStore((state) => state.setStopStreamingCallback);
  const setRerunQuestionCallback = useSessionStore((state) => state.setRerunQuestionCallback);
  const { startSequence, addObjectToSequence, endSequence } = useSequentialConnections();

  // Get messages for active session
  const messages = activeSessionId ? (allMessages[activeSessionId] || []) : [];

  // Track session ID and complete text for adding to chat history when streaming finishes
  const currentSessionRef = useRef<string | null>(null);
  const completeTextRef = useRef<string>('');
  const objectsInCurrentResponse = useRef<string[]>([]);  // Track objects created in current response
  const thinkingMessageIdRef = useRef<string | null>(null);  // Track thinking message to replace it
  const sequenceKeyRef = useRef<string | null>(null);

  // Streaming QA with audio
  const streamingQA = useStreamingQA({
    onInterrupted: useCallback((partialText: string) => {
      const sessionId = currentSessionRef.current;
      const thinkingMessageId = thinkingMessageIdRef.current;

      if (sessionId && thinkingMessageId) {
        // Update message to show it was interrupted
        updateMessage(sessionId, thinkingMessageId, {
          content: partialText || "Stopped",
          interrupted: true,
          interruptedAt: new Date().toISOString(),
          isStreaming: false,
          isPlayingAudio: false
        });
        console.log('⚠️ Message marked as interrupted');

        appendTimelineEvent(sessionId, {
          description: "AI response interrupted by user",
          type: "response"
        });
      }

      // Reset refs
      currentSessionRef.current = null;
      completeTextRef.current = '';
      objectsInCurrentResponse.current = [];
      thinkingMessageIdRef.current = null;
      endSequence();
      sequenceKeyRef.current = null;
    }, [updateMessage, appendTimelineEvent, endSequence]),
    onCanvasObject: useCallback((object: any, placement: any) => {
      const sessionId = currentSessionRef.current ?? activeSessionId;
      if (!sessionId) {
        return;
      }

      const canvasObject = {
        id: object.id,
        type: object.type,
        x: object.position.x,
        y: object.position.y,
        width: object.size.width,
        height: object.size.height,
        zIndex: object.zIndex || 1,
        selected: false,
        color: getColorForType(object.type),
        label: object.metadata?.referenceName || object.type,
        metadata: {
          ...object.metadata,
          animated: true,
          createdAt: Date.now()
        },
        data: object.data
      };

      const applyObject = () => {
        const finalObject = addObjectToSequence(sessionId, canvasObject, object.position, sequenceKeyRef.current);

        appendTimelineEvent(sessionId, {
          description: `Created ${object.type}: ${finalObject.label}`,
          type: "visual"
        });

        objectsInCurrentResponse.current.push(object.id);
        console.log(`✅ Canvas object "${finalObject.label}" now visible`);
      };

      const delay = placement.timing || 0;
      console.log(`🎨 Scheduling canvas object "${canvasObject.label}" to appear in ${delay}ms`);

      if (delay > 0) {
        setTimeout(applyObject, delay);
      } else {
        applyObject();
      }
    }, [activeSessionId, addObjectToSequence, appendTimelineEvent]),
    onComplete: useCallback(() => {
      const sessionId = currentSessionRef.current;
      const finalText = completeTextRef.current;
      const objectIds = objectsInCurrentResponse.current;
      const thinkingMessageId = thinkingMessageIdRef.current;

      if (sessionId && finalText.trim()) {
        if (thinkingMessageId) {
          // Replace the "Thinking..." message with the actual response
          updateMessage(sessionId, thinkingMessageId, {
            content: finalText,
            canvasObjectIds: objectIds.length > 0 ? objectIds : undefined,
            isStreaming: false,
            isPlayingAudio: false
          });
          console.log('✅ Updated thinking message with final response');
        } else {
          // Fallback: add new message if thinking message wasn't created
          addMessage(sessionId, {
            role: "assistant",
            content: finalText,
            canvasObjectIds: objectIds.length > 0 ? objectIds : undefined
          });
          console.log('💬 Assistant message added to chat history from onComplete');
        }

        appendTimelineEvent(sessionId, {
          description: "AI completed streaming response with audio.",
          type: "response"
        });
        console.log(`📎 Linked ${objectIds.length} canvas objects to message`);

        // Update last AI message for response detection
        setLastAIMessage(finalText);
      }

      // Reset refs
      currentSessionRef.current = null;
      completeTextRef.current = '';
      objectsInCurrentResponse.current = [];
      thinkingMessageIdRef.current = null;
      endSequence();
      sequenceKeyRef.current = null;
    }, [addMessage, updateMessage, appendTimelineEvent, endSequence]),
    onError: useCallback(() => {
      endSequence();
      sequenceKeyRef.current = null;
    }, [endSequence])
  });

  const getColorForType = (type: string): string => {
    switch (type) {
      case 'text': return '#3b82f6';
      case 'diagram': return '#10b981';
      case 'code': return '#f59e0b';
      case 'graph': return '#ef4444';
      case 'latex': return '#8b5cf6';
      default: return '#6b7280';
    }
  };

  const handleQuestionDetected = useCallback(async (question: string, context: string[]) => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 QUESTION DETECTED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Question:', question);
    console.log('Context:', context);

    // Check if AI is currently active (streaming or speaking)
    const isAIActive = streamingQA.isStreaming || streamingQA.audioState.isPlaying;

    if (isAIActive) {
      console.log('🛑 User interrupted AI - stopping current response');

      // Stop streaming immediately
      streamingQA.stopStreaming();
      endSequence();
      sequenceKeyRef.current = null;

      // Show interrupt feedback briefly
      setInterrupted(true);
      setTimeout(() => setInterrupted(false), 1500);
    }

    let sessionId = activeSessionId;
    if (!sessionId) {
      console.log('🆕 Creating new session...');
      try {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        const displayMinutes = minutes.toString().padStart(2, '0');
        const timeString = `${displayHours}:${displayMinutes} ${ampm}`;
        const title = `AI Session ${timeString}`;
        sessionId = await createSession({ title });
        console.log('✅ Session created:', sessionId);
      } catch (error) {
        console.error("❌ Failed to create session:", error);
        return;
      }
    }

    // Add user message to chat history immediately
    addMessage(sessionId, { role: "user", content: question });
    appendTimelineEvent(sessionId, { description: "AI detected and processed question.", type: "prompt" });

    console.log('✅ User message added to chat history');

    // Add "thinking..." placeholder message with streaming flag
    const thinkingMessageId = addMessage(sessionId, {
      role: "assistant",
      content: "Thinking...",
      isStreaming: true
    });
    thinkingMessageIdRef.current = thinkingMessageId;
    console.log('🤔 Thinking indicator added to chat with streaming flag');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 STARTING STREAMING RESPONSE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Store session ID for onComplete callback
    currentSessionRef.current = sessionId;
    completeTextRef.current = '';
    objectsInCurrentResponse.current = [];  // Reset for new response

    try {
      sequenceKeyRef.current = startSequence(sessionId);
      // Use streaming QA for real-time response with audio
      await streamingQA.startStreaming(sessionId, question, {
        highlightedObjects: [],
        mode: "guided",
        context: {
          recentConversation: context,
          topics: conversationContext.topics,
          conversationHistory: conversationContext.recentUtterances
        }
      });

      // Note: Assistant message is added in onComplete callback
    } catch (error) {
      console.error("Error processing question:", error);
      endSequence();
      sequenceKeyRef.current = null;

      // Provide user-friendly error messages
      let errorMessage = "I'm experiencing a momentary issue. Please try again.";
      if (error instanceof Error) {
        if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = "Network error. Please check your connection and try again.";
        } else if (error.message.includes('timeout')) {
          errorMessage = "Request timed out. Please try asking again.";
        } else if (error.message.includes('session')) {
          errorMessage = "Session error. Please refresh and try again.";
        }
      }

      addMessage(sessionId, { role: "assistant", content: errorMessage });
      appendTimelineEvent(sessionId, {
        description: `Error: ${errorMessage}`,
        type: "response"
      });
    }
  }, [activeSessionId, createSession, addMessage, appendTimelineEvent, conversationContext, streamingQA, setInterrupted, startSequence, endSequence]);

  useEffect(() => {
    setQuestionCallback(handleQuestionDetected);
  }, [setQuestionCallback, handleQuestionDetected]);

  // Register stop streaming callback
  useEffect(() => {
    setStopStreamingCallback(() => {
      console.log('🛑 Stop callback invoked - completely stopping AI');

      // Get current state before stopping
      const partialText = completeTextRef.current;
      const thinkingMessageId = thinkingMessageIdRef.current;
      const sessionId = currentSessionRef.current;

      // Stop streaming and audio IMMEDIATELY
      streamingQA.stopStreaming();
      endSequence();
      sequenceKeyRef.current = null;

      // Update the message to show it was interrupted (if it had content)
      if (sessionId && thinkingMessageId) {
        if (partialText && partialText.trim()) {
          console.log('⚠️ Marking message as interrupted with partial content');
          updateMessage(sessionId, thinkingMessageId, {
            content: partialText,
            interrupted: true,
            interruptedAt: new Date().toISOString(),
            isStreaming: false,
            isPlayingAudio: false
          });
        } else {
          console.log('🗑️ Removing empty thinking message');
          removeMessage(sessionId, thinkingMessageId);
        }
        thinkingMessageIdRef.current = null;

        appendTimelineEvent(sessionId, {
          description: "AI response stopped by user",
          type: "response"
        });
      }

      // Reset ALL refs to allow new questions immediately
      currentSessionRef.current = null;
      completeTextRef.current = '';
      objectsInCurrentResponse.current = [];

      console.log('✅ Stop complete - ready for new questions');
    });

    // Cleanup on unmount
    return () => {
      setStopStreamingCallback(null);
    };
  }, [streamingQA, setStopStreamingCallback, removeMessage, updateMessage, appendTimelineEvent, endSequence]);

  // Register rerun question callback
  useEffect(() => {
    setRerunQuestionCallback((question: string) => {
      console.log('🔄 Rerun question callback invoked:', question);

      // Use the same logic as handleQuestionDetected
      void handleQuestionDetected(question, []);
    });

    return () => {
      setRerunQuestionCallback(null);
    };
  }, [handleQuestionDetected, setRerunQuestionCallback]);

  // Track streaming text in ref so onComplete can access it
  // AND update the message in real-time as text streams in
  useEffect(() => {
    if (streamingQA.currentText) {
      completeTextRef.current = streamingQA.currentText;

      // Update the thinking message in real-time as text streams in
      const thinkingMessageId = thinkingMessageIdRef.current;
      const sessionId = currentSessionRef.current;

      if (sessionId && thinkingMessageId) {
        const content = streamingQA.currentText.trim() || "Thinking...";
        updateMessage(sessionId, thinkingMessageId, {
          content: content,
          isStreaming: streamingQA.isStreaming,
          isPlayingAudio: streamingQA.audioState.isPlaying
        });
      }
    }
  }, [streamingQA.currentText, streamingQA.isStreaming, streamingQA.audioState.isPlaying, updateMessage]);

  // Keep microphone ALWAYS ACTIVE when live tutor is on - allow natural interruption
  // No pausing when AI speaks - user can interrupt anytime like a real conversation
  useEffect(() => {
    // Live tutor should ALWAYS be listening when enabled
    if (voiceInputState.isLiveTutorOn && !liveTutorListening && isActive) {
      console.log('🎤 Ensuring live tutor is listening');
      startLiveTutor();
    }
  }, [voiceInputState.isLiveTutorOn, liveTutorListening, isActive, startLiveTutor]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, streamingQA.currentText]);

  const toggleAI = useCallback(() => {
    const newState = !voiceInputState.isLiveTutorOn;
    setLiveTutorOn(newState);

    if (newState) {
      // Turning Live Tutor ON - start continuous question detection
      console.log('🔒 Live Tutor ON - Continuous question detection enabled');
      startLiveTutor();
      setIsActive(true);
    } else {
      // Turning Live Tutor OFF - stop listening
      console.log('🔓 Live Tutor OFF - Push-to-talk mode enabled');
      stopLiveTutor();
      spacebarRecognition.stop();
      setIsActive(false);
    }
  }, [voiceInputState.isLiveTutorOn, setLiveTutorOn, stopLiveTutor, startLiveTutor, spacebarRecognition]);

  // Sync spacebar transcript to store when spacebar is held (ALWAYS use spacebar recognition)
  useEffect(() => {
    if (voiceInputState.isPushToTalkActive) {
      // Always use spacebar recognition transcript when push-to-talk is active
      setSpacebarTranscript(spacebarRecognition.transcript);
    }
  }, [spacebarRecognition.transcript, voiceInputState.isPushToTalkActive, setSpacebarTranscript]);

  // Push-to-talk: Hold spacebar to speak, release to submit (ONLY when Live Tutor is OFF)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only trigger if spacebar is pressed and not in an input/textarea/contenteditable
      if (event.code === 'Space' && event.target instanceof HTMLElement) {
        const isInInputField =
          event.target.tagName === 'INPUT' ||
          event.target.tagName === 'TEXTAREA' ||
          event.target.isContentEditable;

        if (!isInInputField && !event.repeat) {
          // Only allow spacebar push-to-talk when Live Tutor is OFF
          if (voiceInputState.isLiveTutorOn) {
            console.log('⚠️ Spacebar ignored - Live Tutor is ON');
            return;
          }

          event.preventDefault(); // Prevent page scroll

          // Check if AI is currently speaking - allow interrupt
          const isAISpeaking = streamingQA.isStreaming || streamingQA.audioState.isPlaying;

          if (isAISpeaking) {
            // User is interrupting AI
            console.log('🛑 User interrupting AI via spacebar hold');
            streamingQA.stopStreaming();
            endSequence();
            sequenceKeyRef.current = null;
            setInterrupted(true);
            setTimeout(() => setInterrupted(false), 1500);
          }

          // Start push-to-talk for prompt input (simple mode, no question detection)
          console.log('🎤 Push-to-talk activated (spacebar mode only)');
          setIsPushToTalkActive(true);
          setSpacebarTranscript(''); // Clear previous
          spacebarRecognition.start();
          // DON'T set isActive - that's only for Live Tutor mode
        }
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space' && event.target instanceof HTMLElement) {
        const isInInputField =
          event.target.tagName === 'INPUT' ||
          event.target.tagName === 'TEXTAREA' ||
          event.target.isContentEditable;

        if (!isInInputField && voiceInputState.isPushToTalkActive) {
          event.preventDefault();

          console.log('🔇 Push-to-talk released - transcript will auto-submit');

          // Get the EXACT transcript - NO TRIMMING, NO CLEANING
          const finalTranscript = spacebarRecognition.transcript;

          setIsPushToTalkActive(false);
          spacebarRecognition.stop();
          // Don't touch isActive - that's only for Live Tutor mode

          // Submit EVERYTHING that was heard, even if empty
          console.log('📤 Submitting EXACT spacebar transcript:', finalTranscript);
          setSpacebarTranscript(finalTranscript || '');  // Send even if empty
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [voiceInputState.isPushToTalkActive, voiceInputState.isLiveTutorOn, spacebarRecognition, streamingQA, setIsPushToTalkActive, setSpacebarTranscript, setInterrupted, endSequence]);

  const isQuestionDetected = currentTranscript &&
    currentTranscript.toLowerCase().match(/(what|how|why|explain|tell me|show me|mentora|ai|tutor|generate)/);

  // Determine current status
  const speaking = streamingQA.audioState.isPlaying;
  const currentSpeechText = streamingQA.audioState.currentText || "";
  const isGenerating = streamingQA.isStreaming && !speaking;

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-30 flex items-end gap-4 flex-row">
      {/* Live Transcript Panel - Fixed position to left of controls */}
      {isActive && (
        <div className="pointer-events-auto animate-in fade-in duration-300">
          <div className="relative overflow-hidden rounded-3xl glass-white shadow-[0_8px_32px_rgba(0,0,0,0.12)] max-w-md border border-white/40">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-400/10 via-transparent to-blue-400/10" />
            <div className="pointer-events-none absolute inset-0 shimmer" />

            <div className="relative p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/30">
                <div className="flex items-center gap-2.5">
                  <div className={cn(
                    "h-2.5 w-2.5 rounded-full shadow-lg transition-all duration-300",
                    isListening ? "bg-gradient-to-r from-cyan-400 to-blue-500 animate-pulse shadow-cyan-400/50" : "bg-slate-400"
                  )} />
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    {speaking ? "Speaking" : isListening ? "Listening" : "Standby"}
                  </span>
                </div>
              </div>

              {currentTranscript ? (
                <div className="space-y-3">
                  <div className={cn(
                    "rounded-2xl p-4 transition-all duration-500 backdrop-blur-sm",
                    isQuestionDetected
                      ? "bg-gradient-to-br from-cyan-400/15 to-blue-500/15 border border-cyan-400/40 shadow-lg shadow-cyan-400/20"
                      : "bg-white/60 border border-slate-200/60 shadow-sm"
                  )}>
                    <p className="text-sm text-slate-900 leading-relaxed font-medium">
                      {currentTranscript}
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5">
                    {isQuestionDetected ? (
                      <>
                        <Brain className="h-3.5 w-3.5 text-cyan-500 animate-pulse drop-shadow-sm" />
                        <span className="text-xs font-bold text-cyan-600 tracking-wide">
                          Question detected • Processing...
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="h-3.5 w-3.5 flex items-center justify-center">
                          <div className="h-1.5 w-1.5 rounded-full bg-slate-400 shadow-sm" />
                        </div>
                        <span className="text-xs text-slate-500 font-medium">
                          Listening for questions
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4 py-3">
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className={cn(
                          "w-1.5 rounded-full transition-all duration-300 shadow-sm",
                          isListening
                            ? "bg-gradient-to-t from-cyan-400 to-blue-500 animate-pulse"
                            : "bg-slate-300 opacity-40"
                        )}
                        style={{
                          height: isListening ? `${Math.random() * 16 + 10}px` : '8px',
                          animationDelay: `${i * 150}ms`
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-slate-600 font-medium">
                    Start speaking to ask a question...
                  </span>
                </div>
              )}

              {conversationContext.topics.length > 0 && (
                <div className="pt-3 border-t border-white/30">
                  <div className="flex items-center gap-2 mb-2.5">
                    <Brain className="h-3.5 w-3.5 text-purple-600 drop-shadow-sm" />
                    <span className="text-xs font-bold text-slate-700">Active Topics</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {conversationContext.topics.slice(-3).map((topic, index) => (
                      <span
                        key={index}
                        className="text-xs px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-500/15 to-pink-500/15 text-purple-700 border border-purple-400/30 font-medium shadow-sm backdrop-blur-sm transition-all duration-300 hover:scale-105"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {/* Microphone Control */}
      <div className="pointer-events-auto flex flex-col items-center gap-3">
        <div className={cn(
          "flex items-center gap-2 rounded-full px-4 py-1.5 backdrop-blur-xl border transition-all duration-300 shadow-lg",
          voiceInputState.isLiveTutorOn
            ? "bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-400/40 shadow-green-400/20"
            : voiceInputState.isPushToTalkActive
            ? "bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-400/40 shadow-yellow-400/20"
            : "glass-white border-white/40"
        )}>
          <span className={cn(
            "text-[10px] font-black tracking-widest transition-colors uppercase",
            voiceInputState.isLiveTutorOn
              ? "text-green-600"
              : voiceInputState.isPushToTalkActive
              ? "text-yellow-600"
              : "text-slate-500"
          )}>
            {voiceInputState.isLiveTutorOn
              ? "LIVE TUTOR ON"
              : voiceInputState.isPushToTalkActive
              ? "RECORDING..."
              : "LIVE TUTOR OFF"}
          </span>
        </div>

        <button
          onClick={toggleAI}
          disabled={!supported}
          className={cn(
            "group relative flex h-16 w-16 items-center justify-center rounded-2xl transition-all duration-300",
            "hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
            isActive
              ? "bg-gradient-to-br from-cyan-400 via-cyan-500 to-blue-600 shadow-[0_8px_32px_rgba(6,182,212,0.4)]"
              : "glass-white shadow-[0_8px_24px_rgba(0,0,0,0.12)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.16)] border border-white/50"
          )}
        >
          <svg
            viewBox="0 0 24 24"
            className={cn(
              "h-7 w-7 transition-all duration-300",
              isActive ? "text-white" : "text-slate-600 group-hover:text-slate-900"
            )}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {isActive ? (
              <>
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" x2="12" y1="19" y2="22" />
              </>
            ) : (
              <>
                <line x1="2" x2="22" y1="2" y2="22" />
                <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
                <path d="M5 10v2a7 7 0 0 0 12 5" />
                <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
                <line x1="12" x2="12" y1="19" y2="22" />
              </>
            )}
          </svg>

          {isActive && isListening && (
            <>
              <div className="absolute inset-0 rounded-2xl bg-cyan-400 opacity-40 animate-ping" />
              <div className="absolute -inset-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 opacity-30 blur-xl animate-pulse" />
            </>
          )}

          {/* Question detected animation - special pulsing effect */}
          {isQuestionDetected && (
            <>
              <div className="absolute inset-0 rounded-2xl bg-purple-500 opacity-60 animate-ping" />
              <div className="absolute -inset-3 rounded-2xl bg-gradient-to-r from-purple-400 via-pink-400 to-purple-500 opacity-30 blur-2xl animate-pulse" />
            </>
          )}

          <div
            className={cn(
              "absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full border-[3px] border-white shadow-lg transition-all duration-300",
              error
                ? "bg-red-500 shadow-red-500/50"
                : isActive && isListening
                ? "bg-green-400 animate-pulse shadow-green-400/50"
                : isActive
                ? "bg-cyan-400 shadow-cyan-400/50"
                : "bg-slate-400"
            )}
          />
        </button>

        {isActive && (
          <div className="text-center">
            <p className={cn(
              "text-xs font-bold transition-colors duration-300 tracking-wide drop-shadow-sm",
              isListening
                ? voiceInputState.isLiveTutorOn ? "text-green-600" : "text-yellow-600"
                : speaking
                ? "text-green-600"
                : "text-slate-500"
            )}>
              {speaking ? "AI Speaking" : isListening ? (voiceInputState.isLiveTutorOn ? "Listening (Live)" : "Recording") : "Active"}
            </p>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
