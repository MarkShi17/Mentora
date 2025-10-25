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
  const createSession = useSessionStore((state) => state.createSession);
  const addMessage = useSessionStore((state) => state.addMessage);
  const appendTimelineEvent = useSessionStore((state) => state.appendTimelineEvent);
  const updateCanvasObject = useSessionStore((state) => state.updateCanvasObject);

  // Get messages for active session
  const activeSession = sessions.find(s => s.id === activeSessionId);
  const messages = activeSession?.messages || [];

  // Streaming QA with audio
  const streamingQA = useStreamingQA({
    onCanvasObject: useCallback((object, placement) => {
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
            type: "canvas_update"
          });

          console.log(`✅ Canvas object "${canvasObject.label}" now visible`);
        }, delay);
      }
    }, [activeSessionId, updateCanvasObject, appendTimelineEvent]),
    onComplete: useCallback(() => {
      if (activeSessionId) {
        appendTimelineEvent(activeSessionId, {
          description: "AI provided contextual response.",
          type: "response"
        });
      }
    }, [activeSessionId, appendTimelineEvent])
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

      // Add assistant message with the complete text after streaming completes
      if (streamingQA.currentText.trim()) {
        addMessage(sessionId, { role: "assistant", content: streamingQA.currentText });
        appendTimelineEvent(sessionId, {
          description: "AI completed streaming response with audio.",
          type: "response"
        });
        console.log('💬 Assistant message added to chat history');
      } else {
        console.warn('⚠️ No streaming text to add to chat history');
      }
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
        type: "error"
      });
    }
  }, [activeSessionId, createSession, addMessage, appendTimelineEvent, conversationContext, streamingQA]);

  useEffect(() => {
    setQuestionCallback(handleQuestionDetected);
  }, [setQuestionCallback, activeSessionId, createSession, addMessage, appendTimelineEvent, updateCanvasObject, conversationContext]);

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

  const toggleAI = () => {
    if (isActive) {
      stopListening();
      setIsActive(false);
    } else {
      startListening();
      setIsActive(true);
    }
  };

  const isQuestionDetected = currentTranscript &&
    currentTranscript.toLowerCase().match(/(what|how|why|explain|tell me|show me|mentora|ai|tutor)/);

  // Determine current status
  const speaking = streamingQA.audioState.isPlaying;
  const currentSpeechText = streamingQA.audioState.currentText || "";
  const isGenerating = streamingQA.isStreaming && !speaking;

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-30 flex flex-col items-end gap-4">
      {/* Live Transcript - Shows what user is currently saying */}
      {isActive && isListening && currentTranscript && (
        <div className="pointer-events-auto w-96 rounded-xl border border-cyan-400/30 bg-slate-900/90 backdrop-blur-xl shadow-xl p-4 animate-in slide-in-from-right-3 fade-in duration-200">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wide">You're speaking</span>
          </div>
          <p className="text-sm text-slate-200 leading-relaxed">{currentTranscript}</p>
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
              : "bg-slate-800 hover:bg-slate-700"
          )}
        >
          <svg
            viewBox="0 0 24 24"
            className={cn(
              "h-7 w-7 transition-all duration-300",
              isActive ? "text-white" : "text-slate-400 group-hover:text-slate-300"
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
