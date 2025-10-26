'use client';

import { useCallback, useRef, useState } from 'react';
import { useAudioQueue } from './use-audio-queue';
import { useSessionStore } from '@/lib/session-store';
import type { StreamEvent, CanvasObject, ObjectPlacement, ObjectReference, VoiceOption } from '@/types';

interface StreamingQAState {
  isStreaming: boolean;
  currentText: string;
  error: string | null;
}

interface StreamingQACallbacks {
  onCanvasObject?: (object: CanvasObject, placement: ObjectPlacement) => void;
  onReference?: (reference: ObjectReference) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
  onInterrupted?: (partialText: string) => void;  // Called when streaming is interrupted
}

export function useStreamingQA(callbacks?: StreamingQACallbacks) {
  const [state, setState] = useState<StreamingQAState>({
    isStreaming: false,
    currentText: '',
    error: null,
  });

  const audioQueue = useAudioQueue();
  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const setBrainState = useSessionStore((state) => state.setBrainState);
  const addMCPToolStatus = useSessionStore((state) => state.addMCPToolStatus);
  const updateMCPToolStatus = useSessionStore((state) => state.updateMCPToolStatus);
  const settings = useSessionStore((state) => state.settings);

  /**
   * Start streaming QA request
   */
  const startStreaming = useCallback(async (
    sessionId: string,
    question: string,
    options?: {
      highlightedObjects?: string[];
      highlightedObjectsData?: any[];  // Full object data for RAG
      mode?: 'guided' | 'direct';
      images?: Array<{ base64: string; mimeType: string }>;
      context?: {
        recentConversation?: string[];
        topics?: string[];
        conversationHistory?: string[];
      };
    }
  ) => {
    // Check if we're in demo mode - if so, don't run the actual tutoring system
    const demoMode = useSessionStore.getState().demoMode;
    if (demoMode.isDemoMode && demoMode.demoSessionId === sessionId) {
      console.log('🎭 Demo mode active - skipping actual tutoring system');
      return;
    }

    // Stop any existing stream
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Reset state
    setState({
      isStreaming: true,
      currentText: '',
      error: null,
    });
    audioQueue.stop();

    try {
      // Prepare request
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      abortControllerRef.current = new AbortController();

      // Log user input
      console.log('🎤 User Question:', question);
      console.log('📡 Streaming to:', `${apiUrl}/api/qa-stream`);
      console.log('📋 Session ID:', sessionId);

      // Make POST request to start stream
      const response = await fetch(`${apiUrl}/api/qa-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          question,
          highlightedObjects: options?.highlightedObjects || [],
          highlightedObjectsData: options?.highlightedObjectsData || [],
          mode: options?.mode || 'guided',
          images: options?.images,
          context: options?.context,
          stream: true,
          // Include user settings
          userName: settings.preferredName || '',
          voice: settings.voice || 'alloy',
          explanationLevel: settings.explanationLevel || 'intermediate',
        }),
        signal: abortControllerRef.current.signal,
      });

      console.log('✅ Response status:', response.status, response.statusText);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Process SSE stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // Decode chunk
        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || ''; // Keep incomplete message in buffer

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) {
            continue;
          }

          try {
            const data = line.slice(6); // Remove 'data: ' prefix
            const event: StreamEvent = JSON.parse(data);

            // Handle different event types
            switch (event.type) {
              case 'cached_intro':
                console.log('🎯 Cached intro received:', event.data.text);
                console.log('   Category:', event.data.category);
                console.log('   Duration:', event.data.duration + 'ms');

                // Play cached intro immediately for instant feedback
                audioQueue.enqueue({
                  audio: event.data.audio,
                  text: event.data.text,
                  sentenceIndex: -1, // Special index for cached intro
                });

                // Optionally show the intro text immediately in the UI
                setState(prev => ({
                  ...prev,
                  currentText: event.data.text,
                  isStreaming: true,
                }));
                break;

              case 'brain_selected':
                console.log('🧠 Brain selected:', event.data.brainName, `(${event.data.confidence.toFixed(2)} confidence)`);
                console.log('   Reasoning:', event.data.reasoning);
                setBrainState(sessionId, {
                  brainType: event.data.brainType,
                  brainName: event.data.brainName,
                  confidence: event.data.confidence,
                  reasoning: event.data.reasoning,
                });
                break;

              case 'mcp_tool_start':
                console.log('🔧 MCP tool started:', event.data.toolName);
                console.log('   Description:', event.data.description);
                addMCPToolStatus(sessionId, {
                  toolName: event.data.toolName,
                  status: 'running',
                  startTime: Date.now(),
                });
                break;

              case 'mcp_tool_complete':
                console.log(
                  event.data.success ? '✅ MCP tool completed:' : '❌ MCP tool failed:',
                  event.data.toolName,
                  `(${event.data.duration}ms)`
                );
                if (event.data.error) {
                  console.error('   Error:', event.data.error);
                }
                updateMCPToolStatus(sessionId, event.data.toolName, {
                  status: event.data.success ? 'complete' : 'error',
                  endTime: Date.now(),
                  error: event.data.error,
                });
                break;

              case 'text_chunk':
                console.log('📝 Text chunk:', event.data.text);
                setState(prev => ({
                  ...prev,
                  currentText: prev.currentText + event.data.text + ' ',
                }));
                break;

              case 'audio_chunk':
                console.log('🔊 Audio chunk:', event.data.sentenceIndex, '-', event.data.text.substring(0, 50) + '...');
                audioQueue.enqueue({
                  audio: event.data.audio,
                  text: event.data.text,
                  sentenceIndex: event.data.sentenceIndex,
                });
                break;

              case 'canvas_object':
                console.log('🎨 Canvas object:', event.data.object.type, event.data.object.metadata?.referenceName);
                if (callbacks?.onCanvasObject) {
                  callbacks.onCanvasObject(event.data.object, event.data.placement);
                }
                break;

              case 'reference':
                console.log('🔗 Reference:', event.data.mention);
                if (callbacks?.onReference) {
                  callbacks.onReference(event.data);
                }
                break;

              case 'complete':
                console.log('✅ Stream complete!');
                setState(prev => ({
                  ...prev,
                  isStreaming: false,
                }));
                if (callbacks?.onComplete) {
                  callbacks.onComplete();
                }
                break;

              case 'error':
                const errorMessage = event.data.message;
                console.error('❌ Stream error:', errorMessage);
                setState(prev => ({
                  ...prev,
                  isStreaming: false,
                  error: errorMessage,
                }));
                if (callbacks?.onError) {
                  callbacks.onError(errorMessage);
                }
                break;

              case 'interrupted':
                console.log('⚠️ Stream interrupted:', event.data.message);
                setState(prev => ({
                  ...prev,
                  isStreaming: false,
                }));
                if (callbacks?.onInterrupted) {
                  callbacks.onInterrupted(state.currentText);
                }
                break;
            }
          } catch (error) {
            console.error('Failed to parse SSE event:', error);
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // User cancelled - not an error
        console.log('Streaming cancelled by user');
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error('Streaming QA failed:', error);
        setState(prev => ({
          ...prev,
          isStreaming: false,
          error: errorMessage,
        }));
        if (callbacks?.onError) {
          callbacks.onError(errorMessage);
        }
      }
    } finally {
      eventSourceRef.current = null;
      abortControllerRef.current = null;
    }
  }, [audioQueue, callbacks]);

  /**
   * Stop streaming
   */
  const stopStreaming = useCallback(() => {
    console.log('🛑 Stopping streaming completely');

    // Capture the partial text before clearing
    const partialText = state.currentText;

    // Close event source
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // Abort any pending requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Stop audio playback
    audioQueue.stop();

    // Clear all state immediately
    setState({
      isStreaming: false,
      currentText: '',  // Clear the text too
      error: null,
    });

    // Notify about interruption if there was partial content
    if (partialText && callbacks?.onInterrupted) {
      console.log('📝 Notifying about interrupted content:', partialText.substring(0, 50) + '...');
      callbacks.onInterrupted(partialText);
    }

    console.log('✅ Streaming stopped and state cleared');
  }, [audioQueue, state.currentText, callbacks]);

  return {
    startStreaming,
    stopStreaming,
    isStreaming: state.isStreaming,
    currentText: state.currentText,
    error: state.error,
    audioState: audioQueue.state,
  };
}
