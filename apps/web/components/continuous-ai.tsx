'use client';

import { useEffect, useState, useCallback, useRef } from "react";
import { cn } from "@/lib/cn";
import { useContinuousAI } from "@/hooks/use-continuous-ai";
import { useSessionStore } from "@/lib/session-store";
import { useStreamingQA } from "@/hooks/use-streaming-qa";
import { Brain, StopCircle } from "lucide-react";

export function ContinuousAI() {
  const [isActive, setIsActive] = useState(false);
  const [wasListeningBeforeSpeech, setWasListeningBeforeSpeech] = useState(false);
  const [interrupted, setInterrupted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    isListening,
    currentTranscript,
    conversationContext,
    supported,
    error,
    startListening,
    stopListening,
    pauseListening,
    resumeListening,
    setQuestionCallback
  } = useContinuousAI();

  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const sessions = useSessionStore((state) => state.sessions);
  const allMessages = useSessionStore((state) => state.messages);
  const createSession = useSessionStore((state) => state.createSession);
  const addMessage = useSessionStore((state) => state.addMessage);
  const appendTimelineEvent = useSessionStore((state) => state.appendTimelineEvent);
  const updateCanvasObject = useSessionStore((state) => state.updateCanvasObject);

  // Get messages for active session
  const messages = activeSessionId ? (allMessages[activeSessionId] || []) : [];

  // Track session ID and complete text for adding to chat history when streaming finishes
  const currentSessionRef = useRef<string | null>(null);
  const completeTextRef = useRef<string>('');

  // Streaming QA with audio
  const streamingQA = useStreamingQA({
    onCanvasObject: useCallback((object: any, placement: any) => {
      if (activeSessionId) {
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
            // Add animation flag for newly created objects
            animated: true,
            createdAt: Date.now()
          },
          data: object.data
        };

        // Respect placement timing - delay object appearance based on timing value
        const delay = placement.timing || 0;
        console.log(`🎨 Scheduling canvas object "${canvasObject.label}" to appear in ${delay}ms`);

        setTimeout(() => {
          updateCanvasObject(activeSessionId, canvasObject);

          // Add timeline event for new object
          appendTimelineEvent(activeSessionId, {
            description: `Created ${object.type}: ${object.metadata?.referenceName || object.id}`,
            type: "visual"
          });

          console.log(`✅ Canvas object "${canvasObject.label}" now visible`);
        }, delay);
      }
    }, [activeSessionId, updateCanvasObject, appendTimelineEvent]),
    onComplete: useCallback(() => {
      const sessionId = currentSessionRef.current;
      const finalText = completeTextRef.current;

      if (sessionId && finalText.trim()) {
        // Add assistant message to chat history
        addMessage(sessionId, { role: "assistant", content: finalText });
        appendTimelineEvent(sessionId, {
          description: "AI completed streaming response with audio.",
          type: "response"
        });
        console.log('💬 Assistant message added to chat history from onComplete');
      }

      // Reset refs
      currentSessionRef.current = null;
      completeTextRef.current = '';
    }, [addMessage, appendTimelineEvent])
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
    console.log('🎯 Question detected:', question);
    console.log('📚 Context:', context);

    // Check if AI is currently active (streaming or speaking)
    const isAIActive = streamingQA.isStreaming || streamingQA.audioState.isPlaying;

    if (isAIActive) {
      console.log('🛑 User interrupted AI - stopping current response');

      // Stop streaming immediately
      streamingQA.stopStreaming();

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

    console.log('💬 User message added to chat history');
    console.log('🚀 Starting streaming response...');

    // Store session ID for onComplete callback
    currentSessionRef.current = sessionId;
    completeTextRef.current = '';

    try {
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
  }, [activeSessionId, createSession, addMessage, appendTimelineEvent, conversationContext, streamingQA]);

  useEffect(() => {
    setQuestionCallback(handleQuestionDetected);
  }, [setQuestionCallback, activeSessionId, createSession, addMessage, appendTimelineEvent, updateCanvasObject, conversationContext]);

  // Track streaming text in ref so onComplete can access it
  useEffect(() => {
    if (streamingQA.currentText) {
      completeTextRef.current = streamingQA.currentText;
    }
  }, [streamingQA.currentText]);

  // Pause microphone when AI is speaking to prevent feedback loop
  useEffect(() => {
    const isAISpeaking = streamingQA.audioState.isPlaying;

    if (isAISpeaking && isListening && isActive) {
      // AI started speaking - pause the microphone
      console.log('🔇 Pausing microphone (AI speaking)');
      pauseListening();
      setWasListeningBeforeSpeech(true);
    } else if (!isAISpeaking && wasListeningBeforeSpeech && isActive) {
      // AI stopped speaking - resume the microphone
      console.log('🎤 Resuming microphone (AI finished)');
      resumeListening();
      setWasListeningBeforeSpeech(false);
    }
  }, [streamingQA.audioState.isPlaying, isListening, isActive, wasListeningBeforeSpeech, pauseListening, resumeListening]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, streamingQA.currentText]);

  const toggleAI = useCallback(() => {
    if (isActive) {
      stopListening();
      setIsActive(false);
    } else {
      startListening();
      setIsActive(true);
    }
  }, [isActive, stopListening, startListening]);

  // Add spacebar keyboard shortcut for toggling Live Tutor
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only trigger if spacebar is pressed and not in an input/textarea/contenteditable
      if (event.code === 'Space' && event.target instanceof HTMLElement) {
        const isInInputField =
          event.target.tagName === 'INPUT' ||
          event.target.tagName === 'TEXTAREA' ||
          event.target.isContentEditable;

        if (!isInInputField) {
          event.preventDefault(); // Prevent page scroll
          toggleAI();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggleAI]);

  const isQuestionDetected = currentTranscript &&
    currentTranscript.toLowerCase().match(/(what|how|why|explain|tell me|show me|mentora|ai|tutor)/);

  // Determine current status
  const speaking = streamingQA.audioState.isPlaying;
  const currentSpeechText = streamingQA.audioState.currentText || "";
  const isGenerating = streamingQA.isStreaming && !speaking;

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-30 flex items-end gap-4 flex-row">
      {/* Live Transcript Panel */}
      {isActive && (
        <div className="pointer-events-auto animate-in slide-in-from-right-5 fade-in duration-300 mb-2">
          <div className="relative overflow-hidden rounded-2xl border border-cyan-400/30 bg-white/95 backdrop-blur-xl shadow-2xl max-w-md">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/5 to-transparent animate-shimmer" />

            <div className="relative p-4 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                <div className={cn(
                  "h-2 w-2 rounded-full",
                  isListening ? "bg-cyan-400 animate-pulse" : "bg-slate-600"
                )} />
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  {speaking ? "Speaking" : isListening ? "Listening" : "Standby"}
                </span>
              </div>

              {currentTranscript ? (
                <div className="space-y-2">
                  <div className={cn(
                    "rounded-xl p-3 transition-all duration-300",
                    isQuestionDetected
                      ? "bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-400/30"
                      : "bg-slate-50 border border-slate-200"
                  )}>
                    <p className="text-sm text-slate-900 leading-relaxed">
                      {currentTranscript}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {isQuestionDetected ? (
                      <>
                        <Brain className="h-3 w-3 text-cyan-400 animate-pulse" />
                        <span className="text-xs font-semibold text-cyan-400">
                          Question detected • Processing...
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="h-3 w-3 flex items-center justify-center">
                          <div className="h-1 w-1 rounded-full bg-slate-500" />
                        </div>
                        <span className="text-xs text-slate-500">
                          Listening for questions
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 py-2">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className={cn(
                          "w-1 rounded-full bg-cyan-400 transition-all duration-300",
                          isListening ? "animate-pulse" : "opacity-30"
                        )}
                        style={{
                          height: isListening ? `${Math.random() * 12 + 8}px` : '6px',
                          animationDelay: `${i * 150}ms`
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-slate-500">
                    Start speaking to ask a question...
                  </span>
                </div>
              )}

              {conversationContext.topics.length > 0 && (
                <div className="pt-2 border-t border-slate-200">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Brain className="h-3 w-3 text-purple-600" />
                    <span className="text-xs font-semibold text-slate-600">Active Topics</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {conversationContext.topics.slice(-3).map((topic, index) => (
                      <span
                        key={index}
                        className="text-xs px-2 py-1 rounded-full bg-purple-500/10 text-purple-700 border border-purple-500/20"
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

      {/* AI Response Display (Streaming) */}
      {(streamingQA.isStreaming || streamingQA.currentText) && (
        <div className="pointer-events-auto animate-in slide-in-from-left-5 fade-in duration-300 mb-2">
          <div className="relative overflow-hidden rounded-2xl border border-blue-400/30 bg-white/95 backdrop-blur-xl shadow-2xl max-w-md">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-blue-400/5 to-transparent animate-shimmer" />

            <div className="relative p-4 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                <div className={cn(
                  "h-2 w-2 rounded-full",
                  speaking ? "bg-green-400 animate-pulse" : isGenerating ? "bg-blue-400 animate-pulse" : "bg-slate-600"
                )} />
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  {speaking ? "Speaking" : isGenerating ? "Generating" : "Complete"}
                </span>
              </div>

              {/* Live Transcript */}
              {streamingQA.currentText && (
                <div className="rounded-xl p-3 bg-slate-50 border border-slate-200 max-h-48 overflow-y-auto">
                  <p className="text-sm text-slate-900 leading-relaxed">
                    {streamingQA.currentText}
                  </p>
                </div>
              )}

              {/* Current Speaking Text */}
              {speaking && currentSpeechText && (
                <div className="flex items-start gap-2 pt-2 border-t border-slate-200">
                  <div className="flex gap-1 mt-1">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-1 rounded-full bg-green-400 animate-pulse"
                        style={{
                          height: `${Math.random() * 10 + 6}px`,
                          animationDelay: `${i * 150}ms`
                        }}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-green-300 leading-relaxed">
                    {currentSpeechText}
                  </p>
                </div>
              )}

              {/* Audio Queue Progress */}
              {streamingQA.audioState.queueLength > 0 && (
                <div className="pt-2 border-t border-slate-200">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-400 to-green-400 rounded-full transition-all duration-300"
                        style={{
                          width: `${streamingQA.audioState.currentSentenceIndex !== null ? ((streamingQA.audioState.currentSentenceIndex + 1) / streamingQA.audioState.queueLength) * 100 : 0}%`
                        }}
                      />
                    </div>
                    <span className="text-xs text-slate-500">
                      {streamingQA.audioState.currentSentenceIndex !== null ? streamingQA.audioState.currentSentenceIndex + 1 : 0}/{streamingQA.audioState.queueLength}
                    </span>
                  </div>
                </div>
              )}

              {/* Error Display */}
              {streamingQA.error && (
                <div className="rounded-lg p-3 bg-red-500/10 border border-red-500/30">
                  <p className="text-xs text-red-300">
                    {streamingQA.error}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Microphone Control */}
      <div className="pointer-events-auto flex flex-col items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-cyan-500/10 to-blue-500/10 px-3 py-1 backdrop-blur-sm border border-cyan-400/20">
          <span className="text-xs font-semibold text-cyan-400 tracking-wide">
            LIVE TUTOR
          </span>
        </div>

        <button
          onClick={toggleAI}
          disabled={!supported}
          className={cn(
            "group relative flex h-14 w-14 items-center justify-center rounded-xl transition-all duration-300",
            "hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg",
            isActive
              ? "bg-gradient-to-br from-cyan-400 to-blue-500"
              : "bg-white hover:bg-slate-50 border border-slate-200"
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
              <div className="absolute inset-0 rounded-xl bg-cyan-400 opacity-50 animate-ping" />
              <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 opacity-20 blur animate-pulse" />
            </>
          )}

          <div
            className={cn(
              "absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-slate-950 transition-all",
              error
                ? "bg-red-500"
                : isActive && isListening
                ? "bg-green-400 animate-pulse"
                : isActive
                ? "bg-cyan-400"
                : "bg-slate-600"
            )}
          />
        </button>

        {isActive && (
          <div className="text-center">
            <p className={cn(
              "text-xs font-medium transition-colors duration-300",
              isListening
                ? "text-cyan-400"
                : speaking
                ? "text-green-400"
                : "text-slate-400"
            )}>
              {speaking ? "Speaking" : isListening ? "Listening" : "Active"}
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
