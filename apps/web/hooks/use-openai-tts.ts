'use client';

import { useCallback, useRef, useState } from "react";

type VoiceOption = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

export function useOpenAITTS() {
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const speak = useCallback(async (text: string, voice: VoiceOption = 'nova', onComplete?: () => void) => {
    console.log('TTS speak called with text:', text, 'voice:', voice);
    if (!text.trim()) {
      console.log('TTS speak: empty text, returning');
      return;
    }

    if (speaking) {
      console.log('TTS speak: already speaking, stopping first');
      stop();
    }

    console.log('TTS speak: starting TTS generation');
    setLoading(true);
    setError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, voice }),
      });

      if (!response.ok) {
        throw new Error(`TTS request failed: ${response.status}`);
      }

      const data = await response.json();
      
      // Create audio element and play
      console.log('TTS: creating audio element');
      const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
      audioRef.current = audio;
      
      audio.onloadstart = () => {
        console.log('TTS: audio load started');
        setLoading(false);
      };
      audio.onplay = () => {
        console.log('TTS: audio started playing');
        setSpeaking(true);
      };
      audio.onended = () => {
        console.log('TTS: audio finished playing');
        setSpeaking(false);
        if (onComplete) {
          onComplete();
        }
      };
      audio.onerror = (event) => {
        console.error("Audio playback error:", event);
        setSpeaking(false);
        setError("Failed to play audio");
      };

      console.log('TTS: attempting to play audio');
      await audio.play();
      console.log('TTS: audio play() completed');
      
    } catch (error) {
      console.error("TTS error:", error);
      setError(error instanceof Error ? error.message : "Failed to generate speech");
      setLoading(false);
      setSpeaking(false);
    }
  }, [speaking]);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setSpeaking(false);
    setPaused(false);
    setLoading(false);
  }, []);

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
