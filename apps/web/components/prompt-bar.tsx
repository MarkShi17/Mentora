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
  const response = await fetch("/api/qa", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error("Failed to contact tutor.");
  }
  return response.json();
}

export function PromptBar() {
  const [value, setValue] = useState("");
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const addMessage = useSessionStore((state) => state.addMessage);
  const appendTimelineEvent = useSessionStore((state) => state.appendTimelineEvent);

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
      <VoiceToggle onTranscript={(transcript) => setValue((prev) => `${prev} ${transcript}`.trim())} />
    </form>
  );
}
