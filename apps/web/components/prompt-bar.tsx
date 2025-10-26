'use client';

import { useCallback, useState, useEffect, useRef } from "react";
import { VoiceToggle } from "@/components/voice-toggle";
import { useSessionStore } from "@/lib/session-store";
import { useStreamingQA } from "@/hooks/use-streaming-qa";
import { useSequentialConnections } from "@/hooks/use-sequential-connections";

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
  const thinkingMessageIdRef = useRef<string | null>(null);
  const currentSessionRef = useRef<string | null>(null);
  const sequenceKeyRef = useRef<string | null>(null);

  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const sessions = useSessionStore((state) => state.sessions);
  const createSession = useSessionStore((state) => state.createSession);
  const addMessage = useSessionStore((state) => state.addMessage);
  const appendTimelineEvent = useSessionStore((state) => state.appendTimelineEvent);
  const voiceInputState = useSessionStore((state) => state.voiceInputState);
  const setSpacebarTranscript = useSessionStore((state) => state.setSpacebarTranscript);
  const setStopStreamingCallback = useSessionStore((state) => state.setStopStreamingCallback);
  const setRerunQuestionCallback = useSessionStore((state) => state.setRerunQuestionCallback);
  const updateMessage = useSessionStore((state) => state.updateMessage);
  const removeMessage = useSessionStore((state) => state.removeMessage);
  const { startSequence, addObjectToSequence, endSequence } = useSequentialConnections();

  // Streaming QA hook - always enabled
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
        console.log('⚠️ Prompt bar: Message marked as interrupted');

        appendTimelineEvent(sessionId, {
          description: "Response interrupted",
          type: "response"
        });
      }

      // Reset refs
      thinkingMessageIdRef.current = null;
      currentSessionRef.current = null;
      endSequence();
      sequenceKeyRef.current = null;
    }, [updateMessage, appendTimelineEvent, endSequence]),
    onCanvasObject: useCallback((object: any) => {
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
        label: object.metadata?.referenceName || object.label || object.type,
        metadata: object.metadata,
        data: object.data,
        generationState: object.generationState,
        placeholder: object.placeholder
      };

      addObjectToSequence(sessionId, canvasObject, object.position, sequenceKeyRef.current);
    }, [activeSessionId, addObjectToSequence]),
    onComplete: useCallback(() => {
      const sessionId = currentSessionRef.current;
      const thinkingMessageId = thinkingMessageIdRef.current;

      if (sessionId && thinkingMessageId) {
        console.log('✅ Streaming complete - finalizing message');
        thinkingMessageIdRef.current = null;
        currentSessionRef.current = null;
      }

      const targetSessionId = sessionId ?? activeSessionId;
      if (targetSessionId) {
        appendTimelineEvent(targetSessionId, {
          description: "AI completed response.",
          type: "response"
        });
      }

      endSequence();
      sequenceKeyRef.current = null;
    }, [activeSessionId, appendTimelineEvent, endSequence]),
    onError: useCallback(() => {
      endSequence();
      sequenceKeyRef.current = null;
    }, [endSequence])
  });

  // Update thinking message in real-time as text streams in
  useEffect(() => {
    const sessionId = currentSessionRef.current;
    const thinkingMessageId = thinkingMessageIdRef.current;

    if (sessionId && thinkingMessageId) {
      const content = streamingQA.currentText.trim() || "Thinking...";
      updateMessage(sessionId, thinkingMessageId, {
        content: content,
        isStreaming: streamingQA.isStreaming,
        isPlayingAudio: streamingQA.audioState.isPlaying
      });
    }
  }, [streamingQA.currentText, streamingQA.isStreaming, streamingQA.audioState.isPlaying, updateMessage]);

  // Register stop streaming callback when streaming starts
  useEffect(() => {
    if (streamingQA.isStreaming) {
      setStopStreamingCallback(() => {
        console.log('🛑 Stop from prompt bar - stopping generation');

        // Get current state before stopping
        const partialText = streamingQA.currentText;
        const thinkingMessageId = thinkingMessageIdRef.current;
        const sessionId = currentSessionRef.current;

        // Stop streaming
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
            description: "Response stopped by user",
            type: "response"
          });
        }

        // Reset refs
        currentSessionRef.current = null;
      });
    } else {
      // Clear the callback when streaming stops
      setStopStreamingCallback(null);
    }
  }, [streamingQA.isStreaming, streamingQA.currentText, streamingQA.stopStreaming,
      setStopStreamingCallback, updateMessage, removeMessage, appendTimelineEvent, endSequence]);

  const handleTranscript = useCallback((transcript: string) => {
    setValue((prev) => `${prev} ${transcript}`.trim());
  }, []);

  const submitPromptWithText = useCallback(async (text: string) => {
    const prompt = text.trim();
    if (!prompt) {
      return;
    }

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

    // Add "thinking..." placeholder message with streaming flag
    const thinkingMessageId = addMessage(sessionId, {
      role: "assistant",
      content: "Thinking...",
      isStreaming: true
    });
    thinkingMessageIdRef.current = thinkingMessageId;
    currentSessionRef.current = sessionId;

    const { canvasObjects } = state;
    const selectedObjects =
      canvasObjects[sessionId]?.filter((object) => object.selected).map((object) => object.id) ?? [];

    // Always use streaming mode
    try {
      sequenceKeyRef.current = startSequence(sessionId);
      await streamingQA.startStreaming(sessionId, prompt, {
        highlightedObjects: selectedObjects,
        mode: "guided"
      });

      // Note: Message update happens in onComplete callback
    } catch (error) {
      console.error("Streaming error:", error);
      endSequence();
      sequenceKeyRef.current = null;

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
  }, [activeSessionId, sessions.length, createSession, appendTimelineEvent, addMessage, startSequence, streamingQA, endSequence]);

  const submitPromptMessage = useCallback(async () => {
    if (!value.trim()) {
      return;
    }
    const prompt = value.trim();
    setValue(""); // Clear input
    await submitPromptWithText(prompt);
  }, [value, submitPromptWithText]);

  // Watch for spacebar transcript (push-to-talk mode) and auto-submit
  useEffect(() => {
    if (voiceInputState.spacebarTranscript !== '' && !voiceInputState.isPushToTalkActive) {
      // Spacebar was just released, transcript is ready
      // DON'T TRIM - Submit EXACTLY what was said, including stutters
      const transcript = voiceInputState.spacebarTranscript;

      console.log('📝 Auto-submitting RAW spacebar transcript:', transcript);

      // Clear from store immediately
      setSpacebarTranscript('');

      // Submit directly with the EXACT transcript (don't filter anything)
      void submitPromptWithText(transcript);
    }
  }, [voiceInputState.spacebarTranscript, voiceInputState.isPushToTalkActive, setSpacebarTranscript, submitPromptWithText]);

  // Register stop streaming callback for prompt-bar initiated streams
  useEffect(() => {
    setStopStreamingCallback(() => {
      console.log('🛑 Stop callback invoked from prompt-bar - completely stopping');

      // Stop streaming and audio IMMEDIATELY
      streamingQA.stopStreaming();
      endSequence();
      sequenceKeyRef.current = null;

      // DELETE the thinking message completely
      const thinkingMessageId = thinkingMessageIdRef.current;
      const sessionId = currentSessionRef.current;
      if (sessionId && thinkingMessageId) {
        console.log('🗑️ Deleting thinking message:', thinkingMessageId);
        removeMessage(sessionId, thinkingMessageId);
        thinkingMessageIdRef.current = null;
        currentSessionRef.current = null;
      }

      console.log('✅ Stop complete - ready for new questions');
    });

    return () => {
      setStopStreamingCallback(null);
    };
  }, [streamingQA, setStopStreamingCallback, removeMessage, endSequence]);

  // Register rerun question callback
  useEffect(() => {
    setRerunQuestionCallback((question: string) => {
      console.log('🔄 Rerun question from prompt-bar:', question);
      void submitPromptWithText(question);
    });

    return () => {
      setRerunQuestionCallback(null);
    };
  }, [submitPromptWithText, setRerunQuestionCallback]);

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
      className="pointer-events-auto absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex w-full max-w-2xl items-center gap-4 rounded-3xl glass-white px-6 py-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-2xl border border-white/50 hover:shadow-[0_12px_40px_rgba(0,0,0,0.16)] transition-all duration-300"
    >
      <input
        type="text"
        placeholder={voiceInputState.isPushToTalkActive ? "Listening..." : "Ask Mentora or hold spacebar to speak..."}
        value={voiceInputState.isPushToTalkActive ? voiceInputState.spacebarTranscript : value}
        onChange={(event) => setValue(event.target.value)}
        disabled={streamingQA.isStreaming || voiceInputState.isPushToTalkActive}
        className="flex-1 bg-transparent text-sm font-medium text-slate-900 placeholder:text-slate-500/70 focus:outline-none disabled:opacity-60 transition-opacity"
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
