'use client';

import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/cn";
import { useContinuousAI } from "@/hooks/use-continuous-ai";
import { useSessionStore } from "@/lib/session-store";
import { useStreamingQA } from "@/hooks/use-streaming-qa";
import { Brain } from "lucide-react";

export function ContinuousAI() {
  const [isActive, setIsActive] = useState(false);

  const {
    isListening,
    currentTranscript,
    conversationContext,
    supported,
    error,
    startListening,
    stopListening,
    setQuestionCallback
  } = useContinuousAI();

  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const createSession = useSessionStore((state) => state.createSession);
  const addMessage = useSessionStore((state) => state.addMessage);
  const appendTimelineEvent = useSessionStore((state) => state.appendTimelineEvent);
  const updateCanvasObject = useSessionStore((state) => state.updateCanvasObject);

  // Streaming QA with audio
  const streamingQA = useStreamingQA({
    onCanvasObject: useCallback((object, placement) => {
      if (activeSessionId) {
        updateCanvasObject(activeSessionId, {
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
          metadata: object.metadata,
          data: object.data
        });
      }
    }, [activeSessionId, updateCanvasObject]),
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
    let sessionId = activeSessionId;
    if (!sessionId) {
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
      } catch (error) {
        console.error("Failed to create session:", error);
        return;
      }
    }

    addMessage(sessionId, { role: "user", content: question });
    appendTimelineEvent(sessionId, { description: "AI detected and processed question.", type: "prompt" });

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

      // Add assistant message with the complete text
      if (streamingQA.currentText.trim()) {
        addMessage(sessionId, { role: "assistant", content: streamingQA.currentText });
      }
    } catch (error) {
      console.error("Error processing question:", error);
      addMessage(sessionId, { role: "assistant", content: "I'm experiencing a momentary issue. Please try again in a bit." });
    }
  }, [activeSessionId, createSession, addMessage, appendTimelineEvent, conversationContext, streamingQA]);

  useEffect(() => {
    setQuestionCallback(handleQuestionDetected);
  }, [setQuestionCallback, activeSessionId, createSession, addMessage, appendTimelineEvent, updateCanvasObject, conversationContext]);

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
    <div className="pointer-events-none fixed bottom-6 left-6 z-30 flex items-end gap-4 flex-row">
      {/* Live Transcript Panel */}
      {isActive && (
        <div className="pointer-events-auto animate-in slide-in-from-left-5 fade-in duration-300 mb-2">
          <div className="relative overflow-hidden rounded-2xl border border-cyan-400/30 bg-slate-900/95 backdrop-blur-xl shadow-2xl max-w-md">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/5 to-transparent animate-shimmer" />

            <div className="relative p-4 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-700/50">
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
                      : "bg-slate-800/50 border border-slate-700/30"
                  )}>
                    <p className="text-sm text-slate-100 leading-relaxed">
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
                <div className="pt-2 border-t border-slate-700/50">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Brain className="h-3 w-3 text-purple-400" />
                    <span className="text-xs font-semibold text-slate-400">Active Topics</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {conversationContext.topics.slice(-3).map((topic, index) => (
                      <span
                        key={index}
                        className="text-xs px-2 py-1 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20"
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
