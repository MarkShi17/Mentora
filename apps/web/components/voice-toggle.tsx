'use client';

import { useEffect } from "react";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { useSessionStore } from "@/lib/session-store";

type VoiceToggleProps = {
  onTranscript?: (transcript: string) => void;
};

export function VoiceToggle({ onTranscript }: VoiceToggleProps) {
  const setVoiceActive = useSessionStore((state) => state.setVoiceActive);
  const voiceActive = useSessionStore((state) => state.voiceActive);
  const { transcript, listening, supported, start, stop, error } = useSpeechRecognition();

  const handleToggle = () => {
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
  };

  useEffect(() => {
    if (transcript && onTranscript) {
      onTranscript(transcript);
    }
  }, [transcript, onTranscript]);

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant={listening ? "secondary" : "outline"}
        size="icon"
        disabled={!supported}
        onClick={handleToggle}
        className={listening ? "animate-pulse" : ""}
      >
        {listening ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
      </Button>
      <div className="min-w-[120px] text-right">
        <p className="text-xs font-medium text-slate-400">
          {supported ? (voiceActive ? "Listening..." : "Voice idle") : "Voice unavailable"}
        </p>
        {error ? <p className="text-[10px] text-red-400">{error}</p> : null}
      </div>
    </div>
  );
}
