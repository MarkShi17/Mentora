'use client';

import { useCallback, useRef, useState } from "react";
import type { VoiceOption } from "@/types";

export function useOpenAITTS() {
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackResolveRef = useRef<(() => void) | null>(null);
  const playbackRejectRef = useRef<((error: Error) => void) | null>(null);

  const resetAudioState = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current.load();
    }
    audioRef.current = null;
    playbackResolveRef.current = null;
    playbackRejectRef.current = null;
    setSpeaking(false);
    setPaused(false);
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (playbackRejectRef.current) {
      playbackRejectRef.current(new Error("Playback stopped"));
    }
    resetAudioState();
    setLoading(false);
  }, [resetAudioState]);

  const speak = useCallback(
    async (text: string, voice: VoiceOption = 'alloy') => {
      const trimmed = text.trim();
      if (!trimmed) {
        console.log('TTS speak: empty text, nothing to play');
        return;
      }

      // Always stop any existing playback before starting a new request
      stop();

      setLoading(true);
      setError(null);

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
        const response = await fetch(`${apiUrl}/api/tts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: trimmed, voice }),
        });

        if (!response.ok) {
          throw new Error(`TTS request failed: ${response.status}`);
        }

        const data = await response.json();

        return await new Promise<void>((resolve, reject) => {
          try {
            const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
            audioRef.current = audio;
            playbackResolveRef.current = resolve;
            playbackRejectRef.current = reject;

            audio.onplay = () => {
              setSpeaking(true);
              setPaused(false);
              setLoading(false);
            };

            audio.onended = () => {
              const resolveFn = playbackResolveRef.current;
              resetAudioState();
              setLoading(false);
              resolveFn?.();
            };

            audio.onerror = (event) => {
              console.error("Audio playback error:", event);
              const playbackError = new Error("Failed to play audio");
              const rejectFn = playbackRejectRef.current;
              resetAudioState();
              setLoading(false);
              setError(playbackError.message);
              rejectFn?.(playbackError);
            };

            audio.play().catch((err) => {
              console.error("Audio play() promise rejected:", err);
              const playbackError = err instanceof Error ? err : new Error("Failed to start audio playback");
              const rejectFn = playbackRejectRef.current;
              resetAudioState();
              setLoading(false);
              setError(playbackError.message);
              rejectFn?.(playbackError);
              reject(playbackError);
            });
          } catch (err) {
            const playbackError = err instanceof Error ? err : new Error("Failed to generate speech");
            resetAudioState();
            setLoading(false);
            setError(playbackError.message);
            reject(playbackError);
          }
        });
      } catch (error) {
        console.error("TTS error:", error);
        resetAudioState();
        setLoading(false);
        setError(error instanceof Error ? error.message : "Failed to generate speech");
        throw error;
      }
    },
    [resetAudioState, stop]
  );

  const pause = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      setPaused(true);
    }
  }, []);

  const resume = useCallback(() => {
    if (audioRef.current && audioRef.current.paused) {
      audioRef.current.play();
      setPaused(false);
    }
  }, []);

  return {
    speak,
    stop,
    pause,
    resume,
    speaking,
    paused,
    loading,
    error,
    supported: true // OpenAI TTS is always supported since it's server-side
  };
}
