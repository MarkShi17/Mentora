'use client';

import { useEffect, useState } from "react";
import { Mic, MicOff, Brain, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useContinuousAI } from "@/hooks/use-continuous-ai";
import { useSessionStore } from "@/lib/session-store";
import { useOpenAITTS } from "@/hooks/use-openai-tts";
import { cn } from "@/lib/cn";

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

  const { speak, speaking, loading: ttsLoading } = useOpenAITTS();

  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const createSession = useSessionStore((state) => state.createSession);
  const addMessage = useSessionStore((state) => state.addMessage);
  const appendTimelineEvent = useSessionStore((state) => state.appendTimelineEvent);
  const updateCanvasObject = useSessionStore((state) => state.updateCanvasObject);

  // Helper function to get color for object type
  const getColorForType = (type: string): string => {
    switch (type) {
      case 'text': return '#3b82f6'; // blue
      case 'diagram': return '#10b981'; // emerald
      case 'code': return '#f59e0b'; // amber
      case 'graph': return '#ef4444'; // red
      case 'latex': return '#8b5cf6'; // violet
      default: return '#6b7280'; // gray
    }
  };

  const handleQuestionDetected = async (question: string, context: string[]) => {
    console.log('AI detected question:', question);
    console.log('Context:', context);
    
    // Auto-create session if none exists
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

    // Add user message
    addMessage(sessionId, {
      role: "user",
      content: question
    });

    appendTimelineEvent(sessionId, {
      description: "AI detected and processed question.",
      type: "prompt"
    });

    try {
      // Prepare contextual payload
      const contextualPayload = {
        sessionId,
        question,
        mode: "guided" as const,
        highlightedObjectIds: [] as string[],
        context: {
          recentConversation: context,
          topics: conversationContext.topics,
          conversationHistory: conversationContext.recentUtterances
        }
      };

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/qa`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(contextualPayload)
      });

      if (!response.ok) {
        throw new Error("Failed to contact tutor.");
      }

      const data = await response.json();
      console.log('Backend response data:', data);
      console.log('Answer text:', data.answer?.text);
      console.log('Answer narration:', data.answer?.narration);
      console.log('Answer audioUrl:', data.answer?.audioUrl);
      
      // Add assistant response
      addMessage(sessionId, {
        role: "assistant",
        content: data.answer.text
      });

      // Automatically play TTS audio for the assistant's response
      if (data.answer.text && data.answer.text.trim()) {
        console.log('Playing TTS for assistant response:', data.answer.text);
        speak(data.answer.text, 'nova');
      } else {
        console.log('No assistant text available for TTS');
      }


      // Add canvas objects if any
      if (data.canvasObjects) {
        data.canvasObjects.forEach((obj: any) => {
          const transformedObj = {
            id: obj.id,
            type: obj.type,
            x: obj.position.x,
            y: obj.position.y,
            width: obj.size.width,
            height: obj.size.height,
            zIndex: obj.zIndex || 1,
            selected: false,
            color: getColorForType(obj.type),
            label: obj.metadata?.referenceName || obj.type,
            metadata: obj.metadata,
            data: obj.data
          };
          updateCanvasObject(sessionId, transformedObj);
        });
      }

      appendTimelineEvent(sessionId, {
        description: "AI provided contextual response.",
        type: "response"
      });

    } catch (error) {
      console.error("Error processing question:", error);
      addMessage(sessionId, {
        role: "assistant",
        content: "I'm experiencing a momentary issue. Please try again in a bit."
      });
    }
  };

  // Set up the question detection callback
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

  const getStatusText = () => {
    if (!supported) return "AI unavailable";
    if (error) return "AI error";
    if (isActive && isListening) return "AI listening...";
    if (isActive) return "AI active";
    return "AI idle";
  };

  const getStatusColor = () => {
    if (!supported || error) return "text-red-400";
    if (isActive && isListening) return "text-green-400";
    if (isActive) return "text-blue-400";
    return "text-slate-400";
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-slate-950/95 backdrop-blur border border-slate-700/50 rounded-lg p-4 shadow-xl min-w-[300px]">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-sky-400" />
            <h3 className="text-sm font-semibold text-slate-200">Continuous AI</h3>
          </div>
          <Button
            variant={isActive ? "secondary" : "outline"}
            size="sm"
            onClick={toggleAI}
            disabled={!supported}
            className={cn(
              "h-8 w-8 p-0",
              isActive && isListening && "animate-pulse"
            )}
          >
            {isActive ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          </Button>
        </div>

        {/* Status */}
        <div className="mb-3">
          <p className={cn("text-xs font-medium", getStatusColor())}>
            {getStatusText()}
          </p>
          {ttsLoading && (
            <p className="text-[10px] text-blue-400 mt-1">Generating speech...</p>
          )}
          {speaking && (
            <p className="text-[10px] text-green-400 mt-1">Speaking...</p>
          )}
          {error && (
            <p className="text-[10px] text-red-400 mt-1">{error}</p>
          )}
        </div>

        {/* Current Transcript */}
        {currentTranscript && (
          <div className="mb-3 p-2 bg-slate-800/50 rounded border border-slate-700/30">
            <p className="text-xs text-slate-400 mb-1">Listening:</p>
            <p className="text-sm text-slate-200">{currentTranscript}</p>
            <p className="text-xs text-slate-500 mt-1">
              {currentTranscript.toLowerCase().includes('play music') || 
               currentTranscript.toLowerCase().includes('order pizza') || 
               currentTranscript.toLowerCase().includes('tell joke') || 
               currentTranscript.toLowerCase().includes('sing') ||
               currentTranscript.toLowerCase().includes('dance') ||
               currentTranscript.toLowerCase().includes('gaming') ||
               currentTranscript.toLowerCase().includes('entertainment') ||
               currentTranscript.toLowerCase().includes('social media') ? 
               "Inappropriate request - ignoring" : 
               currentTranscript.toLowerCase().includes('what') || 
               currentTranscript.toLowerCase().includes('how') || 
               currentTranscript.toLowerCase().includes('why') || 
               currentTranscript.toLowerCase().includes('explain') || 
               currentTranscript.toLowerCase().includes('tell me') ||
               currentTranscript.toLowerCase().includes('show me') ||
               currentTranscript.toLowerCase().includes('mentora') ||
               currentTranscript.toLowerCase().includes('ai') ||
               currentTranscript.toLowerCase().includes('tutor') ? 
               "Informational request detected" : 
               "Continuing to listen..."}
            </p>
          </div>
        )}



        {/* Context Info */}
        {isActive && conversationContext.topics.length > 0 && (
          <div className="p-2 bg-slate-800/30 rounded border border-slate-700/20">
            <p className="text-xs text-slate-400 mb-1">Context Topics:</p>
            <div className="flex flex-wrap gap-1">
              {conversationContext.topics.slice(-3).map((topic, index) => (
                <span
                  key={index}
                  className="text-xs px-2 py-1 bg-slate-700/50 rounded text-slate-300"
                >
                  {topic}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
