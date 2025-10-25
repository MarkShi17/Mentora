'use client';

import { useEffect, useCallback } from "react";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { useSessionStore } from "@/lib/session-store";

type VoiceToggleProps = {
  onTranscript?: (transcript: string) => void;
  onAutoSubmit?: (transcript: string) => void;
};

export function VoiceToggle({ onTranscript, onAutoSubmit }: VoiceToggleProps) {
  const setVoiceActive = useSessionStore((state) => state.setVoiceActive);
  const voiceActive = useSessionStore((state) => state.voiceActive);
  const { transcript, listening, supported, start, stop, error, setAutoSubmitCallback } = useSpeechRecognition();

  const handleToggle = useCallback(() => {
    if (!supported) {
      return;
    }
    if (listening) {
      stop();
      setVoiceActive(false);
      return;
    }
    setVoiceActive(true);
    start();
  }, [supported, listening, stop, setVoiceActive, start]);

  useEffect(() => {
    if (transcript && onTranscript) {
      onTranscript(transcript);
    }
  }, [transcript, onTranscript]);

  useEffect(() => {
    if (onAutoSubmit) {
      setAutoSubmitCallback(onAutoSubmit);
    }
  }, [onAutoSubmit, setAutoSubmitCallback]);

  return (
    <Button
      type="button"
      variant={listening ? "secondary" : "ghost"}
      size="icon"
      disabled={!supported}
      onClick={handleToggle}
      className={`rounded-full transition-all ${
        listening ? "bg-cyan-500/20 text-cyan-400 animate-pulse shadow-lg shadow-cyan-500/20 hover:bg-cyan-500/30" : "text-slate-400 hover:text-slate-300 hover:bg-slate-800/50"
      }`}
    >
      {listening ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
    </Button>
  );
}
