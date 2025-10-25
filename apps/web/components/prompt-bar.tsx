'use client';

import { useCallback, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VoiceToggle } from "@/components/voice-toggle";
import { VoiceControls } from "@/components/voice-controls";
import { useSessionStore } from "@/lib/session-store";
import { useOpenAITTS } from "@/hooks/use-openai-tts";

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

type PromptResponse = {
  reply: string;
  timelineEvent?: {
    description: string;
    type: "prompt" | "response" | "visual" | "source";
  };
};

type PromptPayload = {
  sessionId: string;
  prompt: string;
  highlights: string[];
};

async function submitPrompt(payload: PromptPayload): Promise<PromptResponse> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  const response = await fetch(`${apiUrl}/api/qa`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      sessionId: payload.sessionId,
      question: payload.prompt,
      mode: "guided",
      highlightedObjectIds: payload.highlights || []
    })
  });
  if (!response.ok) {
    throw new Error("Failed to contact tutor.");
  }
  const data = await response.json();
  return {
    reply: data.answer.text,
    canvasObjects: data.canvasObjects || [],
    timelineEvent: {
      description: "Assistant provided guidance.",
      type: "response"
    }
  };
}

export function PromptBar() {
  const [value, setValue] = useState("");
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const addMessage = useSessionStore((state) => state.addMessage);
  const appendTimelineEvent = useSessionStore((state) => state.appendTimelineEvent);
  const updateCanvasObject = useSessionStore((state) => state.updateCanvasObject);
  const { speak } = useOpenAITTS();

  const { mutateAsync, isPending } = useMutation({
    mutationFn: submitPrompt,
    onError: () => {
      appendTimelineEvent(activeSessionId ?? "", {
        description: "Unable to reach the tutor service.",
        type: "response"
      });
    }
  });

  const handleTranscript = useCallback((transcript: string) => {
    setValue((prev) => `${prev} ${transcript}`.trim());
  }, []);

  const submitPromptMessage = useCallback(async () => {
    const state = useSessionStore.getState();
    const sessionId = activeSessionId;
    if (!sessionId || !value.trim()) {
      return;
    }
    const prompt = value.trim();
    setValue("");
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
        try {
          const data = await mutateAsync({ sessionId, prompt, highlights: selectedObjects });
            addMessage(sessionId, {
              role: "assistant",
              content: data.reply
            });
            if (data.timelineEvent) {
              appendTimelineEvent(sessionId, data.timelineEvent);
            }
            
            // Automatically read the assistant's response
            if (data.reply && data.reply.trim()) {
              speak(data.reply, 'nova');
            }
          // Add canvas objects from backend response
          if (data.canvasObjects) {
            data.canvasObjects.forEach((obj: any) => {
              // Transform backend object structure to frontend structure
              const transformedObj = {
                id: obj.id,
                type: obj.type,
                x: obj.position.x,
                y: obj.position.y,
                width: obj.size.width, // Keep for reference but CSS will override
                height: obj.size.height, // Keep for reference but CSS will override
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
        } catch (error) {
          addMessage(sessionId, {
            role: "assistant",
            content: "I'm experiencing a momentary issue. Please try again in a bit."
          });
        }
  }, [activeSessionId, appendTimelineEvent, mutateAsync, addMessage, value, updateCanvasObject]);

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
      className="pointer-events-auto absolute bottom-6 left-1/2 z-20 flex w-full max-w-3xl -translate-x-1/2 items-center gap-3 rounded-full border border-slate-700/50 bg-slate-950/80 px-4 py-2 shadow-lg backdrop-blur-md"
    >
      <input
        type="text"
        placeholder={
          activeSessionId
            ? "Ask Mentora to guide you through your next concept..."
            : "Create a lesson to start asking questions."
        }
        value={value}
        onChange={(event) => setValue(event.target.value)}
        disabled={!activeSessionId || isPending}
        className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void submitPromptMessage();
          }
        }}
      />
      <VoiceToggle onTranscript={handleTranscript} />
    </form>
  );
}
