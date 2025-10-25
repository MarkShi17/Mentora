'use client';

import { useCallback, useState, useEffect } from "react";
import { VoiceToggle } from "@/components/voice-toggle";
import { useSessionStore } from "@/lib/session-store";
import { useStreamingQA } from "@/hooks/use-streaming-qa";

// Helper function to get color for object type
function getColorForType(type: string): string {
  switch (type) {
    case 'text': return '#3b82f6'; // blue
    case 'diagram': return '#10b981'; // emerald
    case 'code': return '#f59e0b'; // amber
    case 'graph': return '#ef4444'; // red
    case 'latex': return '#8b5cf6'; // violet
    default: return '#6b7280'; // gray
  }
}

export function PromptBar() {
  const [value, setValue] = useState("");
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const sessions = useSessionStore((state) => state.sessions);
  const createSession = useSessionStore((state) => state.createSession);
  const addMessage = useSessionStore((state) => state.addMessage);
  const appendTimelineEvent = useSessionStore((state) => state.appendTimelineEvent);
  const updateCanvasObject = useSessionStore((state) => state.updateCanvasObject);
  const voiceInputState = useSessionStore((state) => state.voiceInputState);
  const setSpacebarTranscript = useSessionStore((state) => state.setSpacebarTranscript);

  // Streaming QA hook - always enabled
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
          metadata: object.metadata,
          data: object.data
        };
        updateCanvasObject(activeSessionId, canvasObject);
      }
    }, [activeSessionId, updateCanvasObject]),
    onComplete: useCallback(() => {
      if (activeSessionId) {
        appendTimelineEvent(activeSessionId, {
          description: "AI completed response.",
          type: "response"
        });
      }
    }, [activeSessionId, appendTimelineEvent])
  });

  const handleTranscript = useCallback((transcript: string) => {
    setValue((prev) => `${prev} ${transcript}`.trim());
  }, []);

  const submitPromptMessage = useCallback(async () => {
    if (!value.trim()) {
      return;
    }

    const prompt = value.trim();
    setValue("");

    // Auto-create session if none exists
    let sessionId = activeSessionId;
    if (!sessionId || sessions.length === 0) {
      try {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        const displayMinutes = minutes.toString().padStart(2, '0');
        const timeString = `${displayHours}:${displayMinutes} ${ampm}`;
        const title = `New Lesson ${timeString}`;

        sessionId = await createSession({ title });
      } catch (error) {
        console.error("Failed to create session:", error);
        return;
      }
    }

    const state = useSessionStore.getState();
    addMessage(sessionId, {
      role: "user",
      content: prompt
    });
    appendTimelineEvent(sessionId, {
      description: "Learner submitted a question.",
      type: "prompt"
    });
    const { canvasObjects } = state;
    const selectedObjects =
      canvasObjects[sessionId]?.filter((object) => object.selected).map((object) => object.id) ?? [];

    // Always use streaming mode
    try {
      await streamingQA.startStreaming(sessionId, prompt, {
        highlightedObjects: selectedObjects,
        mode: "guided"
      });

      // Add assistant message with the complete text after streaming
      if (streamingQA.currentText.trim()) {
        addMessage(sessionId, { role: "assistant", content: streamingQA.currentText });
      }
    } catch (error) {
      console.error("Streaming error:", error);

      // User-friendly error messages
      let errorMessage = "I'm experiencing a momentary issue. Please try again.";
      if (error instanceof Error) {
        if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = "Network error. Please check your connection and try again.";
        } else if (error.message.includes('timeout')) {
          errorMessage = "Request timed out. Please try asking again.";
        }
      }

      addMessage(sessionId, {
        role: "assistant",
        content: errorMessage
      });
      appendTimelineEvent(sessionId, {
        description: `Error: ${errorMessage}`,
        type: "response"
      });
    }
  }, [activeSessionId, sessions.length, createSession, appendTimelineEvent, addMessage, value, updateCanvasObject, streamingQA]);

  // Watch for spacebar transcript (push-to-talk mode) and auto-submit
  useEffect(() => {
    if (voiceInputState.spacebarTranscript && !voiceInputState.isPushToTalkActive) {
      // Spacebar was just released, transcript is ready
      const transcript = voiceInputState.spacebarTranscript.trim();

      if (transcript) {
        console.log('📝 Auto-submitting spacebar transcript:', transcript);
        setValue(transcript);
        setSpacebarTranscript(''); // Clear from store

        // Auto-submit after a brief delay to let the input update
        setTimeout(() => {
          void submitPromptMessage();
        }, 100);
      }
    }
  }, [voiceInputState.spacebarTranscript, voiceInputState.isPushToTalkActive, setSpacebarTranscript, submitPromptMessage]);

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void submitPromptMessage();
    },
    [submitPromptMessage]
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="pointer-events-auto absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex w-full max-w-xl items-center gap-3 rounded-full border border-slate-200 bg-white/95 px-4 py-2 shadow-lg backdrop-blur-md"
    >
      <input
        type="text"
        placeholder={voiceInputState.isPushToTalkActive ? "Listening..." : "Ask Mentora or hold spacebar to speak..."}
        value={voiceInputState.isPushToTalkActive ? voiceInputState.spacebarTranscript : value}
        onChange={(event) => setValue(event.target.value)}
        disabled={streamingQA.isStreaming || voiceInputState.isPushToTalkActive}
        className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none disabled:opacity-50"
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void submitPromptMessage();
          }
        }}
      />
      <VoiceToggle onTranscript={handleTranscript} onAutoSubmit={submitPromptMessage} />
    </form>
  );
}
