'use client';

import { useCallback, useEffect, useRef, useState } from "react";

export function useSpeechSynthesis() {
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    
    setSupported('speechSynthesis' in window);
    
    if (!('speechSynthesis' in window)) {
      setError("Speech synthesis not supported in this browser.");
      return;
    }

    // Set up speech synthesis event listeners
    const handleEnd = () => {
      setSpeaking(false);
    };

    const handleError = (event: SpeechSynthesisErrorEvent) => {
      setError(`Speech synthesis error: ${event.error}`);
      setSpeaking(false);
    };

    window.speechSynthesis.addEventListener('voiceschanged', () => {
      // Voices are loaded
    });

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', () => {});
    };
  }, []);

  const speak = useCallback((text: string, options?: {
    rate?: number;
    pitch?: number;
    volume?: number;
    voice?: SpeechSynthesisVoice;
  }) => {
    if (!supported || !text.trim()) {
      return;
    }

    // Stop any current speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Set voice options
    utterance.rate = options?.rate ?? 1;
    utterance.pitch = options?.pitch ?? 1;
    utterance.volume = options?.volume ?? 1;
    
    if (options?.voice) {
      utterance.voice = options.voice;
    } else {
      // Try to find a good default voice
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(voice => 
        voice.lang.startsWith('en') && voice.name.includes('Google')
      ) || voices.find(voice => voice.lang.startsWith('en'));
      
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
    }

    // Set up event listeners
    utterance.onend = () => {
      setSpeaking(false);
      utteranceRef.current = null;
    };

    utterance.onerror = (event) => {
      setError(`Speech synthesis error: ${event.error}`);
      setSpeaking(false);
      utteranceRef.current = null;
    };

    utterance.onstart = () => {
      setSpeaking(true);
      setError(null);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [supported]);

  const stop = useCallback(() => {
    if (supported) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      utteranceRef.current = null;
    }
  }, [supported]);

  const pause = useCallback(() => {
    if (supported) {
      window.speechSynthesis.pause();
    }
  }, [supported]);

  const resume = useCallback(() => {
    if (supported) {
      window.speechSynthesis.resume();
    }
  }, [supported]);

  return {
    speak,
    stop,
    pause,
    resume,
    speaking,
    supported,
    error
  };
}
