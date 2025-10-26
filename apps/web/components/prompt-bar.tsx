'use client';

import { useCallback, useState, useEffect, useRef } from "react";
import { VoiceToggle } from "@/components/voice-toggle";
import { ImageUploadButton } from "@/components/image-upload-button";
import { ImagePreview } from "@/components/image-preview";
import { useSessionStore } from "@/lib/session-store";
import type { CanvasObject } from "@/types";
import { useStreamingQA } from "@/hooks/use-streaming-qa";
import { useSequentialConnections } from "@/hooks/use-sequential-connections";
import { processImageFile, processVideoFile } from "@/lib/image-upload";
import type { ImageAttachment } from "@/types";

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
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imageAttachments, setImageAttachments] = useState<ImageAttachment[]>([]);
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
  const setTimelineOpen = useSessionStore((state) => state.setTimelineOpen);
  const markSessionAsHavingFirstInput = useSessionStore((state) => state.markSessionAsHavingFirstInput);
  const sessionsWithFirstInput = useSessionStore((state) => state.sessionsWithFirstInput);
  const updateCanvasObject = useSessionStore((state) => state.updateCanvasObject);
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

      // Helper function to convert to Title Case
      const toTitleCase = (str: string) => {
        return str.replace(/\w\S*/g, (txt) => {
          return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        });
      };

      const rawLabel = object.metadata?.referenceName || object.type;
      const titleCaseLabel = toTitleCase(rawLabel);

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
        label: titleCaseLabel,
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

  // Create a stable stop callback using useCallback
  const handleStopStreaming = useCallback(() => {
    console.log('🛑 Stop from prompt bar - stopping generation');

    // Get refs at time of callback execution
    const thinkingMessageId = thinkingMessageIdRef.current;
    const sessionId = currentSessionRef.current;

    // Stop streaming
    streamingQA.stopStreaming();

    // Update the message to show it was interrupted (if it had content)
    if (sessionId && thinkingMessageId) {
      const currentText = streamingQA.currentText;
      if (currentText && currentText.trim()) {
        console.log('⚠️ Marking message as interrupted with partial content');
        updateMessage(sessionId, thinkingMessageId, {
          content: currentText,
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

    // Reset refs and sequence
    currentSessionRef.current = null;
    endSequence();
    sequenceKeyRef.current = null;
  }, [streamingQA, updateMessage, removeMessage, appendTimelineEvent, endSequence]);

  // Register stop streaming callback when streaming starts
  useEffect(() => {
    if (streamingQA.isStreaming) {
      setStopStreamingCallback(handleStopStreaming);
    } else {
      setStopStreamingCallback(null);
    }
  }, [streamingQA.isStreaming, handleStopStreaming, setStopStreamingCallback]);

  const handleTranscript = useCallback((transcript: string) => {
    setValue((prev) => `${prev} ${transcript}`.trim());
  }, []);

  const handleFileUpload = useCallback(async (file: File) => {
    if (!activeSessionId) return;

    try {
      console.log('📁 Processing uploaded file for canvas:', file.type);
      
      // Get viewport center coordinates (approximate center of screen)
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;

      // Check if it's an image or video
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');

      if (isImage) {
        const imageData = await processImageFile(file);
        
        // Create canvas object for the uploaded image
        const imageObject: CanvasObject = {
          id: crypto.randomUUID(),
          type: 'image',
          label: file.name || 'Uploaded Image',
          x: centerX - 150, // Center the 300px wide image
          y: centerY - 150, // Center the 300px tall image
          width: 300,
          height: 300,
          color: '#6b7280',
          selected: false,
          zIndex: 1,
          data: {
            content: imageData.base64 // Store base64 data URL
          },
          metadata: {
            mimeType: imageData.mimeType,
            size: imageData.size,
            originalWidth: imageData.width,
            originalHeight: imageData.height
          }
        };

        // Add to canvas
        updateCanvasObject(activeSessionId, imageObject);
        console.log('✅ Uploaded image added to canvas at viewport center');

      } else if (isVideo) {
        const videoData = await processVideoFile(file);
        
        // Create canvas object for the uploaded video
        const videoObject: CanvasObject = {
          id: crypto.randomUUID(),
          type: 'video',
          label: file.name || 'Uploaded Video',
          x: centerX - 150, // Center the 300px wide video
          y: centerY - 150, // Center the 300px tall video
          width: 300,
          height: 300,
          color: '#6b7280',
          selected: false,
          zIndex: 1,
          data: {
            type: 'video',
            url: videoData.url,
            alt: file.name || 'Uploaded video'
          },
          metadata: {
            mimeType: videoData.mimeType,
            size: videoData.size,
            originalWidth: videoData.width,
            originalHeight: videoData.height,
            createdAt: Date.now()
          }
        };

        // Add to canvas
        updateCanvasObject(activeSessionId, videoObject);
        console.log('✅ Uploaded video added to canvas at viewport center');
      }

    } catch (error) {
      console.error('❌ Failed to process uploaded file:', error);
      alert(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [activeSessionId, updateCanvasObject]);

  const handleRemoveImage = useCallback((index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImageAttachments(prev => prev.filter((_, i) => i !== index));
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
      content: prompt,
      attachments: imageAttachments.length > 0 ? imageAttachments : undefined
    });
    appendTimelineEvent(sessionId, {
      description: "Learner submitted a question.",
      type: "prompt"
    });

    // Check if this is the first user input for this session and auto-open timeline
    if (!sessionsWithFirstInput[sessionId]) {
      console.log('🎯 First user input detected - opening timeline');
      markSessionAsHavingFirstInput(sessionId);
      setTimelineOpen(true);
    }

    // Check if we're in demo mode - if so, don't run the actual tutoring system
    const demoMode = useSessionStore.getState().demoMode;
    if (demoMode.isDemoMode && demoMode.demoSessionId === sessionId) {
      console.log('🎭 Demo mode active - skipping actual tutoring system from prompt bar');
      return;
    }

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

      // Prepare image data for API
      const images = imageAttachments.map(img => ({
        base64: img.base64!,
        mimeType: img.mimeType
      }));

      await streamingQA.startStreaming(sessionId, prompt, {
        highlightedObjects: selectedObjects,
        mode: "guided",
        images: images.length > 0 ? images : undefined
      });

      // Clear images after submission
      setSelectedImages([]);
      setImageAttachments([]);

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
  }, [activeSessionId, sessions.length, createSession, appendTimelineEvent, addMessage, startSequence, streamingQA, endSequence, imageAttachments]);

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
    <div className="pointer-events-auto absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex flex-col w-full max-w-2xl gap-2">
      {/* Image previews */}
      {selectedImages.length > 0 && (
        <div className="flex flex-wrap gap-2 px-2">
          {selectedImages.map((file, index) => (
            <ImagePreview
              key={index}
              file={file}
              onRemove={() => handleRemoveImage(index)}
            />
          ))}
        </div>
      )}

      {/* Main prompt bar */}
      <form
        onSubmit={handleSubmit}
        className="flex w-full items-center gap-4 rounded-3xl glass-white px-6 py-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-2xl border border-white/50 hover:shadow-[0_12px_40px_rgba(0,0,0,0.16)] transition-all duration-300"
      >
        <ImageUploadButton
          onFileSelect={handleFileUpload}
          disabled={streamingQA.isStreaming || voiceInputState.isPushToTalkActive}
        />
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
    </div>
  );
}
