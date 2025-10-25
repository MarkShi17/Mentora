'use client';

import { useCallback, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VoiceToggle } from "@/components/voice-toggle";
import { useSessionStore } from "@/lib/session-store";

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
  const apiUrl = 'http://localhost:3000';
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
    reply: data.text,
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

  const { mutateAsync, isPending } = useMutation({
    mutationFn: submitPrompt,
    onError: () => {
      appendTimelineEvent(activeSessionId ?? "", {
        description: "Unable to reach the tutor service.",
        type: "response"
      });
    }
  });

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
      // Add canvas objects from backend response
      if (data.canvasObjects) {
        data.canvasObjects.forEach((obj: any) => {
          updateCanvasObject(sessionId, obj);
        });
      }
    } catch (error) {
      addMessage(sessionId, {
        role: "assistant",
        content: "I'm experiencing a momentary issue. Please try again in a bit."
      });
    }
  }, [activeSessionId, appendTimelineEvent, mutateAsync, addMessage, value]);

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
      className="flex w-full items-end gap-3 rounded-lg border border-border bg-slate-950/80 p-3 backdrop-blur"
    >
      <div className="flex-1 space-y-2">
        <Textarea
          placeholder={
            activeSessionId
              ? "Ask Mentora to guide you through your next concept..."
              : "Create a lesson to start asking questions."
          }
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={!activeSessionId || isPending}
          rows={2}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submitPromptMessage();
            }
          }}
        />
        <p className="text-xs text-slate-500">
          Press <span className="rounded-sm bg-slate-900 px-1">Shift + Enter</span> for newline.
        </p>
      </div>
      <div className="flex flex-col items-end gap-2">
        <VoiceToggle onTranscript={(transcript) => setValue((prev) => `${prev} ${transcript}`.trim())} />
        <Button type="submit" disabled={!activeSessionId || isPending || !value.trim()}>
          {isPending ? "Thinking..." : "Send"}
        </Button>
      </div>
    </form>
  );
}
