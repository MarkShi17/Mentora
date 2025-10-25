'use client';

import { useCallback, useRef, useState, useEffect } from 'react';

interface AudioChunk {
  audio: string;        // Base64 audio
  text: string;         // Text being spoken
  sentenceIndex: number;
}

interface AudioQueueState {
  isPlaying: boolean;
  currentSentenceIndex: number | null;
  currentText: string | null;
  queueLength: number;
}

export function useAudioQueue() {
  const [state, setState] = useState<AudioQueueState>({
    isPlaying: false,
    currentSentenceIndex: null,
    currentText: null,
    queueLength: 0,
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const queueRef = useRef<AudioChunk[]>([]);
  const currentAudioRef = useRef<AudioBufferSourceNode | null>(null);
  const isPlayingRef = useRef(false);

  // Initialize AudioContext
  useEffect(() => {
    if (typeof window !== 'undefined') {
      audioContextRef.current = new AudioContext();
    }

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  /**
   * Decode base64 audio to AudioBuffer
   */
  const decodeAudio = useCallback(async (base64Audio: string): Promise<AudioBuffer> => {
    if (!audioContextRef.current) {
      throw new Error('AudioContext not initialized');
    }

    // Remove data URI prefix if present
    const base64Data = base64Audio.replace(/^data:audio\/mp3;base64,/, '');

    // Decode base64 to binary
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Decode audio data
    const audioBuffer = await audioContextRef.current.decodeAudioData(bytes.buffer);
    return audioBuffer;
  }, []);

  /**
   * Play next chunk in queue
   */
  const playNextChunk = useCallback(async () => {
    if (!audioContextRef.current || queueRef.current.length === 0) {
      isPlayingRef.current = false;
      setState(prev => ({
        ...prev,
        isPlaying: false,
        currentSentenceIndex: null,
        currentText: null,
        queueLength: 0,
      }));
      return;
    }

    const chunk = queueRef.current.shift()!;
    isPlayingRef.current = true;

    setState(prev => ({
      ...prev,
      isPlaying: true,
      currentSentenceIndex: chunk.sentenceIndex,
      currentText: chunk.text,
      queueLength: queueRef.current.length,
    }));

    try {
      // Decode audio
      const audioBuffer = await decodeAudio(chunk.audio);

      // Create source node
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      currentAudioRef.current = source;

      // Play next chunk when this one ends
      source.onended = () => {
        currentAudioRef.current = null;
        playNextChunk();
      };

      // Start playback
      source.start(0);
    } catch (error) {
      console.error('Failed to play audio chunk:', error);
      // Skip to next chunk on error
      playNextChunk();
    }
  }, [decodeAudio]);

  /**
   * Add audio chunk to queue
   */
  const enqueue = useCallback((chunk: AudioChunk) => {
    queueRef.current.push(chunk);

    setState(prev => ({
      ...prev,
      queueLength: queueRef.current.length,
    }));

    // Start playing if not already playing
    if (!isPlayingRef.current) {
      playNextChunk();
    }
  }, [playNextChunk]);

  /**
   * Stop playback and clear queue
   */
  const stop = useCallback(() => {
    // Stop current audio
    if (currentAudioRef.current) {
      currentAudioRef.current.stop();
      currentAudioRef.current = null;
    }

    // Clear queue
    queueRef.current = [];
    isPlayingRef.current = false;

    setState({
      isPlaying: false,
      currentSentenceIndex: null,
      currentText: null,
      queueLength: 0,
    });
  }, []);

  /**
   * Pause current playback
   */
  const pause = useCallback(() => {
    if (audioContextRef.current && audioContextRef.current.state === 'running') {
      audioContextRef.current.suspend();
    }
  }, []);

  /**
   * Resume playback
   */
  const resume = useCallback(() => {
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  }, []);

  /**
   * Clear queue without stopping current playback
   */
  const clearQueue = useCallback(() => {
    queueRef.current = [];
    setState(prev => ({
      ...prev,
      queueLength: 0,
    }));
  }, []);

  return {
    enqueue,
    stop,
    pause,
    resume,
    clearQueue,
    state,
  };
}
