'use client';

import { Play, Pause, Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOpenAITTS } from "@/hooks/use-openai-tts";

type VoiceControlsProps = {
  text: string;
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  className?: string;
};

export function VoiceControls({ text, voice = 'nova', className = '' }: VoiceControlsProps) {
  const { speak, stop, pause, resume, speaking, loading, error } = useOpenAITTS();

  const handlePlay = () => {
    if (speaking) {
      resume();
    } else {
      speak(text, voice);
    }
  };

  const handlePause = () => {
    pause();
  };

  const handleStop = () => {
    stop();
  };

  if (!text.trim()) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handlePlay}
        disabled={loading}
        className="flex items-center gap-1"
      >
        {loading ? (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : speaking ? (
          <Volume2 className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
        {loading ? 'Generating...' : speaking ? 'Playing' : 'Play'}
      </Button>

      {speaking && (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePause}
            className="flex items-center gap-1"
          >
            <Pause className="h-4 w-4" />
            Pause
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleStop}
            className="flex items-center gap-1"
          >
            <Square className="h-4 w-4" />
            Stop
          </Button>
        </>
      )}

      {error && (
        <p className="text-xs text-red-400 ml-2">
          {error}
        </p>
      )}
    </div>
  );
}
