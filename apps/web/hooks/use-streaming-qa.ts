'use client';

import { useCallback, useRef, useState } from 'react';
import { useAudioQueue } from './use-audio-queue';
import type { StreamEvent, CanvasObject, ObjectPlacement, ObjectReference } from '@/types';

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

  /**
   * Start streaming QA request
   */
  const startStreaming = useCallback(async (
    sessionId: string,
    question: string,
    options?: {
      highlightedObjects?: string[];
      mode?: 'guided' | 'direct';
      context?: {
        recentConversation?: string[];
        topics?: string[];
        conversationHistory?: string[];
      };
    }
  ) => {
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
          mode: options?.mode || 'guided',
          context: options?.context,
          stream: true,
        }),
        signal: abortControllerRef.current.signal,
      });

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
              case 'text_chunk':
                setState(prev => ({
                  ...prev,
                  currentText: prev.currentText + event.data.text + ' ',
                }));
                break;

              case 'audio_chunk':
                audioQueue.enqueue({
                  audio: event.data.audio,
                  text: event.data.text,
                  sentenceIndex: event.data.sentenceIndex,
                });
                break;

              case 'canvas_object':
                if (callbacks?.onCanvasObject) {
                  callbacks.onCanvasObject(event.data.object, event.data.placement);
                }
                break;

              case 'reference':
                if (callbacks?.onReference) {
                  callbacks.onReference(event.data);
                }
                break;

              case 'complete':
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
                setState(prev => ({
                  ...prev,
                  isStreaming: false,
                  error: errorMessage,
                }));
                if (callbacks?.onError) {
                  callbacks.onError(errorMessage);
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
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    audioQueue.stop();

    setState(prev => ({
      ...prev,
      isStreaming: false,
    }));
  }, [audioQueue]);

  return {
    startStreaming,
    stopStreaming,
    isStreaming: state.isStreaming,
    currentText: state.currentText,
    error: state.error,
    audioState: audioQueue.state,
  };
}
