'use client';

import { useCallback, useEffect, useRef, useState } from "react";

// Web Speech API type definitions
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly length: number;
  readonly isFinal: boolean;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

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
  const onAutoSubmitRef = useRef<((transcript: string) => void) | null>(null);
  const hasProcessedRef = useRef<boolean>(false);
  const lastTranscriptRef = useRef<string>("");

  const setAutoSubmitCallback = useCallback((callback: (transcript: string) => void) => {
    console.log('Setting auto-submit callback');
    onAutoSubmitRef.current = callback;
  }, []);

  const createRecognition = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      setSupported(false);
      setError("Speech recognition not supported in this browser.");
      return null;
    }
    
    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false; // Single recognition session
      recognition.interimResults = true; // Show real-time transcript as user speaks
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
    
    // Reset state for new recognition session
    hasProcessedRef.current = false;
    lastTranscriptRef.current = "";
    
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
      const result = event.results[event.results.length - 1];
      // DON'T TRIM - Keep EVERYTHING including stutters, pauses, etc.
      const transcript = result[0].transcript;
      const isFinal = result.isFinal;

      // Always update transcript in real-time (interim and final) - NO CLEANING
      setTranscript(transcript);
      console.log(isFinal ? 'Final transcript:' : 'Interim transcript:', transcript);

      // Only process final results for auto-submit
      if (isFinal && !hasProcessedRef.current) {
        hasProcessedRef.current = true;
        lastTranscriptRef.current = transcript;

        console.log('Processing final transcript for auto-submit (RAW):', transcript);

        // Auto-submit instantly for push-to-talk mode
        setTimeout(() => {
          if (onAutoSubmitRef.current) {
            console.log('Auto-submitting RAW transcript:', transcript);
            onAutoSubmitRef.current(transcript);
            setTranscript(""); // Clear transcript after auto-submit
          }
          // Stop listening after auto-submit
          setListening(false);
          if (recognitionRef.current) {
            try {
              recognitionRef.current.stop();
            } catch (error) {
              console.error("Failed to stop recognition:", error);
            }
          }
          recognitionRef.current = null;
        }, 100); // 100ms delay for instant submission in push-to-talk mode
      }
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
      console.log("Speech recognition ended");
      setListening(false);
      recognitionRef.current = null;
    };

    recognition.addEventListener("result", handleResult as any);
    recognition.addEventListener("error", handleError as any);
    recognition.addEventListener("end", handleEnd as any);

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
    
    // Reset processing state
    hasProcessedRef.current = false;
    lastTranscriptRef.current = "";
    
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
    supported,
    setAutoSubmitCallback
  };
}
