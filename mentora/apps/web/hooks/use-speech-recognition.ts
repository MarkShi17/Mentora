'use client';

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionConstructor = new () => SpeechRecognition;

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }
  return (
    (window as unknown as Record<string, SpeechRecognitionConstructor>).SpeechRecognition ??
    (window as unknown as Record<string, SpeechRecognitionConstructor>).webkitSpeechRecognition ??
    null
  );
}

export function useSpeechRecognition() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const createRecognition = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      setSupported(false);
      setError("Speech recognition not supported in this browser.");
      return null;
    }
    
    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true; // Keep listening continuously
      recognition.interimResults = false;
      recognition.lang = "en-US";
      recognition.maxAlternatives = 1;
      
      setSupported(true);
      return recognition;
    } catch (error) {
      console.error("Failed to create speech recognition:", error);
      setSupported(false);
      setError("Failed to initialize speech recognition.");
      return null;
    }
  }, []);

  const start = useCallback(async () => {
    if (listening) return;
    
    // Request microphone permission first
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      console.error("Microphone permission denied:", error);
      setError("Microphone permission denied. Please allow microphone access and try again.");
      return;
    }
    
    const recognition = createRecognition();
    if (!recognition) return;
    
    recognitionRef.current = recognition;
    setTranscript("");
    setListening(true);
    setError(null);
    setSupported(true);

    const handleResult = (event: SpeechRecognitionEvent) => {
      const result = event.results[event.results.length - 1][0].transcript;
      setTranscript(result.trim());
    };

    const handleError = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error);
      
      let errorMessage = event.error;
      if (event.error === 'not-allowed') {
        errorMessage = "Microphone permission denied. Please allow microphone access.";
      } else if (event.error === 'no-speech') {
        errorMessage = "No speech detected. Please try again.";
      } else if (event.error === 'network') {
        errorMessage = "Network error. Please check your connection.";
      }
      
      setError(errorMessage);
      setListening(false);
      recognitionRef.current = null;
    };

    const handleEnd = () => {
      // Don't stop listening - continuous mode should restart automatically
      // Only set listening to false if we explicitly stopped it
      if (recognitionRef.current) {
        // Recognition ended naturally, keep the reference for potential restart
        console.log("Speech recognition ended, but staying in listening mode");
      }
    };

    recognition.addEventListener("result", handleResult);
    recognition.addEventListener("error", handleError);
    recognition.addEventListener("end", handleEnd);

    try {
      recognition.start();
    } catch (error) {
      console.error("Failed to start speech recognition:", error);
      setError("Failed to start speech recognition");
      setListening(false);
      recognitionRef.current = null;
    }
  }, [listening, createRecognition]);

  const stop = useCallback(() => {
    if (!listening || !recognitionRef.current) return;
    
    try {
      recognitionRef.current.stop();
    } catch (error) {
      console.error("Failed to stop speech recognition:", error);
    }
    setListening(false);
    recognitionRef.current = null;
  }, [listening]);

  // Initialize support check
  useEffect(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (SpeechRecognition) {
      setSupported(true);
      setError(null);
    } else {
      setSupported(false);
      setError("Speech recognition not supported in this browser.");
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
        recognitionRef.current = null;
      }
    };
  }, []);

  return {
    transcript,
    listening,
    error,
    start,
    stop,
    supported
  };
}
